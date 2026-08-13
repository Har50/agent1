import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';

export function DocsMDX({ source }: { source: string }) {
  return (
    <article className="docs-prose prose prose-invert max-w-none prose-headings:font-display prose-headings:tracking-tight prose-a:text-cyan-400 prose-code:text-cyan-200 prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800">
      <MDXRemote
        source={source}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
          },
        }}
      />
    </article>
  );
}
