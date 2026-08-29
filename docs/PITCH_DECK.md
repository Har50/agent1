# AgentExec + WebMCP

**The Complete Infrastructure Stack for Autonomous Agentic Commerce**

---

## The Problem

**Fragile AI Web Interactions:** AI agents struggle with traditional websites—relying on slow, brittle DOM scraping and visual layout heuristics that break frequently.

**On-Chain Settlement Friction:** Agents executing commercial micro-transactions face seed phrase risks, unpredictable gas fees, failing transactions, and strict wallet interaction hurdles.

---

## The Solution: WebMCP + AgentExec

A two-layer architecture separating **Browser Discovery** from **L2 Execution & Safety**:

| Layer | Role |
|-------|------|
| **Front-End Discovery (WebMCP)** | Extends `window.navigator.modelContext` so visiting AI agents get a clean, structured schema menu of on-page tools and micro-pricing. |
| **Back-End Execution & Safety (AgentExec)** | Enforces per-intent spend caps, simulates execution via Tenderly, sponsors gas via Pimlico UserOps, and manages liquidity reserves on Base L2 with an automated Go keeper. |

---

## System Architecture Flow

```text
┌─────────────────────────────────────────────────────────┐
│                   VISITING AI AGENT                     │
└───────────────────────────┬─────────────────────────────┘
                            │
              1. Discover Tools & Pricing
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              WebMCP Browser Discovery Layer             │
│        (window.navigator.modelContext Tool Registry)    │
└───────────────────────────┬─────────────────────────────┘
                            │
              2. Tool Action Called → Trigger HTTP 402
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   @agentexec/sdk                        │
│        (Session Key Signing & Payment Interceptor)      │
└───────────────────────────┬─────────────────────────────┘
                            │
              3. Signed Intent & Payment Payload
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                 AgentExec Fastify Gateway               │
│  ├─ Policy Check (Max $10 Spend-Cap per Intent)         │
│  ├─ Tenderly Pre-flight Simulation (Zero Reverts)       │
│  └─ Pimlico Account Abstraction (Gasless UserOps)       │
└───────────────────────────┬─────────────────────────────┘
                            │
              4. Settlement on Base L2
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Base L2 Mainnet                      │
│   (PaymasterAutoTopUp.sol maintained by Go Keeper)      │
└─────────────────────────────────────────────────────────┘
```

---

## Key Product Highlights

- **Zero DOM Scraping** — Direct schema communication between web apps and AI models.
- **Non-Custodial Safety** — Users delegate short-lived session keys with strict spending caps.
- **Pre-Flight Zero-Revert Guarantee** — Transactions are simulated on Tenderly before broadcast; failed states cost zero gas.
- **Automated Liquidity** — The Go keeper daemon continuously monitors and refills paymaster gas reserves.

---

## Key Market Pain Points & Solutions

| Challenge | Existing Limitation | AgentExec Solution |
| :--- | :--- | :--- |
| **Wallet Security** | Raw private keys can be drained via prompt injection. | **EIP-7579 Session Keys:** Scoped spending limits, contract allowlists, and time bounds. |
| **Transaction Failures** | Reverted transactions waste gas and break agent loops. | **Tenderly Pre-Flight:** Dry-runs transactions to block reverts and high balance drains. |
| **Payment Friction** | Agents cannot navigate human checkout forms or manage gas tokens. | **x402 Micropayments & Pimlico Gas Sponsorship:** Instant USDC settlement with 0 ETH gas required. |
| **Browser Integration** | In-app chatbots isolate agents inside single applications. | **WebMCP Integration:** Standardized front-end tool discovery directly in the browser. |

---

## Business & Monetization Model

1. **Developer SaaS Subscriptions** — Tiered API plans for enterprise agent developers requiring custom rate limits and compliance telemetry.
2. **Per-Execution Protocol Fee** — ~$0.005 micro-fee collected per validated UserOp execution.
3. **x402 Paywall Volume Fee** — 1.5% processing fee on machine-to-machine micropayment volume routed through the gateway.

---

## Go-To-Market & Distribution Strategy

- **Developer Tools Ecosystem** — Open-source MCP toolkits for Claude Desktop, Cursor, and LangChain environments.
- **Agent-Ready Web Conversion** — Turnkey SDK (`@agentexec/sdk` + `WebMCPProvider`) so web apps expose WebMCP-compliant tools backed by AgentExec settlement.

---

## Current Product Status

| Component | Status |
|-----------|--------|
| Fastify execution API | ✅ Shipped |
| x402 paywall middleware | ✅ Shipped |
| MCP server | ✅ Shipped |
| Go Redis gateway | ✅ Shipped |
| `PaymasterAutoTopUp` + Foundry/Slither | ✅ Shipped (PR #2) |
| WebMCP SDK + `/v1/intent` + Tenderly helper | ✅ This release |
| Go paymaster keeper daemon | ✅ Shipped |
| Integration CI (contracts + Vitest + Go) | ✅ This release |
| Third-party audit / SOC 2 | ⏳ Pre-audit tooling only |

---

## Related docs

- [SDK_QUICKSTART.md](./SDK_QUICKSTART.md) — developer integration guide
- [WEBMCP_ADAPTER.md](./WEBMCP_ADAPTER.md) — adapter & intent route
- [KEEPER_VERIFICATION.md](./KEEPER_VERIFICATION.md) — vault / USDC top-up
- [MAINNET_CHECKLIST.md](./MAINNET_CHECKLIST.md) — production cutover
