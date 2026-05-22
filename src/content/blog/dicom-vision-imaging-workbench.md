---
title: DicomVision 项目复盘：医学影像工作台
description: 从 DICOM 阅片、MPR 重建、测量、标签检查到 QA 分析，复盘 DicomVision 作为医学影像工具的产品形态和技术取舍。
pubDate: 2026-05-08
readTime: 7 min read
tags:
  - DICOM
  - Medical Imaging
  - Vue
  - FastAPI
featured: true
cover: dicom
---

DicomVision 是一个面向 DICOM 影像浏览、重建、测量和 QA 分析的工作台。它不是单纯的图片查看器，而是围绕“加载序列、组织视口、实时交互、重建分析、导出复盘”这条链路做的一套 C/S 工具。

项目目前拆成两个公开仓库：[DicomVisionClient](https://github.com/l5769389/DicomVisionClient) 和 [DicomVisionServer](https://github.com/l5769389/DicomVisionServer)。客户端负责 Electron / Vue 工作区和交互，服务端负责 DICOM 解析、图像渲染、MPR/4D/3D 计算、测量分析和实时推送。

![DicomVision dark theme workspace](/images/dicom-vision/theme-dark.png)

## 项目定位

这个项目想解决的是影像数据从“能打开”到“能分析”的过程。基础功能包括 Stack 阅片、窗宽窗位、缩放平移、旋转翻转、布局视口、序列管理和角标信息；进一步的能力则扩展到 MPR、斜切 MPR、4D 时相播放、3D 体渲染、ROI/几何测量、DICOM Tag 检查、MTF/FWHM 和水模 QA。

它比较适合作品集展示的原因，是产品边界足够清楚：前端不是静态展示页，后端也不是简单 CRUD，而是包含实时图像计算、状态同步和复杂交互的完整工程。

## 功能拆解

Stack 阅片是整个工具的底座。用户加载本地文件夹或服务端样例数据后，服务端发现可读 DICOM 序列并返回元数据，前端把不同序列组织成可切换的工作区视图。

MPR 和斜切 MPR 是更能体现工程复杂度的部分。三个正交视口需要保持十字线同步，旋转、缩放、切片位置和方向标要同时更新。4D 时相播放则进一步引入时相缓存、播放控制、FPS 调整和多视口联动。

<div class="image-grid">
  <figure>
    <img src="/images/dicom-vision/stack.png" alt="DicomVision stack viewing workspace" />
    <figcaption>Stack 阅片工作区</figcaption>
  </figure>
  <figure>
    <img src="/images/dicom-vision/mpr.png" alt="MPR reconstruction in DicomVision" />
    <figcaption>MPR 三视图重建</figcaption>
  </figure>
  <figure>
    <img src="/images/dicom-vision/mpr-rotate.png" alt="Oblique MPR crosshair rotation in DicomVision" />
    <figcaption>斜切 MPR 与十字线旋转</figcaption>
  </figure>
  <figure>
    <img src="/images/dicom-vision/4d.png" alt="DicomVision 4D phase playback" />
    <figcaption>4D 时相播放</figcaption>
  </figure>
</div>

## 技术架构

前端使用 Vue 3、TypeScript、Electron、electron-vite、Vuetify、Tailwind CSS、Axios 和 Socket.IO Client。它主要负责工作区状态、视口生命周期、工具栏交互、布局管理和桌面端打包。

后端使用 FastAPI、Socket.IO、pydicom、NumPy、Pillow 和 VTK。它把 DICOM 发现、元数据服务、2D 渲染、MPR/4D/3D 计算、测量分析和实时事件推送集中在服务端，让 Web 端和桌面端可以复用同一套处理逻辑。

这样的拆分让项目可以同时支持 Web 部署和 Windows 桌面应用。桌面版通过 Electron 启动本地内置后端，Web 版则连接远程 HTTP + Socket.IO 服务。

## 难点与取舍

这个项目的难点不只在“显示图像”，更在于一连串状态同步：视口有生命周期，用户操作会持续改变图像变换参数，后端需要返回渲染帧、叠加层、错误和确认事件。为了让交互稳定，前后端之间不能只靠一次性 HTTP 请求，而需要 Socket.IO 承担实时反馈。

另一个取舍是把计算放在后端。这样前端更轻，桌面端和 Web 端能复用逻辑，也方便引入 Python 生态里的影像处理库。但代价是要处理会话、缓存、请求时序和渲染延迟。

<div class="image-grid">
  <figure>
    <img src="/images/dicom-vision/measure.png" alt="Measurement tools in DicomVision" />
    <figcaption>ROI 与几何测量</figcaption>
  </figure>
  <figure>
    <img src="/images/dicom-vision/dicom-tags.png" alt="DICOM tag inspection in DicomVision" />
    <figcaption>DICOM 标签检查</figcaption>
  </figure>
  <figure>
    <img src="/images/dicom-vision/mtf.png" alt="MTF analysis in DicomVision" />
    <figcaption>MTF / FWHM 分析</figcaption>
  </figure>
  <figure>
    <img src="/images/dicom-vision/water-phantom-qa.png" alt="Water phantom QA in DicomVision" />
    <figcaption>水模 QA 流程</figcaption>
  </figure>
</div>

## 复盘收获

DicomVision 让我重新意识到：复杂工具的关键不是把功能堆满，而是让数据流、视口状态和用户操作保持一致。影像工具尤其需要“可解释的稳定性”，因为用户每一次滚动、测量、重建和导出都依赖同一套底层状态。

如果继续迭代，我会优先补强三块内容：第一是把 MPR 几何和十字线同步写成更清晰的技术笔记；第二是给测量和 QA 流程补更多可验证样例；第三是完善 Web / 桌面两种部署形态下的性能和错误处理。
