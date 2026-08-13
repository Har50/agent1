'use client';

import { motion } from 'framer-motion';

const pillars = [
  {
    title: 'x402 Paywalls',
    body: 'HTTP 402 challenges with machine-readable USDC micropayments. Agents attach signed EIP-3009 authorizations — no human checkout.',
  },
  {
    title: 'Session Keys',
    body: 'EIP-7579 scopes with spend caps, contract allowlists, and TTL. Agents transact without holding master keys.',
  },
  {
    title: 'Go Gateway',
    body: 'Sliding-window Redis rate limits and circuit breakers in front of the execution API — protect paymaster float.',
  },
];

export function Pillars() {
  return (
    <section
      id="pillars"
      className="mx-auto max-w-6xl px-6 py-20 md:py-28"
      aria-labelledby="pillars-heading"
    >
      <div className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal-deep">
          Three core pillars
        </p>
        <h2
          id="pillars-heading"
          className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl"
        >
          Everything an agent needs between intent and settlement
        </h2>
      </div>

      <ul className="mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
        {pillars.map((p, i) => (
          <motion.li
            key={p.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            className="border-t border-ink/15 pt-6"
          >
            <h3 className="font-display text-xl font-semibold text-ink">{p.title}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{p.body}</p>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
