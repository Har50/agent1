'use client';

import { WebMCPProvider } from '@/components/WebMCPProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return <WebMCPProvider>{children}</WebMCPProvider>;
}
