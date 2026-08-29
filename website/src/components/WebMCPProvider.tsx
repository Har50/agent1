'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

export interface RegisteredTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  priceUSD: number;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

interface WebMCPContextType {
  registerTool: (tool: RegisteredTool) => void;
  getRegisteredTools: () => RegisteredTool[];
}

type ModelContextApi = {
  tools: Map<string, RegisteredTool>;
  registerTool: (tool: RegisteredTool) => void;
  getTools: () => RegisteredTool[];
};

const WebMCPContext = createContext<WebMCPContextType | null>(null);

function ensureNavigatorModelContext(): ModelContextApi {
  const nav = navigator as Navigator & { modelContext?: ModelContextApi };
  if (!nav.modelContext) {
    const toolRegistry = new Map<string, RegisteredTool>();
    nav.modelContext = {
      tools: toolRegistry,
      registerTool(tool: RegisteredTool) {
        toolRegistry.set(tool.name, tool);
      },
      getTools() {
        return Array.from(toolRegistry.values());
      },
    };
  }
  return nav.modelContext;
}

export function WebMCPProvider({ children }: { children: React.ReactNode }) {
  const [, bump] = useState(0);
  const ready = useRef(false);

  useEffect(() => {
    ensureNavigatorModelContext();
    ready.current = true;
    bump((n) => n + 1);
  }, []);

  const registerTool = useCallback((tool: RegisteredTool) => {
    if (typeof window === 'undefined') return;
    ensureNavigatorModelContext().registerTool(tool);
    bump((n) => n + 1);
  }, []);

  const getRegisteredTools = useCallback((): RegisteredTool[] => {
    if (typeof window === 'undefined') return [];
    return ensureNavigatorModelContext().getTools();
  }, []);

  return (
    <WebMCPContext.Provider value={{ registerTool, getRegisteredTools }}>
      {children}
    </WebMCPContext.Provider>
  );
}

export function useWebMCP() {
  const context = useContext(WebMCPContext);
  if (!context) {
    throw new Error('useWebMCP must be wrapped inside <WebMCPProvider />');
  }
  return context;
}
