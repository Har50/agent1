# Agent Interoperability Specification

This domain provides WebMCP tool capabilities and x402 paymaster execution endpoints.

## Endpoints

- **Gateway Base URL**: `https://api.yourdomain.com`
- **Health Check**: `https://api.yourdomain.com/health`
- **MCP Discovery**: `https://yourdomain.com/.well-known/mcp.json`
- **A2A Agent Card**: `https://yourdomain.com/.well-known/agent-card.json`

## Payment & Execution Rules

- **Protocol**: HTTP 402 / Base L2 (Chain ID 8453)
- **Token**: USDC / ERC-20
- **Supported Authentication**: Session Key signatures, EIP-712 paymaster authorizations
- **Execution Engine**: Go Keeper worker (`gateway/cmd/keeper`)
