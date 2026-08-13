'use client';

import { motion } from 'framer-motion';

const STEPS = [
  {
    step: '1. Intent',
    title: 'LLM / MCP Input',
    body: 'Claude, Cursor, or an autonomous agent sends execution calldata.',
    tone: 'text-cyan-400',
  },
  {
    step: '2. Gateway',
    title: 'Go + Redis Firewall',
    body: 'Sliding-window rate limit and static analysis before deeper spend.',
    tone: 'text-amber-400',
  },
  {
    step: '3. Simulation',
    title: 'Tenderly Pre-Flight',
    body: 'Full EVM trace ensures the transaction will not revert or drain.',
    tone: 'text-emerald-400',
  },
  {
    step: '4. Settlement',
    title: 'Base L2 Gasless',
    body: 'Sponsored UserOp broadcast via Pimlico paymaster.',
    tone: 'text-sky-400',
  },
] as const;

export function Architecture() {
  return (
    <section
      id="architecture"
      className="border-t border-slate-800/80 bg-slate-900/20 py-24"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <p className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-cyan-400">
            The execution stack
          </p>
          <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
            How AgentExec protects every transaction
          </h2>
        </div>

        <ol className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.step}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center"
            >
              <span className={`font-mono text-xs font-bold uppercase ${s.tone}`}>
                {s.step}
              </span>
              <h3 className="mt-2 font-display text-lg font-bold text-white">{s.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{s.body}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
