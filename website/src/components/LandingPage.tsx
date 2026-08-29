'use client';

import { motion } from 'framer-motion';
import { HeroVisual } from './HeroVisual';

const nav = [
  { href: '#docs', label: 'Docs' },
  { href: '#mcp', label: 'MCP Tool' },
  { href: '/demo', label: 'Playground' },
  { href: '#pricing', label: 'Pricing' },
];

export function LandingPage() {
  return (
    <div className="relative min-h-screen">
      <header className="absolute inset-x-0 top-0 z-20">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <a
            href="/"
            className="font-display text-lg font-bold tracking-tight text-ink"
          >
            AgentExec
          </a>
          <ul className="hidden items-center gap-8 text-sm font-medium text-ink-muted md:flex">
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="transition hover:text-ink">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="#portal"
            className="border border-ink/20 bg-ink px-4 py-2 text-sm font-semibold text-foam transition hover:bg-ink-soft"
          >
            Launch Portal
          </a>
        </nav>
      </header>

      <section className="hero-atmosphere relative min-h-[100svh] overflow-hidden">
        <HeroVisual />
        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-6 pb-16 pt-28 md:justify-center md:pb-24 md:pt-24">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-signal-deep"
          >
            Base L2 · EIP-7579 · x402 Protocol Native
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.55 }}
            className="mt-5 max-w-3xl font-display text-[clamp(2.4rem,6vw,4.25rem)] font-extrabold leading-[1.05] tracking-tight text-ink"
          >
            <span className="block text-signal-deep">AgentExec</span>
            Programmable Money Rails for Autonomous AI Agents.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5 }}
            className="mt-6 max-w-xl text-base leading-relaxed text-ink-muted md:text-lg"
          >
            Protect your AI agent treasuries with automated Tenderly dry-runs,
            time-bounded session key permissions, and HTTP 402 micro-payment
            paywalls.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.45 }}
            className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <a
              id="mcp"
              href="#demo"
              className="inline-flex items-center justify-center bg-signal px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-signal-deep"
            >
              Connect MCP Server
            </a>
            <a
              id="docs"
              href="https://github.com/Har50/agent1/blob/main/docs/ARCHITECTURE.md"
              className="inline-flex items-center justify-center border border-ink/25 bg-white/40 px-6 py-3.5 text-sm font-semibold text-ink backdrop-blur-sm transition hover:border-ink/50"
            >
              Read Docs &amp; Architecture
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="mt-8 inline-flex max-w-fit items-center gap-2 border border-ink/10 bg-white/50 px-4 py-2.5 font-mono text-xs text-ink-soft backdrop-blur-sm"
          >
            <span className="text-signal-deep">$</span>
            npm install @agent-exec/mcp-server
          </motion.p>
        </div>
      </section>
    </div>
  );
}
