'use client';

import { motion } from 'framer-motion';
import { Hero } from './Hero';
import { CodePlayground } from './CodePlayground';
import { UseCases } from './UseCases';
import { Architecture } from './Architecture';

const METRICS = [
  { value: '< 15ms', label: 'Gateway Latency', tone: 'text-white' },
  { value: '$0.0001', label: 'Avg Base Gas Cost', tone: 'text-emerald-400' },
  { value: '100%', label: 'Simulation Coverage', tone: 'text-cyan-400' },
  { value: 'x402', label: 'Native Protocol', tone: 'text-amber-400' },
] as const;

export function LandingPage() {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-400 to-emerald-400 font-display text-sm font-bold text-slate-950">
              AX
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-white">
              AgentExec
            </span>
            <span className="hidden rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-400 sm:inline">
              v1.0 LIVE
            </span>
          </a>

          <div className="hidden items-center gap-8 text-sm font-medium text-slate-400 md:flex">
            <a href="#use-cases" className="transition hover:text-cyan-300">
              Use Cases
            </a>
            <a href="#architecture" className="transition hover:text-cyan-300">
              Architecture
            </a>
            <a href="#x402" className="transition hover:text-cyan-300">
              x402 Protocol
            </a>
            <a
              href="https://github.com/Har50/agent1/blob/main/docs/ARCHITECTURE.md"
              className="transition hover:text-cyan-300"
            >
              Docs
            </a>
          </div>

          <a
            id="portal"
            href="https://github.com/Har50/agent1"
            className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Get API Key
          </a>
        </div>
      </nav>

      <Hero />
      <CodePlayground />

      <section className="border-y border-slate-800/80 bg-slate-900/30 py-10">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            {METRICS.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <p className={`font-mono text-3xl font-extrabold ${m.tone}`}>{m.value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {m.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <UseCases />
      <Architecture />

      <section id="x402" className="border-t border-slate-800/80 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-cyan-400">
            x402 Protocol
          </p>
          <h2 className="mt-3 font-display text-3xl font-extrabold text-white">
            HTTP 402 micropayments for machine traffic
          </h2>
          <p className="mt-4 text-slate-400">
            Agents attach signed EIP-3009 authorizations. Your API returns{' '}
            <code className="font-mono text-cyan-300">PAYMENT-REQUIRED</code>, then serves
            the payload after verification — no human checkout.
          </p>
          <a
            href="https://github.com/Har50/agent1/blob/main/src/middleware/x402Paywall.ts"
            className="mt-8 inline-flex rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-500/40 hover:text-white"
          >
            View x402 middleware →
          </a>
        </div>
      </section>

      <footer className="border-t border-slate-800/80 bg-slate-950 py-12 text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row lg:px-8">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-cyan-400 font-display text-xs font-bold text-slate-950">
              AX
            </span>
            <span className="font-semibold text-white">AgentExec</span>
          </div>
          <p>© 2026 AgentExec · Base L2 · EIP-7579 · x402 Protocol Native</p>
          <div className="flex gap-6 text-slate-400">
            <a
              href="https://github.com/Har50/agent1"
              className="transition hover:text-white"
            >
              GitHub
            </a>
            <a
              href="https://github.com/Har50/agent1/blob/main/docs/ARCHITECTURE.md"
              className="transition hover:text-white"
            >
              Docs
            </a>
            <a
              href="https://github.com/Har50/agent1/blob/main/docs/ECOSYSTEM_POSITIONING.md"
              className="transition hover:text-white"
            >
              Ecosystem
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
