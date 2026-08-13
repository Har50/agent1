'use client';

import { motion } from 'framer-motion';

export function Hero() {
  return (
    <section className="hero-wash relative overflow-hidden pb-16 pt-28 md:pt-32">
      <div className="platform-grid pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400"
          >
            Base L2 · EIP-7579 · x402 Protocol Native
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.5 }}
            className="font-display text-[clamp(2.6rem,7vw,4.5rem)] font-extrabold leading-[1.05] tracking-tight text-white"
          >
            <span className="block text-cyan-300">AgentExec</span>
            Execution &amp; money rails for{' '}
            <span className="bg-gradient-to-r from-cyan-300 via-emerald-300 to-teal-200 bg-clip-text text-transparent">
              autonomous AI
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.45 }}
            className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-400 md:text-lg"
          >
            Session-key spend limits, Tenderly dry-runs, Go API rate limiting, and x402
            HTTP micropayments — the infrastructure layer for agentic commerce.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.4 }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <a
              href="#terminal"
              className="inline-flex items-center justify-center rounded-lg bg-cyan-400 px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Start Building Free
            </a>
            <a
              href="#use-cases"
              className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900/60 px-6 py-3.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            >
              Explore Industry Use Cases
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
