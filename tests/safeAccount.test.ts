import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';
import {
  canUseSponsoredSafe,
  resolveBaseChain,
  resolvePimlicoRpcUrl,
} from '../src/services/safeAccount.js';
import { base, baseSepolia } from 'viem/chains';

describe('Pimlico / Safe sponsorship helpers', () => {
  it('builds Pimlico mainnet RPC from API key', () => {
    const cfg = loadConfig({
      PIMLICO_API_KEY: 'test-key',
      BASE_NETWORK: 'base',
      BASE_RPC_URL: 'https://mainnet.base.org',
      BUNDLER_RPC_URL: '',
      PAYMASTER_RPC_URL: '',
    });
    expect(resolvePimlicoRpcUrl(cfg)).toBe(
      'https://api.pimlico.io/v2/base/rpc?apikey=test-key'
    );
  });

  it('builds Pimlico sepolia RPC from API key', () => {
    const cfg = loadConfig({
      PIMLICO_API_KEY: 'sep-key',
      BASE_NETWORK: 'baseSepolia',
      BASE_RPC_URL: 'https://sepolia.base.org',
      BUNDLER_RPC_URL: '',
      PAYMASTER_RPC_URL: '',
    });
    expect(resolvePimlicoRpcUrl(cfg)).toBe(
      'https://api.pimlico.io/v2/base-sepolia/rpc?apikey=sep-key'
    );
    expect(resolveBaseChain(cfg).id).toBe(baseSepolia.id);
  });

  it('prefers explicit BUNDLER_RPC_URL over API key', () => {
    const cfg = loadConfig({
      PIMLICO_API_KEY: 'test-key',
      BUNDLER_RPC_URL: 'https://custom.bundler.example/rpc',
      BASE_RPC_URL: 'https://mainnet.base.org',
    });
    expect(resolvePimlicoRpcUrl(cfg)).toBe('https://custom.bundler.example/rpc');
  });

  it('canUseSponsoredSafe requires owner key + sponsorship endpoint', () => {
    const ready = loadConfig({
      AGENT_PRIVATE_KEY:
        '0x1111111111111111111111111111111111111111111111111111111111111111',
      PIMLICO_API_KEY: 'k',
      BASE_RPC_URL: 'https://mainnet.base.org',
    });
    expect(canUseSponsoredSafe(ready)).toBe(true);

    const missingKey = loadConfig({
      AGENT_PRIVATE_KEY: '',
      PIMLICO_API_KEY: 'k',
      BASE_RPC_URL: 'https://mainnet.base.org',
    });
    expect(canUseSponsoredSafe(missingKey)).toBe(false);

    expect(resolveBaseChain(loadConfig({ BASE_NETWORK: 'base' })).id).toBe(
      base.id
    );
  });
});
