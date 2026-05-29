import type { CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;

export interface BlogListEntry {
  kind: 'post' | 'series';
  id: string;
  href: string;
  title: string;
  description: string;
  pubDate: Date;
  readTime: string;
  tags: string[];
  featured: boolean;
  cover: BlogPost['data']['cover'];
  posts: BlogPost[];
  overviewPost?: BlogPost;
  childPosts: BlogPost[];
}

export function sortPosts(posts: BlogPost[]) {
  return [...posts].sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}

export function sortSeriesPosts(posts: BlogPost[]) {
  return [...posts].sort((a, b) => {
    const orderA = a.data.series?.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.data.series?.order ?? Number.MAX_SAFE_INTEGER;

    return orderA - orderB || a.data.pubDate.valueOf() - b.data.pubDate.valueOf();
  });
}

export function postToBlogEntry(post: BlogPost): BlogListEntry {
  return {
    kind: 'post',
    id: post.id,
    href: `/blog/${post.id}/`,
    title: post.data.title,
    description: post.data.description,
    pubDate: post.data.pubDate,
    readTime: post.data.readTime,
    tags: post.data.tags,
    featured: post.data.featured,
    cover: post.data.cover,
    posts: [post],
    childPosts: [],
  };
}

export function getSeriesEntries(posts: BlogPost[]) {
  const groups = new Map<string, BlogPost[]>();

  for (const post of posts) {
    const seriesId = post.data.series?.id;

    if (!seriesId) {
      continue;
    }

    groups.set(seriesId, [...(groups.get(seriesId) ?? []), post]);
  }

  return [...groups.entries()]
    .filter(([, seriesPosts]) => seriesPosts.length > 1)
    .map(([seriesId, seriesPosts]) => {
      const sortedSeriesPosts = sortSeriesPosts(seriesPosts);
      const overviewPost = sortedSeriesPosts.find((post) => post.data.series?.role === 'overview');
      const childPosts = overviewPost
        ? sortedSeriesPosts.filter((post) => post.id !== overviewPost.id)
        : sortedSeriesPosts;
      const leadPost = overviewPost ?? sortedSeriesPosts[0];
      const latestPost = sortPosts(seriesPosts)[0];
      const series = leadPost.data.series;

      if (!series) {
        throw new Error(`Missing series metadata for ${leadPost.id}`);
      }

      return {
        kind: 'series',
        id: seriesId,
        href: `/blog/series/${seriesId}/`,
        title: series.title,
        description: series.description ?? leadPost.data.description,
        pubDate: latestPost.data.pubDate,
        readTime: getTotalReadTime(seriesPosts),
        tags: getUniqueTags(sortedSeriesPosts),
        featured: seriesPosts.some((post) => post.data.featured),
        cover: leadPost.data.cover,
        posts: sortedSeriesPosts,
        overviewPost,
        childPosts,
      } satisfies BlogListEntry;
    })
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}

export function getBlogEntries(posts: BlogPost[]) {
  const seriesEntries = getSeriesEntries(posts);
  const groupedPostIds = new Set(seriesEntries.flatMap((entry) => entry.posts.map((post) => post.id)));
  const postEntries = posts
    .filter((post) => !groupedPostIds.has(post.id))
    .map((post) => postToBlogEntry(post));

  return [...seriesEntries, ...postEntries].sort(
    (a, b) => b.pubDate.valueOf() - a.pubDate.valueOf(),
  );
}

export function getFeaturedBlogEntries(posts: BlogPost[], limit = 3) {
  return getBlogEntries(posts).filter((entry) => entry.featured).slice(0, limit);
}

function getTotalReadTime(posts: BlogPost[]) {
  const totalMinutes = posts.reduce((total, post) => {
    const minutes = Number.parseInt(getReadMinutes(post.data.readTime), 10);

    return Number.isNaN(minutes) ? total : total + minutes;
  }, 0);

  return totalMinutes > 0 ? `${totalMinutes} min read` : sortPosts(posts)[0].data.readTime;
}

function getUniqueTags(posts: BlogPost[]) {
  return [...new Set(posts.flatMap((post) => post.data.tags))];
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
