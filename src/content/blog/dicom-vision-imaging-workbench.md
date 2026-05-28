---
title: DicomVision 项目复盘：医学影像工作台
description: 复盘 DicomVision 从 DICOM 数据接入、视口会话、实时渲染、MPR/4D/3D 到测量与 QA 的完整工程链路。
pubDate: 2026-05-08
readTime: 12 min read
tags:
  - DICOM
  - Medical Imaging
  - Vue
  - FastAPI
  - Socket.IO
featured: true
cover: dicom
---

DicomVision 是一套 C/S 架构的 DICOM Viewer，由 Electron / Vue 客户端和 FastAPI 后端组成。它把 DICOM 解析、序列组织、MPR/4D/3D 等重计算和部分渲染放在后端完成，再把渲染帧、测量结果和交互状态推送给前端显示。

项目不是一个简单的图片查看器，而是围绕“数据接入 -> 序列管理 -> 视口会话 -> 实时交互 -> 重建分析 -> 结果导出”构建的医学影像工作台。它适合低显存阅片端、桌面端内置后端、PACS 查询下载和需要集中处理 DICOM 数据的场景。

<div class="case-hero">
  <div>
    <span class="case-kicker">项目概览</span>
    <h2>从 DICOM 数据到可交互影像工作流</h2>
    <p>前端负责工作区、工具栏、视口布局和用户操作；后端负责 DICOM 读取、图像渲染、MPR/4D/3D 计算、测量分析与实时事件推送。</p>
  </div>
  <dl>
    <div>
      <dt>客户端</dt>
      <dd>Electron / Vue 3 / TypeScript</dd>
    </div>
    <div>
      <dt>服务端</dt>
      <dd>FastAPI / Socket.IO / pydicom / VTK</dd>
    </div>
    <div>
      <dt>范围</dt>
      <dd>阅片、重建、测量、PACS、QA、导出</dd>
    </div>
  </dl>
</div>

![DicomVision dark theme workspace](/images/dicom-vision/theme-dark.png)

## 项目定位

DicomVision 的核心定位是把复杂影像处理能力从“功能清单”组织成“可连续使用的工作流”。一个典型用户不只是打开一张图，而是会经历加载本地目录或 PACS 序列、切换布局、滚动层面、调整窗宽窗位、做 MPR 或 3D 重建、执行测量或 QA，最后导出可复盘的结果。

这个定位决定了它没有选择纯前端 DICOM Viewer 路线。纯前端方案部署轻、交互延迟低，但会把 DICOM 解码、体数据重建和渲染压力放在浏览器或桌面渲染进程中。DicomVision 选择把重计算集中到后端，让前端保持轻量，桌面端则通过 Electron 主进程自动启动内置后端，让用户打开软件即可使用。

项目目前拆分为两个公开仓库：

