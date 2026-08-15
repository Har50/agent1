# Smart Contract Audits, QA & Compliance

AgentExec separates certification into three layers. This doc maps each layer to
concrete tooling in this repo. **Start here for contracts:** Foundry tests + Slither
(see `contracts/README.md`).

## 1. Smart Contract Audits & Security Certification

| Practice | Tooling in-repo | Command |
|----------|-----------------|---------|
| Unit / fuzz / invariant tests | Foundry | `cd contracts && forge test -vv` |
| Static analysis | Slither | `cd contracts && ./scripts/slither.sh` |
| Style / patterns | Solhint (optional) | `solhint 'src/**/*.sol'` |
| Formal third-party audit | OpenZeppelin / Trail of Bits / Cyfrin / CertiK / Sherlock | Submit `src/` + Slither report + test report |

**Contract under review:** `contracts/src/PaymasterAutoTopUp.sol`

Critical properties covered by Foundry:

- Only `owner` or `keeper` may call `executeTopUp`
- Top-up only when `paymasterBalance < threshold`
- Vault funds leave only via top-up to `paymaster` or owner `withdraw`
- Pause blocks deposits and top-ups
- Invariant: `INITIAL + deposits = vault + withdrawals + toppedUp`

## 2. Software & Infrastructure Testing

| Level | Scope | Status / entrypoint |
|-------|-------|---------------------|
| Contract unit | Solidity | `contracts/test/*.t.sol` |
| Keeper unit | Go daemon | `cd cmd/keeper && go test ./...` (when present) |
| Integration | Contract + keeper + Base RPC | Base Sepolia; see `docs/KEEPER_DEPLOYMENT.md` |
| Penetration | Next.js dashboard & API | OWASP ZAP / Burp against staging |

## 3. Regulatory & Operational Certifications (B2B SaaS)

Only required if packaging as a **custodial / managed** commercial platform:

- **SOC 2 Type II** — ops security, availability, access control
- **ISO/IEC 27001** — ISMS
- **VASP / CASP / MiCA / FinCEN MSB** — if custody or payment facilitation applies

**Non-custodial note:** When clients own private keys and the treasury (this vault’s
owner/keeper model), regulatory burden is typically much lower. Still run audits and
SOC-style controls for enterprise sales.

## Recommended order of work

1. Green `forge test --profile ci`
2. Clean Slither High/Medium
3. Base Sepolia integration with keeper
4. External audit engagement
5. Mainnet deploy + observability (`docs/KEEPER_OBSERVABILITY.md`)
6. SOC 2 / ISO only if offering managed B2B SaaS with customer data / custody
