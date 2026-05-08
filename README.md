# Kirin Blog

An Astro personal blog starter with a clean developer-blog homepage, Markdown
content collections, and basic pages for posts, profile, projects, and tags.

## Commands

```powershell
npm install
npm run dev
npm run build
npm run preview
```

## Writing Posts

Add Markdown files to `src/content/blog`. Each post uses this frontmatter:

```yaml
---
title: Post title
description: Short summary
pubDate: 2026-05-08
readTime: 5 min read
tags:
  - Astro
featured: false
cover: astro
---
```

Supported cover values are `typescript`, `architecture`, `growth`, and `astro`.

## GitHub Remote

After creating a GitHub repository, connect it with:

```powershell
git remote add origin https://github.com/<your-user>/<repo>.git
git branch -M main
git push -u origin main
```
