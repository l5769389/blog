---
title: "关键内部 API：函数边界、调度与状态协议"
description: "DicomVision 的 API 复盘不止是 HTTP 路由，而是源码里的函数契约：typedApi、ViewRegistry、ViewerService、OperationHandler、ViewportTransformer 和 ViewSocketHub 如何协作。"
pubDate: 2026-05-26
readTime: "12 min read"
tags: ["DicomVision", "API Design", "Socket.IO", "FastAPI"]
featured: false
cover: "dicom"
series:
  id: "dicom-vision"
  title: "DicomVision 项目复盘"
  description: "从 C/S 架构、医学影像背景、视口模型、关键 API 到重建与 QA 的工程复盘。"
  role: "part"
  order: 4
---

DicomVision 里最值得复盘的 API，不是那些 HTTP 路径本身。路径只是外壳。真正有学习价值的是源码内部形成的几组函数契约：

- 前端 `postApi()` 把 OpenAPI 生成类型收敛成一个明确的调用面。
- `ViewRegistry.create()` 把“创建视口”变成纯状态构造，而不是马上渲染。
- `ViewerService.set_view_size()` 把初始化延迟到前端真实尺寸到达之后。
- `handle_view_operation()` 把所有交互统一成命令分发和渲染决策。
- `ViewportTransformer` 用同一个仿射矩阵同时服务图像重采样、hover 和测量。
- `ViewSocketHub` 把渲染推送做成有锁、有合并、有质量等级的调度器。

这些内部 API 是项目能持续扩展的骨架。HTTP 和 Socket.IO 只是把这些骨架暴露给前端。

## 前端 API：显式小表，而不是到处写 Axios

前端的 `typedApi.ts` 没有让业务代码直接写 Axios 泛型，也没有把后端所有 OpenAPI 都无脑暴露出来。它先定义一个小的 `operationPaths`：

```ts
const operationPaths = {
  CreateViewApiV1ViewCreatePost: '/api/v1/view/create',
  SetViewSizeApiV1ViewSetSizePost: '/api/v1/view/setSize',
  LoadFolderApiV1DicomLoadFolderPost: '/api/v1/dicom/loadFolder',
  AnalyzeMtfApiV1ViewMtfAnalyzePost: '/api/v1/view/mtf/analyze',
  AnalyzeQaWaterApiV1ViewQaWaterAnalyzePost: '/api/v1/view/qa/water/analyze',
} satisfies SupportedOperationPaths
```

这个设计有两个细节值得保留。

第一，key 来自生成的 `ApiOperations` 类型，value 是真实后端 path。业务代码调用 `postApi('CreateViewApiV1ViewCreatePost', payload)` 时，请求体和响应类型都从 OpenAPI 类型里推导出来。前端不用手写 `ViewCreateResponse` 的 Axios 泛型，也减少了“接口已经改了，调用处还以为没改”的风险。

第二，显式小表让调用面有边界。后端可以有很多路由，但 viewer UI 真正使用哪些请求，由这个表决定。新增功能时，先把路由加入表，再让业务代码调用。这个步骤看似多余，实际是在防止 API 面失控。

<div class="sequence-diagram">
  <div class="sequence-participants">
    <span>OpenAPI Types</span>
    <span>operationPaths</span>
    <span>postApi</span>
    <span>业务代码</span>
    <span>Backend</span>
  </div>
  <ol>
    <li><span class="sequence-index">01</span><div><strong>类型来源固定</strong><p>`ApiOperations` 来自后端 OpenAPI 生成文件，前端不重复定义请求和响应模型。</p></div></li>
    <li><span class="sequence-index">02</span><div><strong>调用面收敛</strong><p>`operationPaths` 只收录 viewer UI 需要的操作，避免每个组件自行拼路径。</p></div></li>
    <li><span class="sequence-index">03</span><div><strong>请求体推导</strong><p>`OperationRequest&lt;K&gt;` 和 `OperationResponse&lt;K&gt;` 由 operation key 推导，调用处保持轻量。</p></div></li>
    <li><span class="sequence-index">04</span><div><strong>路径归一</strong><p>`toApiBaseRelativePath()` 去掉 `/api/v1` 前缀，让 Axios baseURL 和后端版本前缀各司其职。</p></div></li>
  </ol>
</div>

二进制文件下载没有强行塞进 `postApi()`。`postDicomTagModifyArtifact()` 和 `postDicomDeidentifyArtifact()` 单独处理 `arraybuffer`、`content-disposition`、`x-dicomvision-*` header，再组装成 `DicomTagModifyArtifact`。这是另一个清楚的边界：普通 JSON 请求走统一 helper，带文件名、媒体类型和二进制内容的 artifact 走专用 helper。

