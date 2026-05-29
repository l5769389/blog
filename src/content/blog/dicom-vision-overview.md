---
title: "DicomVision 复盘总览：影像工作台的边界"
description: "DicomVision 的第一层复盘：它不是一个图片查看器，而是一套围绕 DICOM 数据、视口状态、影像计算和桌面工作流组织起来的工作台。"
pubDate: 2026-05-29
readTime: "8 min read"
tags: ["DicomVision", "DICOM", "FastAPI", "Vue", "Electron"]
featured: true
cover: "dicom"
series:
  id: "dicom-vision"
  title: "DicomVision 项目复盘"
  description: "从 C/S 架构、医学影像背景、视口模型、关键 API 到重建与 QA 的工程复盘。"
  role: "overview"
  order: 1
---

<div class="case-hero">
  <div>
    <span class="case-kicker">DicomVision Review</span>
    <h2>先把项目边界划清楚</h2>
    <p>DicomVision 的核心不是“把 DICOM 文件打开”。真正的问题是：怎样把本地影像数据、阅片视口、MPR/3D 计算、测量、PACS 接入和导出组织成一个稳定的桌面工作台。</p>
  </div>
  <dl>
    <div>
      <dt>Client</dt>
      <dd>Electron + Vue 3，负责工作区、工具栏、视口交互和前端叠加层。</dd>
    </div>
    <div>
      <dt>Server</dt>
      <dd>FastAPI + Socket.IO，负责 DICOM 读取、渲染、重建、测量和 QA。</dd>
    </div>
    <div>
      <dt>Runtime</dt>
      <dd>HTTP 创建资源，Socket.IO 承接高频交互和图像推送。</dd>
    </div>
  </dl>
</div>

![DicomVision 深色主题](/images/dicom-vision/theme-dark.png)

## 项目到底在解决什么

复盘这个项目时，最容易把它写成项目介绍：支持 Stack、MPR、3D、测量、DICOM Tag、PACS、QA。那是给外人看的能力清单。

工程复盘要回答另一个问题：这些能力为什么会长成现在的形态。

从源码看，DicomVision 的边界很明确。`DicomVisionClient` 管操作入口和 UI 状态，`DicomVisionServer` 管影像数据、视口状态和计算结果。前端打开一个序列时，并不直接把 DICOM 像素搬到浏览器里算。它会调用 `/api/v1/view/create` 创建后端视口，再通过 Socket.IO `bind_view` 绑定这个 `viewId`。之后滚轮、拖拽、窗宽窗位、MPR 十字线、3D 旋转，都变成 `view_operation`，由后端更新 `ViewRecord` 或 `ViewGroupRecord`，再推送 `image_update`。

这条边界决定了项目的形态：前端像一个工作台壳，后端像一个影像运行时。

## 为什么选择 C/S 架构

C/S 架构不是为了显得“专业”。它是被影像计算逼出来的。

本地桌面应用看上去可以把所有逻辑放进 Electron，但 DICOM 不是普通图片。一次阅片会遇到这些问题：

- 像素解码依赖 pydicom、NumPy、SciPy、Pillow、VTK 等计算库。
- MPR 需要把序列构成三维体数据，再按任意平面重采样。
- 3D 体渲染需要 VTK 离屏渲染和会话缓存。
- 测量、MTF、水模 QA 需要把前端归一化坐标反算到图像或物理空间。
- PACS/DICOMweb/DIMSE、脱敏、Tag 修改、Secondary Capture 导出都更适合放在后端服务里处理。

所以影像计算放到后端并不是一个额外章节，而是总览里的根设计。前端负责让操作自然，后端负责让结果稳定、可复现、可测试。

<div class="architecture-diagram">
  <section>
    <h3>桌面壳</h3>
    <div class="diagram-node primary">Electron 主进程</div>
    <div class="diagram-node">启动窗口和本地后端</div>
  </section>
  <section>
    <h3>工作区</h3>
    <div class="diagram-node primary">Vue 3 Renderer</div>
    <div class="diagram-node">Tab、Toolbar、Overlay、Canvas Stage</div>
  </section>
  <section>
    <h3>控制面</h3>
    <div class="diagram-node primary">控制 API</div>
    <div class="diagram-node">loadFolder、create、setSize、export、analyze</div>
  </section>
  <section>
    <h3>交互面</h3>
    <div class="diagram-node primary">Socket.IO</div>
    <div class="diagram-node">bind_view、view_operation、image_update</div>
  </section>
  <section>
    <h3>计算面</h3>
    <div class="diagram-node primary">ViewerService</div>
    <div class="diagram-node">Stack、MPR、3D、测量、QA</div>
  </section>
