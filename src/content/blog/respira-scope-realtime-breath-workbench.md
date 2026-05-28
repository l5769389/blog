---
title: RespiraScope 项目复盘：呼吸信号实时监测
description: 复盘 RespiraScope 从 TCP 呼吸传感器接入、实时滤波、峰谷识别、BPM 计算到 Web Console 展示的完整工程链路。
pubDate: 2026-05-15
readTime: 7 min read
tags:
  - Respiration
  - Signal Processing
  - FastAPI
  - Socket.IO
featured: true
cover: respira
---

RespiraScope 是一个呼吸信号采集、滤波、实时展示和记录分析工具。它既能连接真实 TCP 呼吸传感器，也内置了模拟呼吸信号，适合设备联调、算法验证、呼吸波形处理学习和前端可视化演示。

项目源码在 [l5769389/RespiraScope](https://github.com/l5769389/RespiraScope)。它的定位不是医疗诊断工具，而是面向工程验证、算法学习和设备调试的实时信号工作台。

![RespiraScope breath monitor](/images/respira-scope/breath-monitor.png)

## 项目定位

这个项目的核心目标，是把呼吸传感器的原始采样点变成可观察、可调试、可记录、可复盘的数据流。用户可以在 Monitor 中看到原始波形、滤波波形、波峰波谷、BPM 和稳定性，也可以在模拟信号页面切换正常呼吸、浅呼吸、屏气、干扰和不规则波形。

对作品集来说，RespiraScope 展示的是另一类能力：它不是影像处理，而是实时数据采集、信号滤波、事件识别、WebSocket 推送和前端图表交互的组合。

## 功能拆解

系统后端作为 TCP client 连接真实呼吸设备，也可以启用内置模拟传感器。原始数据进入队列后，实时滤波模块对滑动窗口做处理，峰谷识别模块计算呼吸周期、BPM 和稳定性，再通过 Socket.IO `/breath` 命名空间推送给 Web Console。

Web Console 是单一入口，包含 Monitor、模拟信号设置、使用指南和接口文档。这样部署时不用分发多个前端页面，使用者打开一个地址就能完成监测、调试和集成查看。

<div class="image-grid">
  <figure>
    <img src="/images/respira-scope/breath-monitor.png" alt="RespiraScope real-time breath monitor" />
    <figcaption>实时呼吸监测</figcaption>
  </figure>
  <figure>
    <img src="/images/respira-scope/mock-signal-setting.png" alt="RespiraScope mock signal settings" />
    <figcaption>模拟信号设置</figcaption>
  </figure>
  <figure>
    <img src="/images/respira-scope/breath-record.png" alt="RespiraScope breath record review" />
    <figcaption>记录片段复盘</figcaption>
  </figure>
  <figure>
    <img src="/images/respira-scope/abnormal-respiratory-signals.png" alt="RespiraScope abnormal respiratory signal handling" />
    <figcaption>异常信号观察</figcaption>
  </figure>
</div>

## 技术架构

后端使用 FastAPI、python-socketio、Pydantic 和 uv 管理依赖。核心模块分为配置读取、应用创建、TCP 数据接收、实时滤波、离线滤波、峰谷识别、记录缓存、HTTP API 和 Socket.IO 推送。

前端采用静态 Web Console 的形式，由后端启动并注入运行时配置。配置不依赖 `.env`，默认从 `D:/ct/breath-config/breath.toml` 或 `/ct/breath-config/breath.toml` 读取，这样更适合 exe 和部署环境：程序包保持不变，外部配置按环境替换。

启动时如果后端端口被占用，程序会自动寻找下一个可用端口，并通过 `/runtime-config.js` 把实际端口告诉前端，避免前端写死配置导致连接失败。

## 难点与取舍

实时滤波和离线滤波的目标不同。实时滤波要低延迟，适合当前画面展示；离线滤波可以在 Record End 后用更完整的上下文复算，让记录片段更平滑，峰谷位置也更适合复盘。

峰谷识别同样需要在“及时反馈”和“稳定判断”之间取舍。算法既要尽快输出 peak / valley / BPM，又要避免噪声、咳嗽伪影和短时干扰造成误判。所以项目里保留了模拟信号和异常场景，用来反复观察算法在边界情况下的表现。

![RespiraScope cough artifact preview](/images/respira-scope/cough-artifact.png)

## 复盘收获

RespiraScope 的价值在于把传感器、算法和界面放进同一条可调试链路里。单独写一个滤波函数并不难，真正影响体验的是数据从哪里来、以什么节奏处理、怎样推给前端、出现异常时如何解释，以及记录结束后如何复盘。

这个项目的工程价值集中在实时链路的完整性：从传感器输入到滤波、事件识别、指标计算、前端展示和记录复算，每一段都能独立调试，也能组合成完整的使用流程。
