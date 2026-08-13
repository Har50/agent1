import type { Metadata } from 'next';
import { Bricolage_Grotesque, Figtree, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700', '800'],
});

const sans = Figtree({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'AgentExec — Execution & Money Rails for Autonomous AI',
  description:
    'Developer infrastructure for AI commerce: EIP-7579 session keys, Tenderly dry-runs, Go rate limiting, and x402 HTTP micropayments on Base L2.',
  openGraph: {
    title: 'AgentExec',
    description: 'The execution, security, and micropayment layer for AI agents.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-screen bg-slate-950 antialiased">{children}</body>
    </html>
  );
}
