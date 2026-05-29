---
title: "RespiraScope 设计复盘：类关系与实时链路"
description: "RespiraScope 的核心不是单个滤波函数，而是 DataReceiver、SignalProcessor、PeakValleyDetector、RecordManager 和 DataSender 之间的实时协作。"
pubDate: 2026-05-24
readTime: "8 min read"
tags: ["RespiraScope", "Signal Processing", "FastAPI", "Socket.IO"]
featured: true
cover: "respira"
---

RespiraScope 的代码可以按一条实时数据链路读：

传感器产生原始点，后端给点编号，实时滤波，识别波峰波谷，计算 BPM 和稳定性，同时把原始数据、滤波数据、事件、指标、记录片段推给 Web Console。

这个项目的关键不是某个滤波函数，而是这些类怎样协作。

![RespiraScope 实时监测](/images/respira-scope/breath-monitor.png)

## 核心类关系

<div class="architecture-diagram">
  <section>
    <h3>输入</h3>
    <div class="diagram-node primary">DataReceiver</div>
    <div class="diagram-node">AsyncSocketClient</div>
    <div class="diagram-note">连接真实 TCP 传感器，给每个点分配 sequence。</div>
  </section>
  <section>
    <h3>处理</h3>
    <div class="diagram-node primary">SignalProcessor</div>
    <div class="diagram-node">RealtimeFilterStrategy</div>
    <div class="diagram-note">滑动窗口实时滤波，低延迟优先。</div>
  </section>
  <section>
    <h3>识别</h3>
    <div class="diagram-node primary">PeakValleyDetector</div>
    <div class="diagram-node">BreathRateCalculator</div>
    <div class="diagram-note">峰谷识别，输出 BPM 和稳定性。</div>
  </section>
  <section>
    <h3>记录</h3>
    <div class="diagram-node primary">RecordManager</div>
    <div class="diagram-node">OfflineFilterStrategy</div>
    <div class="diagram-note">保存 record 区间，结束后离线复算。</div>
  </section>
  <section>
    <h3>推送</h3>
    <div class="diagram-node primary">DataSender</div>
    <div class="diagram-node">Socket.IO /breath</div>
    <div class="diagram-note">批量推送 raw、filtered、peak、valley、metrics。</div>
  </section>
</div>

`BreathProcessSystem` 是装配器。它在初始化时创建这些对象，并用 handler 关系把它们串起来：

- `DataReceiver` 的输出给 `DataQueueManager`、`RecordManager`、`SignalQualityAnalyzer`、`SignalProcessor`。
- `SignalProcessor` 的输出给 `DataQueueManager`、`RecordManager`、`PeakValleyDetector`。
- `PeakValleyDetector` 的输出给 `PeakValleyHandler` 和 `RecordManager`。
- `PeakValleyHandler` 再把 peak、valley、metrics 写入 `DataQueueManager`。
- `DataSender` 周期性读取队列，通过 Socket.IO 推给前端。

这是一种很直接的管线式设计。每个类负责一段，类之间用 `handle_data`、`handle_filtered_data`、`handle_peak`、`handle_valley` 这类小接口连接。

## 启动流程

<div class="sequence-diagram">
  <div class="sequence-participants">
    <span>HTTP</span>
    <span>System</span>
    <span>Receiver</span>
    <span>Processor</span>
    <span>Sender</span>
  </div>
  <ol>
    <li><span class="sequence-index">01</span><div><strong>`POST /startReceive`</strong><p>接口接收 `FilterConfig`，调用 `BreathProcessSystem.start(config)`。</p></div></li>
    <li><span class="sequence-index">02</span><div><strong>同步参数</strong><p>`SignalProcessor` 更新滤波配置，`PeakValleyDetector` 同步采样率、BPM 范围、峰值阈值和确认延迟。</p></div></li>
    <li><span class="sequence-index">03</span><div><strong>挂载 handler</strong><p>`DataReceiver` 将原始点分发给队列、记录、质量分析和滤波器。</p></div></li>
    <li><span class="sequence-index">04</span><div><strong>启动任务</strong><p>系统确保 receiver、processor、sender 三类 asyncio task 存在。</p></div></li>
    <li><span class="sequence-index">05</span><div><strong>实时推送</strong><p>`DataSender` 每 40ms 批量推送队列里的数据，前端按类型更新图表。</p></div></li>
  </ol>
</div>

## 数据队列的作用

`DataQueueManager` 同时做两件事：实时队列和最近数据快照。

