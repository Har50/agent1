import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('MCP server module', () => {
  it('defines the production tool names', () => {
    const src = readFileSync(
      resolve(__dirname, '../src/mcp/server.ts'),
      'utf8'
    );
    expect(src).toContain('execute_onchain_intent');
    expect(src).toContain('get_smart_account_info');
    expect(src).toContain('dry_run_simulation');
    expect(src).toContain('/v1/intent/execute');
    expect(src).toContain('API_BASE_URL');
  });
});

describe('docker-compose.prod.yml', () => {
  it('wires postgres redis fastify-app go-gateway on agent-tx-net', () => {
    const yml = readFileSync(
      resolve(__dirname, '../docker-compose.prod.yml'),
      'utf8'
    );
    expect(yml).toContain('agent-tx-net');
    expect(yml).toContain('fastify-app');
    expect(yml).toContain('go-gateway');
    expect(yml).toContain('Dockerfile.fastify');
    expect(yml).toContain('Dockerfile.gateway');
    expect(yml).toContain('postgres:16-alpine');
    expect(yml).toContain('redis:7-alpine');
  });
});
