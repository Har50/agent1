import Link from 'next/link';
import { DocsSidebar } from '@/components/docs/DocsSidebar';

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-display text-sm font-bold text-white">
              AgentExec
            </Link>
            <span className="text-slate-600">/</span>
            <Link href="/docs" className="text-sm font-medium text-cyan-300">
              Docs
            </Link>
          </div>
          <Link
            href="https://github.com/Har50/agent1"
            className="text-sm text-slate-400 transition hover:text-white"
          >
            GitHub
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 md:flex-row">
        <DocsSidebar />
        <main className="min-w-0 flex-1 pb-16 pt-2">{children}</main>
      </div>
    </div>
  );
}