## Socket API：类型化事件，比字符串到处飞稳

`socket.ts` 把 Socket.IO 事件也写成了类型契约：

- `ServerToClientEvents`：`image_update`、`view_progress`、`hover_info`、`measurement_draft`、`four_d_phase_index`。
- `ClientToServerEvents`：`bind_view`、`view_operation`、`view_hover`、`four_d_playback_*`。
- `ViewOperationPayload`：前端所有阅片操作的统一 payload。

这个设计的重点不是“用了 TypeScript”。重点是高频交互没有散落成几十个松散事件。鼠标拖动、滚轮、窗宽窗位、测量、MPR、3D 配置都进入 `view_operation`。新增工具时，优先扩展 payload 和后端 handler，而不是再发明一条事件通道。

`bindViewSilentlyWithAck()` 和 `emitViewOperationWithAck()` 也体现了工程判断。绑定视图需要短超时确认，交互操作可以有更长 ack。这样前端在关键生命周期节点上能知道后端是否接住了命令，而普通 `emitViewOperation()` 仍然保持轻量。

`image_update` 的二进制 payload 还做了兼容：

```ts
type ImageUpdateSocketArgs =
  | [payload: Partial<ViewImageResponse>, imageBinary: ArrayBuffer | Uint8Array]
  | [message: [Partial<ViewImageResponse>, ArrayBuffer | Uint8Array]]
```

这是处理 python-socketio 与不同 transport 行为差异的小技巧。后端发的是 meta + bytes，但前端接收层不假定它一定以两个参数到达。

## ViewRegistry：创建状态，不急着渲染

后端创建视口的入口是 `ViewRegistry.create()`。它做的事情非常少：

1. 用 `series_registry.get(payload.series_id)` 确认序列存在。
2. 创建 `ViewRecord(view_id, series_id, view_type)`。
3. 若是 MPR 相关视图，调用 `view_group_registry.get_or_create_mpr_group_for_series()`。
4. 存入 `_view_by_id`。
5. 返回 `ViewCreateResponse(viewId=...)`。

这里最值得注意的是“不渲染”。创建 view 只是建立后端运行时对象，不代表图像已经准备好。真正的初始化放在 `set_view_size()` 之后，因为后端必须知道前端 canvas 的真实宽高。

<div class="capability-map">
  <article>
    <strong>职责窄</strong>
    <span>`ViewRegistry` 不碰像素、不碰 socket、不碰渲染，只负责 view 生命周期。</span>
  </article>
  <article>
    <strong>MPR 自动入组</strong>
    <span>AX/COR/SAG 创建时绑定同一个 `ViewGroupRecord`，共享 cursor 和 MPR 状态。</span>
  </article>
  <article>
    <strong>线程安全</strong>
    <span>内部用 `RLock` 包住 `_view_by_id`，避免多请求同时创建或删除 view 时破坏 registry。</span>
  </article>
</div>

这个函数很短，但边界非常重要。它让后端状态的生命周期可控：创建、获取、删除、按 group 枚举。关闭视口、释放 VTK session、解绑 Socket，都可以沿 `viewId` 处理。

## setSize：用真实视口尺寸触发初始化

`ViewerService.set_view_size()` 是一个容易被低估的函数。它表面上只是写入 `view.width` 和 `view.height`，实际承担“首次初始化”的职责。

前端先创建 view，再渲染 DOM，之后才能测量视口尺寸。后端拿到尺寸后，根据 view 类型初始化：

- Stack：计算默认 index、窗口、contain zoom。
- MPR：构建或读取 volume，初始化三视口的 plane、cursor、窗口和比例。
- 3D：初始化 volume render preset、四元数、zoom 和 VTK 相关状态。

这个顺序解决了一个常见问题：若后端在 `create` 时用假尺寸渲染，前端再缩放显示，hover、测量、比例尺、MPR 十字线都要补一层换算。DicomVision 直接让后端按真实 canvas 输出图像，之后所有坐标映射都基于同一个尺寸。

## OperationHandler：命令处理和渲染决策分开

`viewer_operation_handlers.py` 是项目里很精彩的一层。它把“改变状态”和“渲染什么”分开了。

核心类型只有两个：

```python
@dataclass(frozen=True)
class RenderDecision:
    mode: RenderMode
    image_format: ImageFormat = "png"
    fast_preview: bool = False
    draft_measurement: dict[str, object] | None = None

@dataclass(frozen=True)
class OperationRenderOutcome:
    primary_result: RenderedImageResult | None = None
    draft_measurement: dict[str, object] | None = None
    broadcast_view_ids: tuple[str, ...] = ()
    deferred_view_ids: tuple[str, ...] = ()
```

