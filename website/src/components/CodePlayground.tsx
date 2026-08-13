'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Terminal } from 'lucide-react';

const SNIPPETS = {
  mcp: `// 1. Install AgentExec MCP Server
npm install @agent-exec/mcp-server

// 2. Add to Claude Desktop / Cursor MCP config
{
  "mcpServers": {
    "agent-exec": {
      "command": "npx",
      "args": ["-y", "@agent-exec/mcp-server"],
      "env": {
        "AGENTEXEC_API_KEY": "ax_live_99...",
        "DEFAULT_CHAIN": "base"
      }
    }
  }
}`,
  x402: `// Protect any API route with x402 micropayment guard
import { registerX402Paywall } from "@agent-exec/sdk";

fastify.register(registerX402Paywall, {
  priceUSDC: "0.005", // 0.5 cents per request
  recipientAddress: "0xYourTreasuryAddress...",
  chainId: 8453 // Base Mainnet
});`,
  ts: `import { AgentExec } from "@agent-exec/sdk";

const agent = new AgentExec({ apiKey: process.env.AGENT_EXEC_KEY });

const tx = await agent.executeIntent({
  target: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  action: "transfer",
  params: { recipient: "0xAgentB...", amount: "10.00" },
  sessionKey: "sk_daily_cap_50usd",
  simulateFirst: true
});

console.log("Verified on Base L2:", tx.userOpHash);`,
} as const;

type CodeTab = keyof typeof SNIPPETS;

const TABS: { id: CodeTab; label: string }[] = [
  { id: 'mcp', label: 'MCP Config' },
  { id: 'x402', label: 'x402 Paywall' },
  { id: 'ts', label: 'TypeScript SDK' },
];

export function CodePlayground() {
  const [activeTab, setActiveTab] = useState<CodeTab>('mcp');
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    await navigator.clipboard.writeText(SNIPPETS[activeTab]);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="terminal" className="relative mx-auto max-w-7xl px-6 pb-20 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.45 }}
        className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 shadow-xl shadow-black/40 backdrop-blur-xl"
      >
        <div className="flex flex-col gap-4 border-b border-slate-800 bg-slate-950 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/80" />
            <span className="ml-2 flex items-center gap-1 font-mono text-xs text-slate-500">
              <Terminal className="h-3.5 w-3.5" />
              developer-sandbox
            </span>
          </div>

          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-3 py-1.5 font-mono text-xs transition ${
                  activeTab === tab.id
                    ? 'bg-cyan-500/20 font-semibold text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative min-h-[240px] overflow-x-auto bg-slate-950/60 p-6 font-mono text-xs text-slate-300">
          <button
            type="button"
            onClick={copyCode}
            className="absolute right-4 top-4 rounded-md border border-slate-700 bg-slate-800 p-2 text-slate-400 transition hover:border-slate-500 hover:text-white"
            aria-label="Copy code"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
          <pre className="pr-12 leading-relaxed">
            <code className="text-cyan-200/90">{SNIPPETS[activeTab]}</code>
          </pre>
        </div>
      </motion.div>
    </section>
  );
}
