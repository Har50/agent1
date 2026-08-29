/**
 * Browser-side AgentExec client for the WebMCP + x402 demo playground.
 * Talks to the Fastify API (default http://127.0.0.1:8787) or Next mock routes.
 */

export type Challenge = {
  priceUSD: string;
  raw?: unknown;
};

export type SimulationSummary = {
  gasUsed?: string | number;
};

export type ExecuteWithInterceptorOptions = {
  url: string;
  method?: string;
  body?: unknown;
  /** Absolute AgentExec API base (intent execute). */
  agentExecBaseUrl?: string;
  apiKey?: string;
  fromAddress?: string;
  targetAddress?: string;
  /** Hex calldata for /v1/intent/execute (optional — demo can skip live UserOp). */
  calldata?: string;
  usdcPrice?: string;
  on402Intercepted?: (challenge: Challenge) => void;
  onPreflightSimulated?: (simulation: SimulationSummary) => void;
  onUserOpBroadcasted?: (txHash: string) => void;
};

function apiBase() {
  return (
    process.env.NEXT_PUBLIC_AGENTEXEC_URL ||
    'http://127.0.0.1:8787'
  ).replace(/\/$/, '');
}

function apiKey() {
  return process.env.NEXT_PUBLIC_AGENT_API_KEY || 'dev-agent-key';
}

/** ERC-20 transfer(address,uint256) selector + padded args (USDC 6 decimals). */
export function encodeUsdcTransfer(to: string, amountUsdc: string): `0x${string}` {
  const selector = 'a9059cbb';
  const addr = to.replace(/^0x/, '').toLowerCase().padStart(64, '0');
  const whole = Number.parseFloat(amountUsdc);
  const amount = BigInt(Math.round(whole * 1e6));
  const amtHex = amount.toString(16).padStart(64, '0');
  return `0x${selector}${addr}${amtHex}`;
}

export const agentExecSDK = {
  registerWebMcpTool(tool: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }) {
    if (typeof window === 'undefined') return false;
    const nav = navigator as Navigator & {
      modelContext?: { registerTool?: (t: unknown) => void };
    };
    if (!nav.modelContext?.registerTool) return false;
    nav.modelContext.registerTool(tool);
    return true;
  },

  async executeWithInterceptor(
    opts: ExecuteWithInterceptorOptions
  ): Promise<Response> {
    const method = opts.method || 'GET';
    const headers: Record<string, string> = {
      'x-api-key': opts.apiKey || apiKey(),
      'content-type': 'application/json',
    };

    // Relative URLs hit the Next.js app; absolute hit AgentExec directly.
    const firstUrl = opts.url.startsWith('http')
      ? opts.url
      : opts.url;

    let res = await fetch(firstUrl, {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    if (res.status === 402) {
      const body = await res.json().catch(() => ({}));
      const price =
        opts.usdcPrice ||
        (body as { priceUSDC?: string }).priceUSDC ||
        '0.10';
      opts.on402Intercepted?.({
        priceUSD: String(price),
        raw: body,
      });

      // Demo settlement path: call AgentExec intent execute (mock mode OK).
      const base = opts.agentExecBaseUrl || apiBase();
      const target =
        opts.targetAddress ||
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      const calldata =
        opts.calldata ||
        encodeUsdcTransfer(
          '0x1111111111111111111111111111111111111111',
          String(price)
        );

      const execRes = await fetch(`${base}/v1/intent/execute`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': opts.apiKey || apiKey(),
        },
        body: JSON.stringify({
          fromAddress:
            opts.fromAddress ||
            '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          targetAddress: target,
          calldata,
          valueWei: '0',
          maxAllowedDrainUSD: Number.parseFloat(String(price)) || 1,
          agentId: 'webmcp-demo',
          networkId: '84532',
        }),
      });

      const execBody = (await execRes.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (!execRes.ok) {
        throw new Error(
          (execBody.reason as string) ||
            (execBody.message as string) ||
            (execBody.error as string) ||
            `AgentExec ${execRes.status}`
        );
      }

      const sim = execBody.simulationSummary as
        | { gasEstimated?: string | number }
        | undefined;
      opts.onPreflightSimulated?.({
        gasUsed: sim?.gasEstimated ?? '65000',
      });

      const txHash =
        (execBody.txHash as string) ||
        (execBody.userOpHash as string) ||
        '';
      if (txHash) opts.onUserOpBroadcasted?.(txHash);

      // Retry original resource with a demo payment header.
      const paymentJson = JSON.stringify({
        signature: '0xdemo',
        payload: {
          from:
            opts.fromAddress ||
            '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          value: String(Math.round(Number.parseFloat(String(price)) * 1e6)),
        },
      });
      headers['payment-signature'] =
        typeof btoa !== 'undefined'
          ? btoa(paymentJson)
          : Buffer.from(paymentJson).toString('base64');

      res = await fetch(firstUrl, {
        method,
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      return res;
    }

    // Non-402 success path still surface a soft simulation for the UI timeline.
    if (res.ok) {
      opts.onPreflightSimulated?.({ gasUsed: '0' });
    }
    return res;
  },
};
