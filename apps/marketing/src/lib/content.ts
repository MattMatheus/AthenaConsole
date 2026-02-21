import type { CollectionEntry } from 'astro:content';
import { getCollection } from 'astro:content';

export type BlogEntry = CollectionEntry<'blog'>;
export type DocsEntry = CollectionEntry<'docs'>;

export const BLOG_POSTS_PER_PAGE = 6;

export const getPublishedPosts = async (): Promise<BlogEntry[]> => {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
};

export const slugifyTag = (tag: string): string =>
  tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const getTagSummary = (posts: BlogEntry[]) => {
  const tags = new Map<string, { tag: string; slug: string; count: number }>();

  for (const post of posts) {
    for (const tag of post.data.tags) {
      const slug = slugifyTag(tag);
      const current = tags.get(slug);
      if (current) {
        current.count += 1;
      } else {
        tags.set(slug, { tag, slug, count: 1 });
      }
    }
  }

  return [...tags.values()].sort((a, b) => a.tag.localeCompare(b.tag));
};

export const getPostsByTagSlug = (posts: BlogEntry[], tagSlug: string): BlogEntry[] =>
  posts.filter((post) => post.data.tags.some((tag) => slugifyTag(tag) === tagSlug));

export const getArchiveSummary = (posts: BlogEntry[]) => {
  const years = new Map<string, number>();

  for (const post of posts) {
    const year = String(post.data.pubDate.getFullYear());
    years.set(year, (years.get(year) ?? 0) + 1);
  }

  return [...years.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => Number(b.year) - Number(a.year));
};

export const getPostsByYear = (posts: BlogEntry[], year: string): BlogEntry[] =>
  posts.filter((post) => String(post.data.pubDate.getFullYear()) === year);

export const getTotalPages = (totalItems: number, perPage: number): number =>
  Math.max(1, Math.ceil(totalItems / perPage));

export const getPageItems = <T>(items: T[], pageNumber: number, perPage: number): T[] => {
  const start = (pageNumber - 1) * perPage;
  return items.slice(start, start + perPage);
};

interface GetSortedDocsOptions {
  includeInternal?: boolean;
}

export const getSortedDocs = async ({
  includeInternal = false,
}: GetSortedDocsOptions = {}): Promise<DocsEntry[]> => {
  const docs = await getCollection('docs', ({ data }) => includeInternal || data.audience === 'public');
  return docs.sort((a, b) => {
    if (a.data.sectionOrder !== b.data.sectionOrder) {
      return a.data.sectionOrder - b.data.sectionOrder;
    }
    if (a.data.section !== b.data.section) {
      return a.data.section.localeCompare(b.data.section);
    }
    return a.data.order - b.data.order;
  });
};

export const getDocsSections = (docs: DocsEntry[]) => {
  const sectionMap = new Map<string, DocsEntry[]>();

  for (const doc of docs) {
    if (!sectionMap.has(doc.data.section)) {
      sectionMap.set(doc.data.section, []);
    }
    sectionMap.get(doc.data.section)?.push(doc);
  }

  return [...sectionMap.entries()].map(([section, sectionDocs]) => ({
    section,
    docs: sectionDocs.sort((a, b) => a.data.order - b.data.order),
  }));
};
