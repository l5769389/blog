---
title: "重建、测量与 QA：让结果可复现"
description: "DicomVision 中最重的部分不是 UI，而是 MPR、3D、测量、MTF 和水模 QA 这条影像计算链路。"
pubDate: 2026-05-25
readTime: "9 min read"
tags: ["DicomVision", "MPR", "3D", "QA"]
featured: false
cover: "dicom"
series:
  id: "dicom-vision"
  title: "DicomVision 项目复盘"
  description: "从 C/S 架构、医学影像背景、视口模型、关键 API 到重建与 QA 的工程复盘。"
  role: "part"
  order: 5
---

DicomVision 最重的部分不在 UI。真正重的是影像计算：MPR、3D 体渲染、测量、MTF、水模 QA、导出。

这些功能有一个共同点：结果必须能从后端状态重新算出来。否则屏幕上的图、保存的图、测量的数值和导出的文件会互相不一致。

## Stack 渲染是基础

Stack 渲染从单张 DICOM instance 开始：

<div class="pipeline-diagram">
  <span>InstanceRecord</span>
  <span>DicomCache</span>
  <span>Window/Color</span>
  <span>Affine Transform</span>
  <span>PNG/JPEG</span>
  <span>image_update</span>
</div>

`DicomCache` 负责解码像素、应用 slope/intercept、处理 `MONOCHROME1`，并限制缓存条目和内存。`BaseImageLayer` 做窗宽窗位和伪彩。`viewport_transformer` 把图像坐标映射到 canvas 坐标，支持缩放、平移、90 度旋转、翻转和像素宽高比。

这条链路看似普通，但它是后面所有测量和导出的基础。只要图像显示用了一个变换，测量点就必须能用同一个变换反算回去。

## MPR：从切片到任意平面

MPR 的关键是体数据和几何。

`ViewerService._get_series_volume()` 会遍历序列切片，借助 `dicom_cache` 拿到像素数组，再读取 `ImageOrientationPatient`、`ImagePositionPatient`、`PixelSpacing` 等信息。`build_standardized_volume()` 会根据 DICOM 方向和位置构建较统一的体数据表达。若 header 不可靠，后端会退回简单 stack 逻辑，但方向、间距和 MPR 精度会降级。

<div class="architecture-diagram">
  <section>
    <h3>Volume</h3>
    <div class="diagram-node primary">standardized volume</div>
    <div class="diagram-note">缓存后的三维数组</div>
  </section>
  <section>
    <h3>Geometry</h3>
    <div class="diagram-node">VolumeGeometry</div>
    <div class="diagram-note">IJK 和 world 坐标互转</div>
  </section>
  <section>
    <h3>Cursor</h3>
    <div class="diagram-node">MprCursorState</div>
    <div class="diagram-note">中心点和方向矩阵</div>
  </section>
  <section>
    <h3>Plane</h3>
    <div class="diagram-node">derive_plane_pose</div>
    <div class="diagram-note">AX/COR/SAG/Oblique</div>
  </section>
  <section>
    <h3>Reslice</h3>
    <div class="diagram-node primary">reslice_plane</div>
    <div class="diagram-note">SciPy 重采样</div>
  </section>
</div>

`reslice_plane()` 按切面姿态对体数据采样。启用 MIP 后，还会沿法向采样多个平行切面，再按 maximum、minimum、average 或 sum 聚合。

![MPR 结果](/images/dicom-vision/mpr.png)

## 3D：后端生成图像，前端展示结果

3D 视图没有把 volume 丢给前端 WebGL。后端用 VTK 离屏渲染生成 2D 图像，再通过 `image_update` 推给前端。

这条路的好处是依赖集中，坏处是后端压力更大。代码里通过 VTK session 缓存、单线程 executor、fast preview、最终帧补渲染来控制成本。`rotate3d` 更新四元数，`volumePreset` 和 `volumeConfig` 更新传递函数。

前端仍然有工作：它要显示图像、方向立方体、工具状态和交互反馈。但真正的 volume render request 由后端构造，包含 volume、spacing、画布尺寸、窗口、zoom、offset、rotation quaternion 和 preset。

