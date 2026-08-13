/**
 * Documentation site navigation — docs.agentexec.io tree.
 * Used by the Next.js docs portal under /docs.
 */
export type DocsNavItem = {
  title: string;
  href: string;
};

export type DocsNavSection = {
  title: string;
  items: DocsNavItem[];
};

export const docsNav: DocsNavSection[] = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Overview & Architecture', href: '/docs/getting-started/overview' },
      { title: 'Quickstart: MCP', href: '/docs/getting-started/quickstart-mcp' },
      { title: 'Installing @agent-exec/sdk', href: '/docs/getting-started/install-sdk' },
      { title: 'API Key Management', href: '/docs/getting-started/api-keys' },
    ],
  },
  {
    title: 'Core Concepts',
    items: [
      {
        title: 'Session-Bounded Wallets (EIP-7579)',
        href: '/docs/concepts/session-keys',
      },
      {
        title: 'Pre-Flight Simulation (Tenderly)',
        href: '/docs/concepts/tenderly',
      },
      {
        title: 'x402 HTTP Micropayments',
        href: '/docs/concepts/x402',
      },
      {
        title: 'AI Security Firewall',
        href: '/docs/concepts/firewall',
      },
    ],
  },
  {
    title: 'Hands-on Guides',
    items: [
      {
        title: 'Protecting APIs with x402',
        href: '/docs/guides/protecting-apis',
      },
      {
        title: 'Spending Caps & Whitelists',
        href: '/docs/guides/session-keys',
      },
      {
        title: 'Agent-to-Agent Escrows',
        href: '/docs/guides/agent-escrows',
      },
      {
        title: 'Claude & Cursor Integration',
        href: '/docs/guides/claude-cursor',
      },
      {
        title: 'x402 Client Integration',
        href: '/docs/guides/x402-integration',
      },
    ],
  },
  {
    title: 'SDK & API Reference',
    items: [
      { title: 'TypeScript / Node.js SDK', href: '/docs/reference/typescript-sdk' },
      { title: 'Go Gateway API', href: '/docs/reference/go-gateway' },
      { title: 'OpenAPI 3.0 Reference', href: '/docs/reference/openapi' },
    ],
  },
];

/** Map URL path after /docs/ → content file under content/docs/ */
export function hrefToContentPath(href: string): string {
  const slug = href.replace(/^\/docs\/?/, '');
  return slug || 'index';
}
