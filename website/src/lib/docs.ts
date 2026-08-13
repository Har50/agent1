import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const CONTENT_ROOT = path.join(process.cwd(), 'content/docs');

export type DocMeta = {
  title: string;
  description?: string;
  slug: string[];
};

export type DocPage = DocMeta & {
  content: string;
};

export function getDocBySlug(slug: string[]): DocPage | null {
  const candidates = [
    path.join(CONTENT_ROOT, ...slug) + '.mdx',
    path.join(CONTENT_ROOT, ...slug, 'index.mdx'),
  ];
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) return null;

  const raw = fs.readFileSync(file, 'utf8');
  const { data, content } = matter(raw);
  return {
    title: String(data.title ?? slug[slug.length - 1] ?? 'Docs'),
    description: data.description ? String(data.description) : undefined,
    slug,
    content,
  };
}

export function listDocSlugs(): string[][] {
  const out: string[][] = [];

  function walk(dir: string, parts: string[]) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), [...parts, entry.name]);
      } else if (entry.name.endsWith('.mdx')) {
        const base = entry.name.replace(/\.mdx$/, '');
        if (base === 'index') out.push(parts);
        else out.push([...parts, base]);
      }
    }
  }

  walk(CONTENT_ROOT, []);
  return out;
}
