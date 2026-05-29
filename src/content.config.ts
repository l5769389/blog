import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    readTime: z.string(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    cover: z.enum(['typescript', 'architecture', 'growth', 'astro', 'dicom', 'respira', 'note']).default('astro'),
    series: z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      role: z.enum(['overview', 'part']).default('part'),
      order: z.number().int().positive().optional(),
    }).optional(),
  }),
});

export const collections = { blog };
