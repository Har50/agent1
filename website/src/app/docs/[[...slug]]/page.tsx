import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { DocsMDX } from '@/components/docs/DocsMDX';
import { getDocBySlug, listDocSlugs } from '@/lib/docs';

type Props = { params: { slug?: string[] } };

export function generateStaticParams() {
  return listDocSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const slug = params.slug ?? [];
  if (slug.length === 0) {
    return { title: 'Documentation — AgentExec' };
  }
  const doc = getDocBySlug(slug);
  if (!doc) return { title: 'Docs — AgentExec' };
  return {
    title: `${doc.title} — AgentExec Docs`,
    description: doc.description,
  };
}

export default function DocsPage({ params }: Props) {
  const slug = params.slug ?? [];
  if (slug.length === 0) {
    redirect('/docs/getting-started/overview');
  }

  const doc = getDocBySlug(slug);
  if (!doc) notFound();

  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
        {slug.join(' / ')}
      </p>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">
        {doc.title}
      </h1>
      {doc.description ? (
        <p className="mt-3 text-lg text-slate-400">{doc.description}</p>
      ) : null}
      <div className="mt-8">
        <DocsMDX source={doc.content} />
      </div>
    </div>
  );
}
