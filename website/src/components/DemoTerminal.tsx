'use client';

import { motion } from 'framer-motion';

const steps = [
  { label: 'AI Intent', detail: 'Agent requests paid resource' },
  { label: 'Tenderly Pass', detail: 'Dry-run clears drain / revert' },
  { label: 'UserOp', detail: 'Sponsored settle on Base' },
];

export function DemoTerminal() {
  return (
    <section
      id="demo"
      className="relative border-y border-ink/10 bg-ink text-foam"
      aria-labelledby="demo-heading"
    >
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="mb-10 max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal-bright">
            Live execution path
          </p>
          <h2
            id="demo-heading"
            className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl"
          >
            Simulate AI Intent → Tenderly → UserOp
          </h2>
          <p className="mt-3 text-foam/70">
            One composition for agent spend: challenge, guardrail, simulate, settle.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-sm border border-white/10 bg-ink-soft">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 font-mono text-xs text-foam/50">
            <span className="h-2 w-2 rounded-sm bg-ember/80" />
            <span>agentexec · execution rail</span>
          </div>

          <div className="grid gap-0 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
            {steps.map((step, i) => (
              <div key={step.label} className="contents">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ delay: i * 0.15, duration: 0.45 }}
                  className="animate-node-glow px-6 py-8"
                  style={{ animationDelay: `${i * 0.4}s` }}
                >
                  <p className="font-mono text-[10px] uppercase tracking-widest text-signal-bright">
                    Step 0{i + 1}
                  </p>
                  <p className="mt-2 font-display text-xl font-semibold">{step.label}</p>
                  <p className="mt-1 text-sm text-foam/55">{step.detail}</p>
                </motion.div>
                {i < steps.length - 1 && (
                  <div
                    className="hidden h-px w-10 animate-rail-pulse bg-gradient-to-r from-signal/20 via-signal-bright to-signal/20 md:block"
                    aria-hidden
                  />
                )}
              </div>
            ))}
          </div>

          <pre className="overflow-x-auto border-t border-white/10 bg-black/30 px-6 py-5 font-mono text-[12px] leading-relaxed text-signal-bright/90">
{`$ npm install @agent-exec/mcp-server
→ POST /v1/intent/execute  (Tenderly gate)
→ PAYMENT-REQUIRED → EIP-3009 auth → PAYMENT-RESPONSE
→ UserOp hash on Base Sepolia`}
          </pre>
        </div>
      </div>
    </section>
  );
}
