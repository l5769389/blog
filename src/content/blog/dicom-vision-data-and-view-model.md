---
title: "数据与视口模型：从 Series 到 View"
description: "DicomVision 的运行时模型复盘：SeriesRecord 保存数据入口，ViewRecord 保存视口状态，ViewGroupRecord 让 MPR 三视口保持同步。"
pubDate: 2026-05-27
readTime: "8 min read"
tags: ["DicomVision", "Runtime Model", "Viewer"]
featured: false
cover: "dicom"
series:
  id: "dicom-vision"
  title: "DicomVision 项目复盘"
  description: "从 C/S 架构、医学影像背景、视口模型、关键 API 到重建与 QA 的工程复盘。"
  role: "part"
  order: 3
---

DicomVision 的核心模型可以压成一句话：

序列是数据入口，视口是计算状态，Tab 是前端展示状态。

这三个概念分开后，很多交互会变得顺。一个序列可以打开 Stack、MPR、3D、4D、Tag 等多个视图；一个 MPR Tab 背后有三个后端 View；前端 Tab 不保存完整像素，只保存后端返回的图像 URL 和 overlay metadata。

## 后端的三类状态

<div class="state-model">
  <div>
    <h3>SeriesRecord</h3>
    <p>由 `SeriesRegistry` 管理，保存序列元数据、实例列表、4D phase 信息和文件来源。</p>
  </div>
  <div>
    <h3>ViewRecord</h3>
    <p>由 `ViewRegistry` 管理，保存单个后端视口的尺寸、切片索引、窗宽窗位、缩放、平移、测量和渲染配置。</p>
  </div>
  <div>
    <h3>ViewGroupRecord</h3>
    <p>由 `ViewGroupRegistry` 管理，保存 MPR 共享状态，包括 cursor、window、MIP、斜切面和三视口同步信息。</p>
  </div>
</div>

`SeriesRecord` 是数据对象，`ViewRecord` 是状态对象。这个区分很关键。同一个序列可以同时打开 Stack 和 3D，它们共享数据来源，但拥有不同的视口状态。Stack 的 `current_index`、2D 旋转和测量，不应该污染 3D 的四元数、preset 和体渲染配置。

MPR 再多一层。AX、COR、SAG 是三个 `ViewRecord`，但它们共享一个 `ViewGroupRecord`。十字线、窗宽窗位、MIP slab 配置和 cursor 中心属于 group，不属于某一个单独视口。

## 前端只保存展示所需状态

前端的 `ViewerTabItem` 保存的是工作区状态：

- `viewId` 或 `viewportViewIds`：指向后端视口。
- `imageSrc` 或 `viewportImages`：由 `image_update` 的二进制图像生成 `blob:` URL。
- `sliceLabel`、`windowLabel`、`cornerInfo`：用于角标和状态展示。
- `measurements`、`viewportMeasurements`：前端 overlay 绘制所需数据。
- `mprFrame`、`mprCursor`、`viewportCrosshairs`、`viewportPlanes`：MPR 联动显示所需元数据。

它不持有完整 DICOM 像素，不直接做 MPR 重采样，也不自己计算 QA。这样前端可以专注于交互和布局：`ViewerWorkspace.vue` 管工作区，`ViewerToolbar.vue` 管命令入口，`ViewerCanvasStage.vue` 管图像和鼠标事件。

## 创建一个视图发生了什么

<div class="sequence-diagram">
  <div class="sequence-participants">
    <span>useViewerWorkspace</span>
    <span>typedApi</span>
    <span>ViewRegistry</span>
    <span>Socket</span>
    <span>Tab</span>
  </div>
  <ol>
    <li><span class="sequence-index">01</span><div><strong>前端决定视图类型</strong><p>工作区选择 Stack、MPR、3D 或 4D 后，`useViewerWorkspaceViews` 创建或复用对应 Tab。</p></div></li>
    <li><span class="sequence-index">02</span><div><strong>创建后端视口</strong><p>`postApi()` 调用 `/api/v1/view/create`。Stack 和 3D 创建一个 `ViewRecord`，MPR 创建 AX/COR/SAG 三个视口。</p></div></li>
    <li><span class="sequence-index">03</span><div><strong>绑定实时通道</strong><p>前端发送 `bind_view`，`ViewSocketHub` 建立 `sid <-> viewId` 关系。</p></div></li>
    <li><span class="sequence-index">04</span><div><strong>同步真实尺寸</strong><p>DOM 渲染后，前端调用 `/api/v1/view/setSize`。后端初始化 contain zoom、窗口和默认状态。</p></div></li>
    <li><span class="sequence-index">05</span><div><strong>更新 Tab</strong><p>后端推送 `image_update`，前端更新 `imageSrc`、label、overlay metadata，页面只重绘需要的视口。</p></div></li>
  </ol>