</div>

## 这套架构换来了什么

<div class="tradeoff-grid">
  <article>
    <h3>计算边界清楚</h3>
    <p>影像计算集中在 `ViewerService`、`dicom_cache`、`viewport_transformer`、`mpr/*`、`volume_rendering/*`，前端不需要复制一套像素处理逻辑。</p>
  </article>
  <article>
    <h3>交互仍然及时</h3>
    <p>高频操作走 Socket.IO，拖拽期间可用 JPEG 或 fast preview，松手后再补高质量 PNG，避免渲染任务堆积。</p>
  </article>
  <article>
    <h3>状态可追踪</h3>
    <p>`SeriesRecord`、`ViewRecord`、`ViewGroupRecord` 让序列、视口和 MPR 共享状态都有明确落点，出错时能沿对象查回去。</p>
  </article>
  <article>
    <h3>功能能继续扩展</h3>
    <p>PACS、脱敏、Tag 修改、MTF、水模 QA、DICOM 导出都可以接入同一套后端运行时，而不是散落在前端事件里。</p>
  </article>
</div>

代价也存在：前后端通信协议变重要了。`ViewImageResponse` 的字段、`ViewOperationRequest` 的 `opType`、MPR 三视口的广播规则，都需要稳定。否则 UI 看似没改，后端渲染状态已经错位。

## 核心运行链路

<div class="sequence-diagram">
  <div class="sequence-participants">
    <span>Client</span>
    <span>HTTP</span>
    <span>Registry</span>
    <span>Socket</span>
    <span>ViewerService</span>
  </div>
  <ol>
    <li><span class="sequence-index">01</span><div><strong>加载数据</strong><p>前端选择本地文件夹，调用 `/api/v1/dicom/loadFolder`。后端扫描 header，按序列注册 `SeriesRecord`，不在这一阶段批量解码像素。</p></div></li>
    <li><span class="sequence-index">02</span><div><strong>创建视口</strong><p>前端选择 Stack、MPR、3D 等视图，调用 `/api/v1/view/create`。后端创建 `ViewRecord`，MPR 会加入共享 `ViewGroupRecord`。</p></div></li>
    <li><span class="sequence-index">03</span><div><strong>绑定通道</strong><p>前端用 Socket.IO `bind_view` 订阅 `viewId`。之后这个连接才会收到对应视口的 `image_update`。</p></div></li>
    <li><span class="sequence-index">04</span><div><strong>同步尺寸</strong><p>前端测量 DOM 尺寸，调用 `/api/v1/view/setSize`。后端按真实视口尺寸初始化缩放、窗口和渲染计划。</p></div></li>
    <li><span class="sequence-index">05</span><div><strong>交互重渲染</strong><p>滚动、拖拽、调窗、十字线、测量、3D 旋转走 `view_operation`。处理器修改状态，再决定单视图渲染、MPR 广播或只返回草稿。</p></div></li>
  </ol>
</div>

## 这一轮复盘怎么拆

这个系列不再按功能清单写，而按工程问题拆：

- 背景篇：解释 DICOM、序列、像素、窗宽窗位、物理坐标和 PACS，先补齐医学影像的最小上下文。
- 模型篇：解释 `SeriesRecord`、`ViewRecord`、`ViewGroupRecord` 和前端 `ViewerTabItem` 怎样配合。
- API 篇：整理 HTTP 与 Socket.IO 的边界，哪些请求创建资源，哪些请求推动实时交互。
- 重建与 QA 篇：复盘 MPR、3D、测量、MTF、水模 QA 为什么需要后端运行时支撑。

这样写比“我做了很多功能”更接近项目本身。DicomVision 的价值不在功能数量，而在它把影像工作流拆成了可以维护的层。
