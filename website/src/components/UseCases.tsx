'use client';

import { motion } from 'framer-motion';
import {
  Building2,
  Check,
  Coins,
  Cpu,
  Globe,
  Layers,
  TrendingUp,
} from 'lucide-react';

const CASES = [
  {
    title: 'Crypto Markets & Trading',
    body: 'Autonomous arbitrage, MEV-aware routing, liquidity moves, and algo rebalancing with Tenderly pre-flight before broadcast.',
    icon: TrendingUp,
    accent: 'cyan',
    points: ['Private RPC routing', 'Slippage / spend bounds'],
  },
  {
    title: 'Agent-to-Agent Commerce',
    body: 'Agents hire agents, pay for API output via x402 headers, and settle in conditional task escrow contracts.',
    icon: Coins,
    accent: 'emerald',
    points: ['HTTP 402 micropayments', 'Timed task escrows'],
  },
  {
    title: 'DeFi Yield & Risk Vaults',
    body: 'Collateral top-ups, liquidation sentinels, and continuous yield shifting across lending venues.',
    icon: Layers,
    accent: 'teal',
    points: ['Health-factor automation', 'Cross-protocol staking'],
  },
  {
    title: 'Programmable Banking',
    body: 'Corporate expense guardrails for AI: EIP-7579 daily caps, vendor allowlists, and audit-ready logs.',
    icon: Building2,
    accent: 'sky',
    points: ['EIP-7579 session keys', 'Zero-trust wallet policies'],
  },
  {
    title: 'Compute & Data Markets',
    body: 'Buy GPU inference, scrape paywalled research, and acquire fine-tuning datasets on demand via micropayments.',
    icon: Cpu,
    accent: 'amber',
    points: ['Pay-per-second compute', 'Instant data paywalls'],
  },
  {
    title: 'DAO & Treasury Management',
    body: 'AI delegates analyze proposals, co-sign within strict parameters, and optimize working capital autonomously.',
    icon: Globe,
    accent: 'blue',
    points: ['Constrained multi-sig', 'On-chain proposal flows'],
  },
] as const;

const accentMap = {
  cyan: {
    border: 'hover:border-cyan-500/40',
    iconBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
    check: 'text-cyan-400',
  },
  emerald: {
    border: 'hover:border-emerald-500/40',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    check: 'text-emerald-400',
  },
  teal: {
    border: 'hover:border-teal-500/40',
    iconBg: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
    check: 'text-teal-400',
  },
  sky: {
    border: 'hover:border-sky-500/40',
    iconBg: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
    check: 'text-sky-400',
  },
  amber: {
    border: 'hover:border-amber-500/40',
    iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    check: 'text-amber-400',
  },
  blue: {
    border: 'hover:border-blue-500/40',
    iconBg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    check: 'text-blue-400',
  },
} as const;

export function UseCases() {
  return (
    <section id="use-cases" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
      <div className="mx-auto mb-16 max-w-3xl text-center">
        <p className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-cyan-400">
          Where AgentExec is used
        </p>
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Engineered for every sector of autonomous AI
        </h2>
        <p className="mt-4 text-slate-400">
          From high-frequency trading bots to agent-to-agent micro-retail — execution,
          risk boundaries, and settlement in one stack.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {CASES.map((item, i) => {
          const Icon = item.icon;
          const a = accentMap[item.accent];
          return (
            <motion.li
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className={`rounded-xl border border-slate-800 bg-slate-900/50 p-8 transition ${a.border}`}
            >
              <div
                className={`mb-6 flex h-12 w-12 items-center justify-center rounded-lg border ${a.iconBg}`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-xl font-bold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
              <ul className="mt-6 space-y-2 font-mono text-xs text-slate-300">
                {item.points.map((p) => (
                  <li key={p} className="flex items-center gap-2">
                    <Check className={`h-3.5 w-3.5 ${a.check}`} />
                    {p}
                  </li>
                ))}
              </ul>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}
