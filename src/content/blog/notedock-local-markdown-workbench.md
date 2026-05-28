---
title: noteDock 项目复盘：本地优先的 Markdown 工作台
description: 复盘 noteDock 从 Markdown 编辑预览、本地文件管理、文档预览到图形嵌入和知识关系整理的桌面工具形态。
pubDate: 2026-05-27
readTime: 7 min read
tags:
  - Electron
  - Markdown
  - React
  - Knowledge Tools
featured: true
cover: note
---

noteDock 是一个本地优先的 Markdown 笔记和文档阅读工具。它的目标不是把笔记放进复杂的云端系统，而是把写作、预览、素材插入、文件管理和知识关系整理放在一个安静的桌面工作区里。

项目源码在 [l5769389/note](https://github.com/l5769389/note)。整体技术栈以 Electron、React、TypeScript 和 electron-vite 为基础，编辑体验围绕 Markdown、文档预览和图形化内容组织展开。

![noteDock todo card mockup](/images/note-dock/todo-card-mockup.png)

## 产品定位

noteDock 的核心场景是个人知识库和本地文档工作台。它需要同时覆盖三类动作：快速写 Markdown、管理工作区文件、在同一个界面中查看 PDF、Word、Excel、HTML 等不同资料。

这类工具的难点不在单个编辑器组件，而在于让不同内容类型之间的切换足够自然。用户可能刚写完一段笔记，又需要插入图片、补一个 Excalidraw 草图、查看一个 PDF 参考文件，或者通过 wiki link 跳到相关文档。

## 编辑与预览

编辑区提供 Markdown 编辑、预览和接近 Typora 的沉浸式写作体验。项目中使用了 Milkdown、Radix UI 和自定义组件来组合编辑器、工具栏、弹窗和文件面板，让桌面应用保持轻量但不单薄。

图片插入是一个很小但很关键的体验点。noteDock 会把图片素材写入本地工作区，并自动生成 Markdown 引用，避免用户在文件路径和编辑内容之间来回切换。

## 文档工作区

noteDock 不只处理 `.md` 文件，也包含 PDF、Word、Excel 和 HTML 的只读预览能力。这样做的价值在于，笔记和资料可以被放在同一个目录结构中，而不是被拆散到多个应用里。

工作区侧边栏承担了文件树、最近文件、目录切换和状态展示的职责。桌面应用如果缺少稳定的文件上下文，编辑器再好也会变成一个孤岛；noteDock 的重点是让“写”和“找”在同一个节奏里完成。

## 图形内容

项目集成了 Excalidraw、Mermaid、React Flow 和思维导图能力，用来补足 Markdown 在结构化表达上的边界。

对工程笔记来说，纯文字经常不够。流程、依赖关系、接口流向和状态迁移更适合被画出来。noteDock 把这些图形能力作为内容块嵌入，而不是独立的外部工具，减少了整理项目笔记时的割裂感。

## 知识关系

noteDock 还包含 wiki link、标签、frontmatter、反向链接和文档元数据解析。这部分让它从“文件编辑器”开始向“个人知识库”靠近。

相比复杂的知识图谱，当前更重要的是保持可解释：每篇文档有哪些标签、链接到哪些页面、被哪些页面引用、是否有结构化元数据。这些信息如果能稳定地跟随文件，就能为搜索、导航和复盘提供基础。

## 工程取舍

Electron 提供了桌面能力和本地文件访问，React 负责复杂 UI 状态，TypeScript 让编辑器、预览器、文件系统桥接和知识模型之间的边界更清晰。项目里同时存在多种内容查看器，所以组件边界和状态同步比单页 Web 应用更重要。

noteDock 展示的是另一类作品集能力：不是单一算法或单一页面，而是围绕个人工作流构建一个可持续扩展的桌面产品。它把编辑器、文件系统、知识关系和多格式预览连接在一起，形成一个偏实用工具的完整工程样本。