`RenderDecision` 是 handler 的本地判断：这次操作不渲染、渲染当前视图、广播 MPR 组、是否用 JPEG、是否 fast preview。`OperationRenderOutcome` 是对外结果：要不要直接返回当前帧，要不要让 socket hub 广播，要不要把 3D 的重渲染延迟出去。

<div class="pipeline-diagram">
  <span>ViewOperationRequest</span>
  <span>OperationHandler</span>
  <span>修改 View/Group</span>
  <span>RenderDecision</span>
  <span>OperationRenderOutcome</span>
  <span>Socket 调度</span>
</div>

`OPERATION_HANDLERS` 是一个简单的函数表：

```python
OPERATION_HANDLERS = {
    VIEW_OP_TYPE_SCROLL: _handle_scroll_operation,
    VIEW_OP_TYPE_CROSSHAIR: _handle_crosshair_operation,
    VIEW_OP_TYPE_ZOOM: _handle_zoom_operation,
    VIEW_OP_TYPE_WINDOW: _handle_window_operation,
    VIEW_OP_TYPE_MEASUREMENT: _handle_measurement_operation,
}
```

这个表比一大段 `if/elif` 更适合长期维护。新增一个工具，通常只需要新增常量、payload 字段、handler 函数和表项。

几个 handler 的设计很有代表性：

- `_handle_scroll_operation()`：Stack 改 `current_index` 后单视图渲染；MPR 滚动会移动切面或 cursor，所以广播。
- `_handle_crosshair_operation()`：MPR 十字线移动时修改 group cursor；拖动 move 阶段用 JPEG 广播，结束后回 PNG。
- `_handle_measurement_operation()`：start/move 阶段返回 `draft_measurement`，不触发重渲染；end 阶段才保存测量并渲染。
- `_handle_rotate_3d_operation()`：3D 拖动时走 fast preview，重的最终渲染交给 deferred path。

这层设计的核心思想是：交互事件不等于渲染事件。交互只是改变状态，渲染是状态变化后的输出策略。

## ViewSocketHub：渲染不是直接发，是调度

`ViewSocketHub` 是 Socket 层最值得学习的设计。它不只是 `server.emit()` 的包装，而是一个小型渲染调度器。

它维护四类状态：

- `_view_sids`：一个 view 绑定哪些 socket。
- `_sid_views`：一个 socket 订阅哪些 view。
- `_render_locks`：每个 view 一个 render lock。
- `_pending_render_requests`：渲染中又来的最新请求。

拖拽时，同一个 view 会连续收到很多 render request。直接并发渲染会造成两种问题：CPU 被中间帧打满，或者旧帧晚于新帧返回。`emit_render_for_view()` 的处理方式是：

1. 若当前 view 正在渲染，把请求合并到 pending。
2. 若没有渲染，拿 lock 开始渲染。
3. 当前帧发完后，检查 pending。
4. 只渲染 pending 里的最新合并状态。

<div class="sequence-diagram">
  <div class="sequence-participants">
    <span>Drag Move</span>
    <span>Render Lock</span>
    <span>Pending</span>
    <span>Renderer</span>
    <span>Client</span>
  </div>
  <ol>
    <li><span class="sequence-index">01</span><div><strong>第一帧拿锁</strong><p>view 没在渲染时，当前请求直接进入 `_drain_render_requests()`。</p></div></li>
    <li><span class="sequence-index">02</span><div><strong>中间帧合并</strong><p>渲染中到达的新请求进入 `_pending_render_requests`，不新开渲染线程。</p></div></li>
    <li><span class="sequence-index">03</span><div><strong>质量保底</strong><p>`_choose_render_image_format()` 用质量等级避免最终 PNG 被旧 JPEG 降级。</p></div></li>
    <li><span class="sequence-index">04</span><div><strong>最新状态获胜</strong><p>当前帧完成后，只取 pending 的最新合并请求补渲染。</p></div></li>
  </ol>
</div>

`_merge_render_request()` 的质量合并也很细。`jpeg` 等级低于 `png`，如果队列里已经有 PNG 需求，后来的旧 JPEG preview 不能把它降级。`fast_preview` 只有双方都是 fast preview 时才保持 true。这个规则保证拖动过程快，停下来的画面清楚。

