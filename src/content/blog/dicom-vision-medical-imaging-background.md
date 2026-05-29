---
title: "医学影像背景：DICOM、序列和视口"
description: "写 DicomVision 之前，需要先说明医学影像里的几个基本概念：Study、Series、Instance、像素值、窗宽窗位、物理坐标、PACS 和 MPR。"
pubDate: 2026-05-28
readTime: "7 min read"
tags: ["DicomVision", "DICOM", "Medical Imaging"]
featured: false
cover: "dicom"
series:
  id: "dicom-vision"
  title: "DicomVision 项目复盘"
  description: "从 C/S 架构、医学影像背景、视口模型、关键 API 到重建与 QA 的工程复盘。"
  role: "part"
  order: 2
---

如果不了解医学影像背景，DicomVision 的很多代码会显得绕：为什么加载文件夹只读 header，为什么一个序列能打开多个视口，为什么坐标要来回映射，为什么 MPR 不是简单截一张图。

这些都不是架构癖好。它们来自 DICOM 数据本身。

## DICOM 不是一张图片

DICOM 文件里有两类东西：metadata 和 pixel data。

metadata 记录患者、检查、序列、设备、采集参数、图像方向、像素间距、窗宽窗位等信息。pixel data 才是图像像素。DicomVision 的 `loadFolder` 阶段只用 `pydicom.dcmread(..., stop_before_pixels=True)` 读取 header，就是因为文件夹可能很大，没必要一开始就把所有像素解码进内存。

真正渲染时才会进入 `dicom_cache.get(instance_uid, path)`。这里会读取完整 DICOM，拿到 `dataset.pixel_array`，再应用 `RescaleSlope` 和 `RescaleIntercept`。对 CT 来说，这一步通常把原始像素转换成 HU 值。若遇到 `MONOCHROME1`，还要反相处理。

<div class="pipeline-diagram">
  <span>DICOM 文件</span>
  <span>Header 扫描</span>
  <span>序列分组</span>
  <span>按需解码像素</span>
  <span>窗宽窗位</span>
  <span>视口渲染</span>
</div>

## Study、Series、Instance

医学影像通常不是“打开一个文件”。更常见的是打开一个检查目录，里面有多组序列，每组序列又包含多张切片。

<div class="state-model">
  <div>
    <h3>Study</h3>
    <p>一次检查。可以包含 CT 平扫、增强、定位片、报告、结构化文档等多个内容。</p>
  </div>
  <div>
    <h3>Series</h3>
    <p>一组采集方式相近的图像。DicomVision 用它作为工作区里可打开的基本数据单元。</p>
  </div>
  <div>
    <h3>Instance</h3>
    <p>单个 DICOM 实例。对普通 CT 序列来说，常对应一张切片。</p>
  </div>
</div>

源码里的 `SeriesRegistry` 会按 `SeriesInstanceUID`、相对目录和 4D phase 信息分组。这样做是为了避免两个看上去同 UID 的数据被错误合并，也为了把 4D 呼吸相位拆成可打开的虚拟序列。

## 窗宽窗位

CT 图像的值域比屏幕灰度大得多。屏幕只能显示 0 到 255，医学图像要通过窗宽窗位把一段值域映射到可见灰度。

窗位是中心，窗宽是范围：

```text
low = center - width / 2
high = center + width / 2
gray = normalize(clip(pixel, low, high), 0..255)
```

DicomVision 的 `BaseImageLayer.render_pixels()` 会优先使用视口状态里的窗宽窗位，其次使用 DICOM header，最后才用像素最小最大值兜底。这个顺序很重要：拖动调窗后，视口状态必须覆盖原始默认值。

![Stack 视图](/images/dicom-vision/stack.png)

## 物理坐标比像素坐标更重要

普通图片的坐标是 row/col。医学影像还要关心 patient world 坐标。

DICOM 中的 `ImageOrientationPatient` 描述图像行列方向，`ImagePositionPatient` 描述切片位置，`PixelSpacing` 描述像素间距。MPR、测量、比例尺、方向标都依赖这些信息。

DicomVision 的代码里同时存在几套坐标：

- 前端 DOM 坐标：鼠标事件里的屏幕位置。
- 前端归一化坐标：`0..1`，用于跨尺寸传输点位。
- 后端 canvas 坐标：渲染结果图上的像素。
- 源图像坐标：DICOM slice 或 MPR plane 的 row/col。
- patient world 坐标：由 DICOM 方向和间距推导出的物理空间。

`ViewerService._resolve_normalized_point_to_image_point()` 处理测量点映射，`viewport_transformer` 处理图像到 canvas 的仿射矩阵。这个链路如果不严谨，测量线看着在图上，实际数值会偏。

## MPR 为什么不是裁一张图

MPR 是 Multi-Planar Reconstruction。它不是从原图里裁出一张，而是把一组切片构成 volume，再按轴位、冠状位、矢状位或斜切面重新采样。

<div class="architecture-diagram">
  <section>
    <h3>切片</h3>
    <div class="diagram-node">InstanceRecord[]</div>
    <div class="diagram-note">按方向和位置排序</div>
  </section>
  <section>
    <h3>体数据</h3>
    <div class="diagram-node primary">standardized volume</div>
    <div class="diagram-note">NumPy 三维数组</div>
  </section>
  <section>
    <h3>几何</h3>
    <div class="diagram-node">VolumeGeometry</div>
    <div class="diagram-note">IJK 和 world 坐标互转</div>
  </section>
  <section>
    <h3>切面</h3>
    <div class="diagram-node">PlanePose</div>
    <div class="diagram-note">row、col、normal</div>
  </section>
  <section>
    <h3>重采样</h3>
    <div class="diagram-node primary">reslice_plane</div>
    <div class="diagram-note">输出 2D 图像</div>
  </section>
</div>

这也是为什么 MPR 三视口需要共享 `ViewGroupRecord`。十字线移动的不是某一张图上的点，而是 volume 里的一个物理中心点。轴位移动后，冠状位和矢状位也必须跟着更新。

![MPR 视图](/images/dicom-vision/mpr.png)

## PACS 是另一个数据入口

本地文件夹只是入口之一。DicomVision 还提供 `/api/v1/pacs/dicomweb/*` 和 `/api/v1/pacs/dimse/*`。DICOMweb 更接近现代 HTTP 工作流，DIMSE 更接近传统 PACS 环境。

这类接口不只是“下载文件”。它们会影响整个数据生命周期：连接测试、Study 查询、Series 查询、预览、异步下载、取消任务，最后再进入本地序列注册和视图创建流程。

所以 DicomVision 的背景知识至少要覆盖三层：

- 数据层：DICOM 文件、Study、Series、Instance、Tag、PixelData。
- 几何层：spacing、orientation、position、world 坐标、MPR。
- 系统层：本地文件、上传、PACS、导出、脱敏。

把这三层搞清楚，再读后面的模型和 API，就不会把每个函数都看成孤立功能。
