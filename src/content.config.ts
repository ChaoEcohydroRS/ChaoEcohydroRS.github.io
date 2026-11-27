import { defineCollection, type SchemaContext } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const link = z.object({ label: z.string(), href: z.url(), note: z.string().optional() });

/** One Markdown file per project in src/content/projects/. The body is the long explanation. */
const projects = defineCollection({
	loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
	schema: ({ image }: SchemaContext) =>
		z.object({
			order: z.number(),
			/** The project question, used as the page title. */
			title: z.string(),
			/** Short name used in navigation and in the homepage figure links. */
			short: z.string(),
			summary: z.string(),
			status: z.string(),
			region: z.string(),
			data: z.array(z.string()),
			contribution: z.string(),
			baseline: z.string(),
			test: z.string(),
			uncertain: z.array(z.string()),
			/** Optional figure: a file next to the Markdown file, plus alt text and a caption. */
			figure: z.object({ src: image(), alt: z.string(), caption: z.string() }).optional(),
			links: z.array(link).default([]),
		}),
});

/** Free-standing pages written in Markdown (teaching, future research). */
const pages = defineCollection({
	loader: glob({ base: './src/content/pages', pattern: '**/*.md' }),
	schema: z.object({ title: z.string(), description: z.string(), interests: z.array(z.string()).optional() }),
});

export const collections = { projects, pages };
