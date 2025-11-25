'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';


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
  isRunning: boolean;
  lastResult: SqlRunSuccess | null;
  lastError: SqlRunError | null;
  runQuery: (sql: string) => Promise<void>;
  clear: () => void;
};

const Ctx = createContext<SqlRunnerContext | null>(null);

function SQLRunnerProvider({ children }: { children: ReactNode }) {
  const [isRunning, setIsRunning]   = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<SqlRunSuccess | null>(null);
  const [lastError, setLastError]   = useState<SqlRunError | null>(null);
  const [opspaceId, setOpspaceId] = useState('1H5oIiGmtMi7XQ8qlVwCsw');


  const runQuery = useCallback(async (sql: string) => {
    // AIDEV-NOTE: Preserve original SQL exactly; only guard against fully-empty (whitespace-only) submissions.
    const raw = sql;
    if ((raw || '').trim().length === 0) return;

    setIsRunning(true);
    setLastError(null);
    const started = performance.now();
    try {
      const res = await fetch(`/api/run-sql?opspaceId=${encodeURIComponent(opspaceId)}`, {
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
  }, [opspaceId]);

  const clear = useCallback(() => {
    setLastResult(null);
    setLastError(null);
  }, []);

  const value: SqlRunnerContext = useMemo(() => ({
    opspaceId,
    isRunning,
    lastResult,
    lastError,
    runQuery,
    clear
  }), [opspaceId, isRunning, lastResult, lastError, runQuery, clear]);

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
