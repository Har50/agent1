import { LandingPage } from '@/components/LandingPage';
import { DemoTerminal } from '@/components/DemoTerminal';
import { Pillars } from '@/components/Pillars';

export default function Home() {
  return (
    <main>
      <LandingPage />
      <DemoTerminal />
      <Pillars />

      <section
        id="pricing"
        className="border-t border-ink/10 bg-foam-deep/40"
        aria-labelledby="pricing-heading"
      >
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal-deep">
            Business model
          </p>
          <h2
            id="pricing-heading"
            className="mt-3 font-display text-3xl font-semibold text-ink"
          >
            Simple rails pricing
          </h2>
          <p className="mt-4 max-w-xl text-ink-muted">
            Developer SaaS subscriptions, <strong className="font-semibold text-ink">$0.005 per UserOp</strong>, and a{' '}
            <strong className="font-semibold text-ink">1.5%</strong> markup on x402 paywall volume.
          </p>
          <a
            id="portal"
            href="https://github.com/Har50/agent1"
            className="mt-8 inline-flex bg-ink px-6 py-3.5 text-sm font-semibold text-foam transition hover:bg-ink-soft"
          >
            Get API keys on GitHub
          </a>
        </div>
      </section>

      <footer className="border-t border-ink/10 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-ink-muted md:flex-row md:items-center md:justify-between">
          <p className="font-display font-semibold text-ink">AgentExec</p>
          <p>The execution &amp; security rail for the agentic economy.</p>
          <p className="font-mono text-xs">Base L2 · open source MCP</p>
        </div>
      </footer>
    </main>
  );
}