渲染本身通过 `asyncio.to_thread(viewer_service.render_view_by_id, ...)` 跑到线程里，避免阻塞 Socket.IO 事件循环。进度回调再通过 `asyncio.run_coroutine_threadsafe()` 回到事件循环发 `view_progress`。这是后端交互流畅度的关键。

## ViewportTransformer：一个矩阵贯穿显示和计算

`ViewportTransformer` 的 API 很干净：

- `calculate_contain_zoom()`：算初始适配比例。
- `build_image_to_canvas_transform()`：构建图像到 canvas 的 3x3 仿射矩阵。
- `apply_affine_array()`：对 NumPy 图像重采样。
- `apply_affine()`：对 PIL overlay 图像重采样。
- `AffineTransform.inverse_components()`：给 SciPy 反向采样使用。
- `AffineTransform.to_pil_coefficients()`：给 PIL transform 使用。

精彩之处在于同一套矩阵既用于渲染，也用于反算坐标。图像显示用了缩放、平移、旋转、翻转、像素宽高比，hover 和测量就必须用同一套矩阵求逆。否则图能看，但点会偏。

矩阵组合顺序是：

```text
image center -> scale/flip -> rotate -> canvas center + pan
```

代码里有一个容易踩坑的细节：SciPy 的 `affine_transform` 使用 row/col，也就是 y/x；业务层矩阵按 x/y 理解。因此 `apply_affine_array()` 要把逆矩阵从 x/y 转成数组坐标：

```python
array_matrix = affine_matrix[[1, 0]][:, [1, 0]]
array_offset = offset[[1, 0]]
```

这个小转换非常关键。它避免了图像显示和坐标计算在轴顺序上悄悄错位。

## 测量函数：草稿、落库、序列化三段分开

测量功能没有把“鼠标移动”和“保存测量”混在一起。

`_handle_measurement_operation()` 的分支很清楚：

- `start` / `move`：调用 `_build_measurement_preview()`，返回 `draft_measurement`，不保存、不渲染。
- `end`：调用 `_handle_measurement()`，保存测量，再触发渲染。
- `delete`：删除已有测量，必要时重渲染。

测量点进入后端后，会经过 `_resolve_normalized_point_to_image_point()`。这个函数把前端归一化坐标转 canvas 坐标，再通过 `image_transform.inverse_components()` 反算回源图像点。计算完指标后，`_serialize_measurements()` 再把点投影回前端 overlay 坐标。

这是一条闭环：

<div class="pipeline-diagram">
  <span>normalized point</span>
  <span>canvas point</span>
  <span>image point</span>
  <span>metrics</span>
  <span>overlay point</span>
  <span>export overlay</span>
</div>

这个闭环保证同一个测量在屏幕显示、指标计算和导出时使用同一套几何。

## MPR 函数：复杂逻辑拆成可组合小接口

MPR 没有写成一个巨型函数。核心拆分是：

- `_get_series_volume()`：拿到标准化 volume。
- `_get_series_volume_geometry()`：拿到 volume 几何。
- `_get_mpr_cursor_state()`：拿到或初始化 cursor。
- `derive_plane_pose()`：由 cursor 和 viewport key 推导切面姿态。
- `_build_reslice_mip_config()`：由 group 状态转换成 reslice 需要的 MIP 配置。
- `reslice_plane()`：按 plane pose 从 volume 采样 2D 图。
- `_build_mpr_plane_payload()`：把切面信息序列化给前端 overlay。

这组函数让 MPR 的复杂度被拆开：volume 构建、几何表达、cursor 状态、切面派生、图像采样、前端元数据，各管一段。AX、COR、SAG、斜切面、MIP、4D phase 同步都可以复用这些接口。

![MPR 旋转与切面联动](/images/dicom-vision/mpr-rotate.png)

## 这套内部 API 的价值

DicomVision 的精彩处不在某一个算法，而在几个边界同时成立：

- 前端 API 有类型、有白名单、有专用二进制 artifact helper。
- Socket API 把高频交互统一成 `view_operation`，避免事件通道膨胀。
- `ViewRegistry` 只创建状态，`setSize` 才初始化渲染相关内容。
- `OperationHandler` 只决定状态变化和渲染策略，不直接关心 Socket 推送。
- `ViewSocketHub` 统一处理绑定、锁、pending、质量合并和进度。
- `ViewportTransformer` 让显示、hover、测量和导出共享同一套几何。
- MPR 通过小函数组合，把三维几何问题拆成可测试的部件。

这些设计让 DicomVision 更像一个影像运行时，而不是一组页面功能。界面可以继续换，工具栏可以继续加，PACS 和 QA 也可以继续扩展；只要这些内部 API 的边界稳定，项目就不会因为功能变多而失去结构。
