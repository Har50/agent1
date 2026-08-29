'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { agentExecSDK } from '@/lib/agentexec-sdk';
import { useWebMCP } from '@/components/WebMCPProvider';

interface ExecutionLog {
  timestamp: string;
  step: string;
  status: 'info' | 'success' | 'warning' | 'error';
  details?: string;
}

export default function WebMCPDemoPage() {
  const { registerTool, getRegisteredTools } = useWebMCP();
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [sessionBudget, setSessionBudget] = useState(5.0);
  const [webmcpState, setWebmcpState] = useState<'PENDING' | 'ACTIVE' | 'FALLBACK'>(
    'PENDING'
  );

  const addLog = useCallback(
    (step: string, status: ExecutionLog['status'], details?: string) => {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          step,
          status,
          details,
        },
      ]);
    },
    []
  );

  useEffect(() => {
    registerTool({
      name: 'purchase_premium_data',
      description: 'Fetch live AI agent analytics feed on Base L2',
      priceUSD: 0.1,
      parameters: {
        type: 'object',
        properties: {
          endpoint: { type: 'string' },
        },
      },
      handler: async (args) => {
        const res = await agentExecSDK.executeWithInterceptor({
          url: '/api/v1/premium-data',
          method: 'POST',
          usdcPrice: '0.10',
          body: args,
        });
        return res.json();
      },
    });

    // Also mirror into navigator via legacy helper when available
    agentExecSDK.registerWebMcpTool({
      name: 'purchase_premium_data',
      description: 'Fetch live AI agent analytics feed on Base L2',
      parameters: {
        type: 'object',
        properties: {
          endpoint: { type: 'string' },
        },
      },
    });

    const count = getRegisteredTools().length;
    setWebmcpState(count > 0 ? 'ACTIVE' : 'FALLBACK');
    addLog(
      count > 0
        ? `WebMCPProvider registered ${count} tool(s) on navigator.modelContext`
        : 'WebMCP registry empty — demo uses in-page trigger',
      count > 0 ? 'info' : 'warning'
    );
  }, [addLog, getRegisteredTools, registerTool]);

  const handleRunAgentAction = async () => {
    setIsExecuting(true);
    setLogs([]);
    try {
      addLog("AI agent initiated action: 'purchase_premium_data'", 'info');
      addLog('Sending request to /api/v1/premium-data...', 'info');

      const response = await agentExecSDK.executeWithInterceptor({
        url: '/api/v1/premium-data',
        method: 'POST',
        usdcPrice: '0.10',
        body: { endpoint: 'market-pulse' },
        on402Intercepted: (challenge) => {
          addLog(
            'HTTP 402 Payment Required intercepted',
            'warning',
            `Amount: $${challenge.priceUSD} USDC`
          );
          addLog('Verifying session key spend cap against policy...', 'info');
        },
        onPreflightSimulated: (simulation) => {
          addLog(
            'Tenderly / mock pre-flight passed',
            'success',
            `Gas estimated: ${simulation.gasUsed}`
          );
        },
        onUserOpBroadcasted: (txHash) => {
          addLog(
            'UserOp broadcast path completed',
            'success',
            `Tx/UserOp: ${txHash}`
          );
        },
      });

      if (response.ok) {
        const data = await response.json();
        addLog('Payment settled & data received', 'success', JSON.stringify(data));
        setSessionBudget((prev) => Math.max(0, prev - 0.1));
      } else {
        addLog(`Upstream returned HTTP ${response.status}`, 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addLog('Execution failed', 'error', message);
      addLog(
        'Tip: start API with EXECUTION_MODE=mock npm run dev (port 8787)',
        'info'
      );
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-foam text-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(14,154,167,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(232,165,75,0.12),_transparent_45%)]" />

      <div className="relative mx-auto max-w-4xl space-y-6 px-6 py-10 font-mono">
        <header className="border-b border-ink/10 pb-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-signal-deep">
            Base Sepolia · WebMCP · x402
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
            AgentExec Live Playground
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Autonomous tool discovery, HTTP 402 interception, and Base L2 settlement
            demo.
          </p>
          <a href="/" className="mt-3 inline-block text-xs text-signal-deep underline">
            ← Back to AgentExec
          </a>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="border border-ink/10 bg-white/70 p-4 backdrop-blur">
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">
              Network
            </div>
            <div className="mt-1 font-semibold text-signal-deep">Base Sepolia</div>
          </div>
          <div className="border border-ink/10 bg-white/70 p-4 backdrop-blur">
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">
              Session allowance
            </div>
            <div className="mt-1 font-semibold text-ink">
              ${sessionBudget.toFixed(2)} USDC
            </div>
          </div>
          <div className="border border-ink/10 bg-white/70 p-4 backdrop-blur">
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">
              WebMCP state
            </div>
            <div className="mt-1 font-semibold text-ember">{webmcpState}</div>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleRunAgentAction}
          disabled={isExecuting}
          className="w-full bg-ink py-3 text-sm font-semibold text-foam transition hover:bg-ink-soft disabled:opacity-50"
        >
          {isExecuting
            ? 'Executing agent pipeline…'
            : 'Trigger AI agent WebMCP tool call ($0.10 USDC)'}
        </motion.button>

        <div className="min-h-[300px] space-y-2 border border-ink/20 bg-ink p-4 text-xs text-signal-bright">
          <div className="border-b border-white/10 pb-2 text-foam/50">
            // execution event stream
          </div>
          {logs.length === 0 && (
            <div className="text-foam/40">Awaiting agent action…</div>
          )}
          {logs.map((log, idx) => (
            <div key={`${log.timestamp}-${idx}`} className="flex flex-wrap gap-2">
              <span className="text-foam/40">[{log.timestamp}]</span>
              <span
                className={
                  log.status === 'success'
                    ? 'text-signal-bright'
                    : log.status === 'warning'
                      ? 'text-ember'
                      : log.status === 'error'
                        ? 'text-red-400'
                        : 'text-foam/80'
                }
              >
                [{log.status.toUpperCase()}]
              </span>
              <span className="text-foam">{log.step}</span>
              {log.details && (
                <span className="text-foam/50">({log.details})</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