实时队列包括 `raw_data_queue`、`filter_data_queue`、`peak_queue`、`valley_queue`、`metrics_queue`、`signal_quality_queue`。每个队列都有上限，满了会记录 dropped count，而不是无限堆积。

最近数据快照保存在 deque 里。新 Socket 连接进来时，`socket_io_service` 可以调用 snapshot provider，把最近一段 raw、filtered、marker、metrics 先发给前端。这样页面刷新后，不必等新数据慢慢填满图表。

<div class="pipeline-diagram">
  <span>raw point</span>
  <span>queue</span>
  <span>recent deque</span>
  <span>batch sender</span>
  <span>Socket.IO</span>
  <span>Monitor</span>
</div>

## 滤波分成实时和离线

`SignalProcessor` 有两个策略：`RealtimeFilterStrategy` 和 `OfflineFilterStrategy`。

实时滤波使用滑动窗口。默认 `window_size = 2000`，`step_size = 5`，每 40ms 检查一次新数据。数据不足 `FILTER_STARTUP_DELAY` 时不急着输出，避免短片段滤波不稳定。实时模式使用因果滤波，低延迟优先，但峰谷位置可能有轻微滞后。

离线滤波用于 Record End 后复盘。它可以使用完整记录片段和前后辅助点，用双向滤波得到更平滑的结果。这个设计很实际：实时页要及时，复盘页要准确。

![记录复盘](/images/respira-scope/breath-record.png)

## 峰谷识别

`PeakValleyDetector` 使用 `scipy.signal.find_peaks`。找波峰时对滤波数据找 peaks，找波谷时对负信号找 peaks。

它不是直接把所有候选点都发出去。代码里有几层保护：

- 用 `high_bpm` 推导最小峰间距，避免把太近的小抖动当成呼吸周期。
- 用信号跨度和差分噪声估算 adaptive prominence。
- 实时模式下避免同类型事件连续输出。
- 离线模式用 `_collapse_alternating_events()` 折叠连续同类型事件，只保留更强的那个。
- 开启 `confirm_realtime_events` 时，会等待 `confirmation_delay_points` 后再确认事件。

`BreathRateCalculator` 只根据最近若干个 peak 的 sequence 间隔计算 BPM。稳定性用间隔变异系数分级：stable、variable、irregular、insufficient。

## RecordManager 的边界

`RecordManager` 不只是“保存一段数组”。它记录的是一段有上下文的呼吸片段。

记录开始前，它会保留 `pre_points`。记录结束后，它会继续等待 `post_points`。最终文件里会区分：

- `record_start_sequence` 和 `record_end_sequence`：Record Start 到 Record End 的真实记录范围。
- `capture_start_sequence` 和 `capture_end_sequence`：实际保存范围，包含前后辅助点。
- `segments`：pre、record、post 三段。
- `scans`：记录过程中标注的扫描子区间。
- `raw_data`、`filtered_data`、`peak`、`valley`、`metrics`。

这个设计让记录复盘不只是一张波形截图。它能保留“哪些点属于真实记录区间，哪些点只是为了滤波上下文保留”。

## 模拟信号为什么重要

RespiraScope 内置 `AsyncSimulateSensor` 和 `MockBreathController`。这不是演示功能，而是工程保障。

真实传感器调试不稳定，异常场景也不可控。模拟信号能构造正常呼吸、浅呼吸、屏气、体动伪影、咳嗽等场景，用来观察滤波、峰谷识别和 BPM 指标。

![模拟信号设置](/images/respira-scope/mock-signal-setting.png)

异常信号尤其有价值。它能暴露两个问题：实时滤波是否过度平滑，峰谷识别是否把干扰当成呼吸。

![异常呼吸信号](/images/respira-scope/abnormal-respiratory-signals.png)

## 设计复盘

RespiraScope 的结构朴素，但边界是清楚的：

- `DataReceiver` 只管输入和编号。
- `SignalProcessor` 只管滤波。
- `PeakValleyDetector` 只管事件识别。
- `BreathRateCalculator` 只管指标。
- `RecordManager` 只管记录区间和离线复算上下文。
- `DataQueueManager` 只管队列与快照。
- `DataSender` 只管批量推送。
- `BreathProcessSystem` 只管装配和生命周期。

这个设计里最值得学习的是“实时链路的可解释性”。每个点从输入、编号、滤波、识别、记录到推送都有明确归属。handler 协议、模拟信号和离线复算共同保证了一件事：系统不只是能画出波形，还能解释这段波形从哪里来、经过了哪些处理、哪些点属于真实记录区间。

RespiraScope 适合作为实时信号系统的练习样本：类不复杂，但每一段都有时间、队列、延迟和状态边界。
