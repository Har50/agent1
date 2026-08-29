import { NextResponse } from 'next/server';

/**
 * Demo premium endpoint — returns HTTP 402 until PAYMENT-SIGNATURE is present.
 * Mirrors AgentExec x402 behaviour for the WebMCP playground.
 */
export async function POST(request: Request) {
  const payment = request.headers.get('payment-signature');

  if (!payment) {
    return NextResponse.json(
      {
        code: 402,
        error: 'Payment Required',
        priceUSDC: '0.10',
        network: 'base-sepolia',
        asset: 'USDC',
        message: 'Provide PAYMENT-SIGNATURE after AgentExec settlement',
      },
      {
        status: 402,
        headers: {
          'PAYMENT-REQUIRED': Buffer.from(
            JSON.stringify({
              priceUSDC: '0.10',
              network: 'base-sepolia',
            })
          ).toString('base64'),
        },
      }
    );
  }

  return NextResponse.json({
    ok: true,
    product: 'premium-data',
    priceUSDC: '0.10',
    feed: {
      agentsOnline: 1284,
      avgUserOpUsd: 0.0042,
      note: 'Demo analytics payload — replace with live feed.',
      ts: new Date().toISOString(),
    },
  });
}

export async function GET(request: Request) {
  return POST(request);
}
