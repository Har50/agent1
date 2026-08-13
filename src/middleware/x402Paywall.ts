/**
 * x402 HTTP Paywall — machine-readable USDC micropayments over HTTP 402.
 *
 * Flow:
 *  1. No PAYMENT-SIGNATURE → 402 + PAYMENT-REQUIRED challenge (base64 JSON)
 *  2. Agent retries with PAYMENT-SIGNATURE (base64 { signature, payload })
 *  3. Verify amount + recipient; attach x402Payment to request; set PAYMENT-RESPONSE
 *
 * @see https://www.x402.org/
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { parseUnits } from 'viem';
import { config } from '../config/env.js';

export interface X402PaywallConfig {
  /** e.g. "0.01" for one cent USDC */
  priceUSDC: string;
  recipientAddress: `0x${string}`;
  chainId: number;
  /** Paths that require payment (prefix match). Empty = all routes in scope. */
  pathPrefixes?: string[];
}

export type X402PaymentContext = {
  payer: string;
  amount: string;
  txSignature: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    x402Payment?: X402PaymentContext;
  }
}

type AuthorizationPayload = {
  from: string;
  to: string;
  value: string;
  validAfter?: string | number;
  validBefore?: string | number;
  nonce?: string;
};

function decodeBase64Json<T>(raw: string): T {
  return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as T;
}

function encodeBase64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function pathRequiresPayment(
  url: string,
  prefixes: string[] | undefined
): boolean {
  if (!prefixes || prefixes.length === 0) return true;
  const path = url.split('?')[0] ?? url;
  return prefixes.some((p) => path === p || path.startsWith(p));
}

/**
 * Register global onRequest hook that enforces x402 on matching paths.
 */
export function registerX402Paywall(
  fastify: FastifyInstance,
  paywallConfig: X402PaywallConfig
): void {
  const prefixes = paywallConfig.pathPrefixes;

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!pathRequiresPayment(request.url, prefixes)) return;

    // Skip docs / health
    if (
      request.url === '/health' ||
      request.url.startsWith('/docs') ||
      request.url.startsWith('/v1/meta')
    ) {
      return;
    }

    const paymentSignatureHeader = (request.headers['payment-signature'] ||
      request.headers['PAYMENT-SIGNATURE']) as string | undefined;

    // 1. Challenge
    if (!paymentSignatureHeader) {
      const paymentChallenge = {
        scheme: 'exact',
        asset: 'USDC',
        priceWei: parseUnits(paywallConfig.priceUSDC, 6).toString(),
        network:
          paywallConfig.chainId === 8453 ? 'base-mainnet' : 'base-sepolia',
        payTo: paywallConfig.recipientAddress,
        validitySeconds: 300,
        resource: request.url,
      };

      return reply
        .code(402)
        .header('PAYMENT-REQUIRED', encodeBase64Json(paymentChallenge))
        .header('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED')
        .send({
          error: 'Payment Required',
          code: 402,
          message: `This API endpoint requires a micropayment of ${paywallConfig.priceUSDC} USDC via x402 protocol.`,
          challengeHeader: 'PAYMENT-REQUIRED',
        });
    }

    // 2. Verify authorization envelope
    try {
      const decodedPayload = decodeBase64Json<{
        signature: string;
        payload: AuthorizationPayload;
      }>(paymentSignatureHeader);

      const { signature, payload } = decodedPayload;
      if (!signature || !payload?.from || !payload?.to || payload.value == null) {
        return reply.code(400).send({
          error: 'Malformed PAYMENT-SIGNATURE header',
          details: 'Expected base64 JSON { signature, payload:{ from, to, value } }',
        });
      }

      const requiredAmountWei = parseUnits(paywallConfig.priceUSDC, 6);
      if (BigInt(payload.value) < requiredAmountWei) {
        return reply
          .code(402)
          .send({ error: 'Insufficient payment authorization amount.' });
      }

      if (
        payload.to.toLowerCase() !==
        paywallConfig.recipientAddress.toLowerCase()
      ) {
        return reply
          .code(402)
          .send({ error: 'Invalid payment recipient address.' });
      }

      // Optional: expiry window
      if (payload.validBefore != null) {
        const until = Number(payload.validBefore);
        if (Number.isFinite(until) && until < Math.floor(Date.now() / 1000)) {
          return reply.code(402).send({ error: 'Payment authorization expired.' });
        }
      }

      request.x402Payment = {
        payer: payload.from,
        amount: payload.value,
        txSignature: signature,
      };

      reply.header(
        'PAYMENT-RESPONSE',
        encodeBase64Json({
          status: 'authorized',
          payer: payload.from,
          amount: payload.value,
        })
      );
      reply.header(
        'Access-Control-Expose-Headers',
        'PAYMENT-REQUIRED, PAYMENT-RESPONSE'
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({
        error: 'Malformed PAYMENT-SIGNATURE header',
        details: message,
      });
    }
  });
}

/** Build config from env when X402 is enabled. */
export function x402ConfigFromEnv(): X402PaywallConfig | null {
  if (!config.X402_ENABLED) return null;
  const recipient = config.X402_RECIPIENT as `0x${string}` | '';
  if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
    return null;
  }
  return {
    priceUSDC: config.X402_PRICE_USDC,
    recipientAddress: recipient,
    chainId: config.chainId,
    pathPrefixes: config.X402_PATH_PREFIXES,
  };
}
