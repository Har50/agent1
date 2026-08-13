# Developer Documentation Portal

Hosted path (local): **http://localhost:3001/docs**  
Target production host: `docs.agentexec.io`

## Architecture

- **Nav tree:** `website/src/config/docs-nav.ts`
- **MDX content:** `website/content/docs/**/*.mdx`
- **Routes:** `website/src/app/docs/[[...slug]]`
- **OpenAPI:** `website/public/openapi.yaml`

Structure mirrors a Fumadocs-style portal (sidebar sections + MDX guides). Content can be migrated to full `fumadocs-mdx` when upgrading to Next 15+/Tailwind 4.

## Sections

1. Getting Started
2. Core Concepts
3. Hands-on Guides (session keys + x402 samples included)
4. SDK & API Reference
