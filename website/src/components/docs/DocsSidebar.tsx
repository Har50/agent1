'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { docsNav } from '@/config/docs-nav';

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 border-b border-slate-800 bg-slate-950 md:w-64 md:border-b-0 md:border-r md:pr-6">
      <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto py-6">
        <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-400">
          Documentation
        </p>
        <nav className="space-y-6">
          {docsNav.map((section) => (
            <div key={section.title}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block rounded-md px-2 py-1.5 text-sm transition ${
                          active
                            ? 'bg-cyan-500/10 font-semibold text-cyan-300'
                            : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                        }`}
                      >
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