## 测量：先映射，再计算

测量不是在前端直接算两点距离。

前端保存的是归一化点位，适合跨视口尺寸传输。后端收到后，要先转成 canvas 坐标，再用当前 `image_transform` 的逆矩阵映射到源图像或 MPR plane。之后才结合 spacing 计算长度、角度、面积、均值、标准差等指标。

<div class="sequence-diagram">
  <div class="sequence-participants">
    <span>前端点位</span>
    <span>Canvas</span>
    <span>Image/MPR</span>
    <span>Metrics</span>
    <span>Overlay</span>
  </div>
  <ol>
    <li><span class="sequence-index">01</span><div><strong>归一化点</strong><p>前端提交 `0..1` 坐标，避免视口尺寸改变后点位失效。</p></div></li>
    <li><span class="sequence-index">02</span><div><strong>反变换</strong><p>后端用当前仿射矩阵反算到图像坐标或 MPR plane 坐标。</p></div></li>
    <li><span class="sequence-index">03</span><div><strong>计算指标</strong><p>结合 spacing 和像素值计算几何或统计结果。</p></div></li>
    <li><span class="sequence-index">04</span><div><strong>再投影</strong><p>后端把结果序列化成前端 overlay 能画的归一化坐标。</p></div></li>
  </ol>
</div>

![测量工具](/images/dicom-vision/measure.png)

这个设计的价值在导出时更明显。日常浏览时，很多 overlay 由前端 Vue 组件绘制。导出 PNG 或 DICOM 时，前端可以把 overlay 数据提交给后端，后端在 `_apply_export_overlays()` 中把测量和标注烘焙到图像里。

## MTF 和水模 QA

MTF 和水模 QA 是项目里更接近影像质控的一组功能。

`POST /api/v1/view/mtf/analyze` 会把 ROI 映射到图像坐标，截取 ROI，再计算 MTF50、MTF10、FWHM 和曲线。能拿到 spacing 时，单位输出为 `lp/mm`，否则退到 `lp/pixel`。

![MTF 分析](/images/dicom-vision/mtf.png)

`POST /api/v1/view/qa/water/analyze` 会在当前 2D 图像里检测水模主体，构建中心 ROI、外围 ROI、空气 ROI，计算 CT 值准确性、均匀性和噪声。这个功能依赖图像内容，失败时应该返回清楚的 error，而不是给出看似正常的错误指标。

![水模 QA](/images/dicom-vision/water-phantom-qa.png)

## 4D：时间维度也要进入状态

4D 呼吸相位不是独立功能。它复用了 MPR 的很多基础设施，只是数据入口变成 phase manifest 和虚拟 phase series。

`four_d_service` 解析 phase，`SeriesRegistry` 注册虚拟序列，Socket 层通过 `four_d_playback_start`、`four_d_playback_stop`、`four_d_playback_fps` 控制播放。播放时，前端不是自己按图片列表轮播，而是让后端把 phase index 和视口状态对齐后推送。

![4D 视图](/images/dicom-vision/4d.png)

## 这一层的复盘

影像工作台的难点不在“功能能不能做出来”。难点在几个结果必须一致：

- 当前屏幕上的图像。
- hover 显示的像素位置和值。
- 测量得到的几何和统计指标。
- 导出后的 PNG 或 DICOM。
- MPR、3D、QA 使用的体数据和 spacing。

DicomVision 把这些一致性压在后端运行时里：同一个 `ViewRecord`、同一个 `ViewGroupRecord`、同一套 DICOM cache、同一套坐标映射。这个选择让前端轻一些，也让计算链路可测试。

这一层最值得学习的地方，是把“看见的图”和“算出来的结果”绑定到同一套运行时状态上。几何异常、导出一致性和 DICOM header 缺失都不是附加问题，而是影像软件天然要面对的质量边界。DicomVision 的设计把这些边界显式放进了后端模型、坐标映射和渲染链路中。
