---
title: 在 Markdown 中组织图片、动画、视频和代码
description: 测试 Blog 文章中图片、CSS 动画、视频播放器和代码块的显示效果，观察它们在深色主题和宽屏阅读区中的表现。
pubDate: 2026-05-22
readTime: 6 min read
tags:
  - Markdown
  - Media
  - Animation
  - Code
featured: false
cover: note
---

Markdown 很适合写文字，但工程笔记经常需要混合图片、草图、流程说明、交互演示、视频和代码。这个页面专门用来测试 Blog 的富内容显示效果。

noteDock 的方向是让媒体内容跟随文档，而不是散落在不同工具里。图片、动画、视频和代码都应该能被插入、预览和再次编辑。

## 图片自动插入

图片是最常见的素材类型。真正影响体验的是路径管理：图片保存到哪里、Markdown 引用如何生成、文件移动后是否还能找到。

![noteDock todo card mockup](/images/note-dock/todo-card-mockup.png)

自动插入能力可以把这些琐碎步骤收起来，让用户只关注内容本身。对项目复盘来说，截图和说明文字能快速形成上下文，尤其适合记录 UI 演进和问题定位过程。

## 动画演示

有些概念用静态截图不够直观，可以在文章中放一个轻量的 CSS 动画，用来表达数据流、任务状态或者交互反馈。

<div class="motion-demo" aria-label="Animated workflow demo">
  <div class="motion-track">
    <span></span>
    <span></span>
    <span></span>
  </div>
  <div class="motion-panel">
    <strong>Local-first workflow</strong>
    <small>Write → Preview → Link → Review</small>
  </div>
</div>

这个动画不依赖图片资源，适合作为文章中的视觉测试：它需要在深色主题下保持清晰，又不能抢走正文阅读的注意力。

## 视频播放

视频适合展示完整操作路径，比如从打开工作区、编辑 Markdown、插入图片到导出内容的连续过程。这里先放一个测试视频，检查播放器尺寸、边框、圆角和深色模式下的控制条表现。

<video controls muted loop playsinline poster="/images/note-dock/todo-card-mockup.png">
  <source src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" type="video/mp4" />
  当前浏览器不支持视频播放。
</video>

正式项目复盘里可以把这块换成自己的屏幕录制，比如 noteDock 的编辑器切换、DicomVision 的 MPR 交互，或者 RespiraScope 的实时波形监测。

## 代码块

工程笔记里代码块要能承载配置、伪代码和关键实现片段。下面是一个 TypeScript 示例，用来测试长行、缩进、注释和深色主题可读性。

```ts
type DocumentNode = {
  id: string;
  title: string;
  tags: string[];
  links: string[];
  updatedAt: string;
};

export function collectBacklinks(nodes: DocumentNode[], targetId: string) {
  return nodes
    .filter((node) => node.links.includes(targetId))
    .map((node) => ({
      id: node.id,
      title: node.title,
      updatedAt: node.updatedAt,
    }));
}
```

命令行片段也很常见，例如本地启动、构建和预览：

```bash
npm install
npm run dev
npm run build
```

如果后续加入语法高亮，也应该优先保证行高、背景、边框和移动端横向滚动体验稳定。

## Mermaid 与 React Flow

Mermaid 更适合文本化、可版本管理的图表，例如流程图、时序图和状态图。React Flow 则更适合交互式节点关系，适合展示复杂依赖和可视化编辑场景。

这两类能力服务于不同层次：Mermaid 让结构和代码一样可读可 diff，React Flow 让关系图可以被交互和重排。组合起来后，Markdown 就能承载更丰富的工程表达。

## 内容工作流

一个成熟的笔记工具不应该只问“能不能写”，还要问“写完之后如何被再次理解”。图片、动画、视频和代码让笔记更接近真实项目现场，也让后续复盘更容易展开。
