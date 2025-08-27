'use client';

import type { ReactNode } from 'react';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';


type SqlRunSuccess = {
  rows: unknown[];
  rowCount: number;
  fields?: string[];
  elapsedMs: number;
};

type SqlRunError = {
  error: string;
  elapsedMs: number;
};

type SqlRunnerContext = {
  clientId: string;
  sqlText: string;
  setSqlText: (next: string) => void;
  isRunning: boolean;
  lastResult: SqlRunSuccess | null;
  lastError: SqlRunError | null;
  runQuery: (sqlArg?: string) => Promise<void>;
  clear: () => void;
};

const Ctx = createContext<SqlRunnerContext | null>(null);

function SQLRunnerProvider({ clientId, children }: { clientId: string; children: ReactNode }) {
  const [sqlText, setSqlText] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<SqlRunSuccess | null>(null);
  const [lastError, setLastError] = useState<SqlRunError | null>(null);

  const runQuery = useCallback(async (sqlArg?: string) => {
    // AIDEV-NOTE: Preserve original SQL exactly; only guard against fully-empty (whitespace-only) submissions.
    const raw = typeof sqlArg === 'string' ? sqlArg : sqlText;
    if ((raw || '').trim().length === 0) return;

    setSqlText(raw);
    setIsRunning(true);
    setLastError(null);
    const started = performance.now();
    try {
      const res = await fetch(`/api/run-sql?clientId=${encodeURIComponent(clientId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: raw
      });
      const elapsedMs = Math.max(0, Math.round(performance.now() - started));
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: 'Unknown error' }));
        setLastResult(null);
        setLastError({ error: payload?.error || 'Query failed', elapsedMs });
      } else {
        const payload = await res.json();
        const result: SqlRunSuccess = {
          rows: Array.isArray(payload?.rows) ? payload.rows : [],
          rowCount: typeof payload?.rowCount === 'number' ? payload.rowCount : 0,
          fields: Array.isArray(payload?.fields) ? payload.fields : undefined,
          elapsedMs: typeof payload?.elapsedMs === 'number' ? payload.elapsedMs : elapsedMs
        };
        setLastResult(result);
        setLastError(null);
      }
    } catch (e: unknown) {
      const elapsedMs = Math.max(0, Math.round(performance.now() - started));
      const message = e instanceof Error ? e.message : 'Network error';
      setLastResult(null);
      setLastError({ error: message, elapsedMs });
    } finally {
      setIsRunning(false);
    }
  }, [sqlText, clientId]);

  const clear = useCallback(() => {
    setSqlText('');
    setLastResult(null);
    setLastError(null);
  }, []);

  const value: SqlRunnerContext = useMemo(() => ({
    clientId,
    sqlText,
    setSqlText,
    isRunning,
    lastResult,
    lastError,
    runQuery,
    clear
  }), [clientId, sqlText, isRunning, lastResult, lastError, runQuery, clear]);

  return (
    <Ctx.Provider value={value}>{children}</Ctx.Provider>
  );
}

function useSqlRunner(): SqlRunnerContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSqlRunner must be used within SQLRunnerProvider');
  return ctx;
}


export { SQLRunnerProvider, useSqlRunner };
