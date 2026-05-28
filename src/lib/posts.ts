import type { CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;

export function sortPosts(posts: BlogPost[]) {
  return [...posts].sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}

export function formatDate(date: Date) {
  return formatDateEn(date);
}

export function formatDateEn(date: Date) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatDateZh(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function getReadMinutes(readTime: string) {
  return readTime.match(/\d+/)?.[0] ?? readTime;
}

export function formatReadTimeEn(readTime: string) {
  const minutes = getReadMinutes(readTime);
  return /^\d+$/.test(minutes) ? `${minutes} min read` : readTime;
}

export function formatReadTimeZh(readTime: string) {
  const minutes = getReadMinutes(readTime);
  return /^\d+$/.test(minutes) ? `约 ${minutes} 分钟阅读` : readTime;
}

export function slugifyTag(tag: string) {
  return tag.toLowerCase().replaceAll(' ', '-');
}
