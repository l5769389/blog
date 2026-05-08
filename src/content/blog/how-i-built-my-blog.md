---
title: How I Built My Blog
description: A behind-the-scenes look at how I built this blog with Astro, Markdown content, and a restrained design system.
pubDate: 2024-04-28
readTime: 8 min read
tags:
  - Astro
  - CSS
  - Notes
featured: true
cover: architecture
---

I wanted this blog to feel quiet, fast, and easy to maintain. Astro is a good
fit for that: pages render to static HTML by default, Markdown content lives
beside the source code, and components stay small.

The design started from a few constraints. Use plenty of whitespace, keep the
navigation obvious, make article cards scan quickly, and avoid turning the
homepage into a product pitch.

The result is a small system: one layout, a header, reusable post cards, a
profile card, and a content collection that makes publishing new writing
straightforward.