</div>

## 为什么尺寸由前端告诉后端

后端负责渲染 PNG/JPEG，但它不知道前端容器有多大。若后端按固定尺寸渲染，再让前端缩放，测量、比例尺、hover、MPR 十字线都会变得难以对齐。

所以 DicomVision 采用 `setSize`。前端测量视口 DOM 尺寸，后端按这个尺寸生成渲染结果。`viewport_transformer.build_image_to_canvas_transform()` 会基于图像尺寸、canvas 尺寸、当前 zoom、offset、rotation、flip 和像素宽高比生成仿射矩阵。

这个矩阵随后服务两件事：

- 正向：把源图像重采样到 canvas。
- 反向：把前端归一化点映射回源图像或 MPR plane，用于 hover 和测量。

## 操作不是直接渲染，而是先改状态

`view_operation` 的处理入口在 `viewer_operation_handlers.handle_view_operation()`。它不会简单地“收到事件就渲染”。它先修改状态，再返回渲染决策。

<div class="pipeline-diagram">
  <span>view_operation</span>
  <span>校验 payload</span>
  <span>修改 View/Group</span>
  <span>生成 RenderDecision</span>
  <span>调度渲染</span>
  <span>image_update</span>
</div>

常见决策有三类：

- 单视图渲染：平移、缩放、Stack 滚动等只影响当前 view。
- MPR 广播：十字线、MIP、共享窗宽窗位会影响同组 AX/COR/SAG。
- 不渲染或只回草稿：测量拖动过程中可以先返回 draft，减少无意义重渲染。

这层决策是项目后期变复杂时最值得保留的设计。功能越多，越需要一个地方统一回答：这次操作影响谁，应该渲染什么质量，是否要延迟补一帧。

## ViewSocketHub 的价值

`ViewSocketHub` 维护 `viewId -> sid set` 和 `sid -> viewId set`。它还负责渲染队列合并。

拖动时，同一个 view 可能很快收到多次渲染请求。直接并发渲染会造成两个问题：旧状态覆盖新状态，或者 CPU 被中间帧耗尽。`ViewSocketHub` 给每个 view 加 render lock。渲染中又来了新请求，就记录 pending request。当前渲染结束后，只补最新状态。

图像质量也会合并：拖拽中可以发 JPEG fast preview，稳定后再回 PNG。前端获得更流畅的交互，后端避免无意义排队。

## MPR 的共享状态

![MPR 旋转与切面联动](/images/dicom-vision/mpr-rotate.png)

MPR 是这套模型最好的压力测试。

AX、COR、SAG 三个视口都有自己的尺寸、变换和 overlay，但 cursor、体数据、MIP 配置、斜切面状态是共享的。在轴位图上拖动十字线，本质上是在修改 volume 里的 world center。这个 center 改变后，冠状位和矢状位的切面也要重新派生。

所以 MPR 的操作通常不是“当前视口刷新”，而是：

1. 找到当前 `ViewRecord`。
2. 定位它所在的 `ViewGroupRecord`。
3. 更新 shared cursor 或 group 状态。
4. 找出同组所有 view。
5. 广播渲染 AX、COR、SAG。

这个模型让 MPR 可以继续扩展到 MIP slab、斜切面旋转、4D phase 同步，而不必把共享状态塞进某一个视口对象里。

## 这层模型的复盘

这套模型的优点是边界清楚，缺点是通信字段多。前端和后端都要理解 `viewId`、`viewportKey`、`viewGroupKey`、`tabKey`、`seriesId` 的区别。

这条分层是项目里最值得保留的骨架：

- `SeriesRecord` 只管数据来源。
- `ViewRecord` 只管单个可渲染视口。
- `ViewGroupRecord` 只管跨视口共享状态。
- `ViewerTabItem` 只管前端工作区展示。

医学影像工作台不怕对象多，怕的是对象职责混。职责一混，MPR、测量、导出、PACS 会互相牵连，后面每个功能都会变成补丁。