- [DicomVisionClient](https://github.com/l5769389/DicomVisionClient)：Electron + Vue 前端，负责工作区编排、UI 状态、用户交互、Web 构建和桌面端打包。
- [DicomVisionServer](https://github.com/l5769389/DicomVisionServer)：FastAPI + Socket.IO 后端，负责 DICOM 发现、元数据服务、Stack/MPR/4D/3D 渲染、测量分析和实时图像推送。

## 能力地图

<div class="capability-map" aria-label="DicomVision capability map">
  <article>
    <strong>数据接入</strong>
    <span>本地文件/文件夹、浏览器上传、PACS DICOMweb、DIMSE、示例数据</span>
  </article>
  <article>
    <strong>阅片视图</strong>
    <span>Stack、Compare Stack、多序列布局、关键层面、窗宽窗位、伪彩</span>
  </article>
  <article>
    <strong>重建分析</strong>
    <span>MPR、斜切 MPR、MPR + 3D、4D 时相播放、VTK 体渲染</span>
  </article>
  <article>
    <strong>测量与 QA</strong>
    <span>线段、角度、矩形、椭圆、曲线、自由形状、MTF/FWHM、水模 QA</span>
  </article>
  <article>
    <strong>DICOM 工具链</strong>
    <span>Tag 查看、VR 感知编辑、批量修改、脱敏导出、SR/GSPS 导入导出</span>
  </article>
  <article>
    <strong>发布形态</strong>
    <span>Web 前端、远程后端、Windows/macOS 桌面端、内置后端 bundle</span>
  </article>
</div>

## 架构图

下面这张图展示了 DicomVision 的主要边界。前端不直接持有全部复杂影像状态，而是把视口创建、尺寸变化和高频交互传给后端；后端维护序列、视图、测量和渲染状态，再通过 Socket.IO 推送更新。

<div class="architecture-diagram" aria-label="DicomVision architecture diagram">
  <section>
    <h3>输入层</h3>
    <div class="diagram-node">本地 DICOM 文件夹</div>
    <div class="diagram-node">PACS 查询 / 下载缓存</div>
    <div class="diagram-node">Web 上传 / 示例数据</div>
  </section>
  <section>
    <h3>客户端</h3>
    <div class="diagram-node primary">Electron / Vue 工作区</div>
    <div class="diagram-node">Sidebar 序列树</div>
    <div class="diagram-node">ViewerCanvasStage</div>
    <div class="diagram-node">Toolbar / Layout / Overlay</div>
  </section>
  <section>
    <h3>通信层</h3>
    <div class="diagram-node accent">HTTP API</div>
    <div class="diagram-node accent">Socket.IO</div>
    <div class="diagram-note">HTTP 管资源创建与查询，Socket 管低延迟交互和帧更新。</div>
  </section>
  <section>
    <h3>服务端</h3>
    <div class="diagram-node primary">FastAPI ASGI App</div>
    <div class="diagram-node">series_registry / dicom_cache</div>
    <div class="diagram-node">view_registry / view_group_registry</div>
    <div class="diagram-node">viewer_service / render_layers</div>
    <div class="diagram-node">MPR / 4D / VTK / QA</div>
  </section>
  <section>
    <h3>输出层</h3>
    <div class="diagram-node">image_update 渲染帧</div>
    <div class="diagram-node">measurement / hover / ack</div>
    <div class="diagram-node">PNG / DICOM SR / GSPS</div>
  </section>
</div>

## 典型阅片时序

一次 Stack 或 MPR 视图从打开到可交互，大致会经过下面的时序。这个流程是项目里最重要的工程骨架：HTTP 负责建立资源，Socket.IO 负责绑定会话和连续更新。

<div class="sequence-diagram" aria-label="DicomVision view session sequence diagram">
  <div class="sequence-participants">
    <span>用户</span>
    <span>客户端</span>
    <span>HTTP API</span>
    <span>Socket.IO</span>
    <span>服务端运行时</span>
  </div>
  <ol>
    <li>
      <span class="sequence-index">01</span>
      <strong>选择 DICOM 来源</strong>
      <p>用户拖拽文件夹、选择本地路径、上传文件，或从 PACS Browser 查询并下载序列。</p>
    </li>
    <li>
      <span class="sequence-index">02</span>
      <strong>注册序列</strong>
      <p>客户端调用 <code>loadFolder</code> / <code>upload</code> / PACS API，服务端扫描 DICOM 文件并返回 <code>seriesList</code>。</p>
    </li>
    <li>
      <span class="sequence-index">03</span>
      <strong>创建视图</strong>
      <p>用户打开 Stack、MPR、3D、4D 或 Tags 标签页，客户端调用 <code>view/create</code> 创建 <code>viewId</code>。</p>
    </li>
    <li>
      <span class="sequence-index">04</span>
      <strong>绑定会话</strong>
      <p>客户端通过 Socket.IO <code>bind_view</code> 绑定当前 <code>viewId</code>，服务端记录 socket sid 与视图关系。</p>
    </li>
    <li>
      <span class="sequence-index">05</span>
      <strong>同步尺寸并首帧渲染</strong>
      <p>客户端上报视口尺寸，服务端初始化视图状态，渲染首帧并推送 <code>image_update</code>。</p>
    </li>
    <li>
      <span class="sequence-index">06</span>
      <strong>实时交互循环</strong>
      <p>滚轮、窗宽窗位、缩放、平移、十字线和测量操作通过 <code>view_operation</code> 发送，服务端更新状态后继续推送图像帧和叠加信息。</p>
    </li>
  </ol>
</div>

## 数据与视图模型

后端运行时主要维护三类状态：序列、视图和视图组。序列是 DICOM 数据进入系统后的基础索引；视图是某个标签页或某个画布对应的后端会话；视图组用于 MPR、Compare、4D 等需要多个视口协同的场景。

<div class="state-model">
  <div>
    <h3>SeriesRecord</h3>
    <p>描述一个 DICOM 序列，包含 Study/Series/Patient 元数据、实例列表、来源路径、缩略图和虚拟序列信息。</p>
  </div>
  <div>
    <h3>ViewRecord</h3>
    <p>描述一个后端视口，保存当前层面、窗宽窗位、缩放、平移、旋转、翻转、测量、伪彩和渲染尺寸。</p>
  </div>
  <div>
    <h3>ViewGroupRecord</h3>
    <p>描述一组相关视图，例如 MPR 三视图、Compare 双视图或 4D 时相视图，用于同步光标、布局和播放状态。</p>
  </div>
</div>

这个模型的好处是前端可以把复杂工具拆成多个标签页和视口，后端仍然能知道每个视口对应哪组数据、哪种渲染模式、当前处于什么交互状态。对于 MPR 来说，这一点尤其重要：轴位、冠状位、矢状位三个视口必须共享同一个体数据坐标系，同时又各自拥有画布尺寸、缩放和平移。

## 渲染与交互管线

DicomVision 的渲染不是简单地“后端返回一张图片”。每次渲染都要综合 DICOM 像素、窗宽窗位、伪彩、视口变换、MPR 切面、测量层、方向标记、角标信息和前端尺寸。

<div class="pipeline-diagram" aria-label="DicomVision rendering pipeline">
  <span>DICOM 实例</span>
  <span>像素缓存</span>
  <span>几何标准化</span>
  <span>视图状态</span>
  <span>渲染层合成</span>
  <span>Socket 推送</span>
</div>

在代码层面，这条链路由 `series_registry`、`dicom_cache`、`view_registry`、`viewer_operation_handlers`、`viewer_service`、`viewport_transformer` 和 `render_layers` 共同完成。前端 `ViewerCanvasStage` 接收图像帧后，再叠加前端交互层，例如鼠标 hover、测量草稿、十字线和选中状态。

## MPR 与多视口同步

MPR 是项目里最能体现工程复杂度的模块。它需要把一组 DICOM 切片组织成体数据，根据 DICOM 的方向、间距和位置计算真实空间，再从轴位、冠状位、矢状位或斜切平面重采样出二维图像。

<div class="image-grid">
  <figure>
    <img src="/images/dicom-vision/mpr.png" alt="MPR reconstruction in DicomVision" />
    <figcaption>MPR 三视图重建</figcaption>
  </figure>
  <figure>
    <img src="/images/dicom-vision/mpr-rotate.png" alt="Oblique MPR crosshair rotation in DicomVision" />
    <figcaption>斜切 MPR 与十字线旋转</figcaption>
  </figure>
</div>

前端侧需要解决的问题是“用户动作如何被稳定表达”。例如拖动十字线不是简单移动一个 DOM 元素，而是要转成体数据空间中的坐标更新；后端侧需要解决的问题是“状态变化后应该重渲染哪些视口”。一次 MPR 十字线移动可能会影响三个视图，一次斜切旋转可能还会改变切面方向、采样范围和方向标记。

这也是为什么 DicomVision 把 MPR 状态放在后端的 `view_group_registry` 中，而不是完全散落在前端组件里。共享状态集中后，多个视口之间的同步逻辑更可控，也更容易写测试覆盖。

## PACS、标签与导出

医学影像工具的价值不只在阅片，也在数据生命周期。DicomVision 支持 DICOMweb 和 DIMSE 两类 PACS 接入方式，可以查询检查/序列，下载后写入服务端缓存，再复用本地加载管线注册为序列。

<div class="image-grid">
  <figure>
    <img src="/images/dicom-vision/dicom-tags.png" alt="DICOM tag inspection in DicomVision" />
    <figcaption>DICOM Tag 树查看</figcaption>
  </figure>
  <figure>
    <img src="/images/dicom-vision/measure.png" alt="Measurement tools in DicomVision" />
    <figcaption>ROI 与几何测量</figcaption>
  </figure>
</div>

标签工具链包括 Tag 查看、VR 感知编辑、批量修改和脱敏导出。测量与标注则支持导出为 PNG、DICOM SR 和 DICOM GSPS，也支持导入 GSPS 叠加到原始影像。这里的设计重点是让“看图”和“结构化结果”之间能互相连接：前端交互产生的测量不应该只是一层临时 UI，而应该能够被导出、复现和校验。

## QA 与分析

在医学影像场景里，分析工具需要比普通图片工具更谨慎。MTF/FWHM 和水模 QA 不只是生成一个数值，还要让用户理解 ROI、曲线、统计结果和原图之间的关系。

<div class="image-grid">
  <figure>
    <img src="/images/dicom-vision/mtf.png" alt="MTF analysis in DicomVision" />
    <figcaption>MTF / FWHM 分析</figcaption>
  </figure>
  <figure>
    <img src="/images/dicom-vision/water-phantom-qa.png" alt="Water phantom QA in DicomVision" />
    <figcaption>水模 QA 流程</figcaption>
  </figure>
</div>

这部分的工程取舍是：前端负责把分析入口、ROI 选择和结果展示做清楚；后端负责计算、输入校验和结果结构化。这样既避免浏览器端堆积大量数值计算逻辑，也能让分析服务后续被桌面端、Web 端或自动化流程复用。

## 工程取舍

<div class="tradeoff-grid">
  <article>
    <h3>为什么选择 C/S 架构</h3>
    <p>低显存设备和桌面端内置后端是核心场景。把 DICOM 解码、MPR、4D、3D 和 QA 放到后端，可以让前端更轻，也更容易复用 Python 生态里的影像处理能力。</p>
  </article>
  <article>
    <h3>为什么同时使用 HTTP 和 Socket.IO</h3>
    <p>加载目录、创建视图、读取标签、导出文件更适合 HTTP；滚轮、拖拽、窗宽窗位、hover 和 4D 播放更适合 Socket.IO。两者分工后，接口边界更清晰。</p>
  </article>
  <article>
    <h3>为什么维护后端视口状态</h3>
    <p>视口状态包含层面、矩阵、缩放、平移、测量、MPR 组和渲染尺寸。后端集中维护这些状态，可以保证渲染输入一致，也能降低前后端状态漂移。</p>
  </article>
  <article>
    <h3>为什么需要大量测试</h3>
    <p>项目里有 MPR 几何、测量规则、视口生命周期、导出、PACS、4D 播放等测试。影像工具一旦状态不同步，表面看是 UI 问题，本质可能是几何或时序错误。</p>
  </article>
</div>

## 复盘收获

DicomVision 让我最深的体会是：复杂工具的难点不是把按钮做满，而是把数据流、交互状态和结果可信度连接起来。医学影像工具尤其如此，因为用户每一次滚动、测量、重建和导出都依赖同一套底层状态。

从工程角度看，这个项目的价值集中在三件事：

1. 把前端工作区和后端影像计算拆开，形成可复用的 C/S 边界。
2. 用视口会话模型管理实时交互，让 Stack、MPR、3D、4D 和 QA 能共享同一套运行时基础。
3. 把测量、标签、导出和 PACS 放进完整链路，而不是停留在单点功能展示。

后续如果继续推进，我会优先补强三块：更细的性能追踪、更多真实数据集下的交互压测，以及把分析结果的可追溯性做得更像正式工作站。这样 DicomVision 就不只是一个作品集项目，而是能逐步接近实际影像工作流的工程产品。
