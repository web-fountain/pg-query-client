'use client';

import type { ReactNode } from 'react';
import type { UUIDv7 }    from '@Types/primitives';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef
} from 'react';

import type { RunSqlRequest, SqlRunResult } from '@Types/sqlRunner';

import { useReduxDispatch, useReduxSelector } from '@Redux/storeHooks';
import {
  finishDataQueryExecution,
  startDataQueryExecution
}                                             from '@Redux/records/dataQueryExecution';
import { selectActiveTabDataSource }          from '@Redux/records/tabbar';
import { useDataSourceUI }                    from './DataSourceProvider';
import { generateUUIDv7 }                     from '@Utils/generateId';
import { logAudit }                           from '@Observability/client';


type SqlRunnerContext = {
  runQuery : (args: { dataQueryId: UUIDv7; sql: string }) => Promise<void>;
  cancel   : (dataQueryId: UUIDv7) => void;
};

const Ctx = createContext<SqlRunnerContext | null>(null);

function SQLRunnerProvider({ children }: { children: ReactNode }) {
  const dispatch = useReduxDispatch();
  const { openConnectServerModal } = useDataSourceUI();
  const activeDataSource = useReduxSelector(selectActiveTabDataSource);

  // AIDEV-NOTE: Keep AbortControllers out of Redux (non-serializable). We track one
  // in-flight execution per dataQueryId.
  type InFlight = { controller: AbortController; executionId: UUIDv7 };
  const controllersRef = useRef<Map<string, InFlight>>(new Map());
  const csrfPromiseRef = useRef<Promise<string> | null>(null);

  const readCsrfToken = useCallback((): string => {
    try {
      const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
      return meta?.content || '';
    } catch {
      return '';
    }
  }, []);

  const ensureCsrfToken = useCallback(async (): Promise<string> => {
    const existing = readCsrfToken();
    if (existing) return existing;

    if (csrfPromiseRef.current) return csrfPromiseRef.current;

    csrfPromiseRef.current = (async () => {
      try {
        const res = await fetch('/api/csrf', { cache: 'no-store' });
        if (!res.ok) return '';
        const payload = await res.json().catch(() => null);
        const token = typeof payload?.token === 'string' ? payload.token : '';
        if (!token) return '';

        try {
          let meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
          if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'csrf-token';
            document.head.appendChild(meta);
          }
          meta.setAttribute('content', token);
        } catch {}

        return token;
      } catch {
        return '';
      } finally {
        csrfPromiseRef.current = null;
      }
    })();

    return csrfPromiseRef.current;
  }, [readCsrfToken]);

  const cancel = useCallback((dataQueryId: UUIDv7) => {
    const inFlight = controllersRef.current.get(dataQueryId);
    if (!inFlight) return;

    try { inFlight.controller.abort(); } catch {}

    // AIDEV-NOTE: Best-effort backend cancellation (if supported). The UI is still
    // responsive even if the backend doesn't implement cancel yet.
    void (async () => {
      const csrf = await ensureCsrfToken();
      if (!csrf) return;
      try {
        await fetch(`/api/query-executions/${encodeURIComponent(inFlight.executionId)}/cancel`, {
          method  : 'POST',
          headers : { 'x-csrf-token': csrf }
        });
      } catch {
        // ignore
      }
    })();
  }, [ensureCsrfToken]);

  const runQuery = useCallback(async ({ dataQueryId, sql }: { dataQueryId: UUIDv7; sql: string }) => {
    // AIDEV-NOTE: Preserve original SQL exactly; only guard against fully-empty (whitespace-only) submissions.
    const raw = sql;
    if ((raw || '').trim().length === 0) return;

    const activeDataSourceId = activeDataSource?.dataSourceId;
    if (!activeDataSourceId) {
      openConnectServerModal();
      return;
    }

    // Prevent duplicate in-flight runs for the same query.
    if (controllersRef.current.has(dataQueryId)) {
      return;
    }

    const executionId = generateUUIDv7();
    const startedAt   = new Date().toISOString();

    dispatch(startDataQueryExecution({
      dataQueryExecutionId : executionId,
      dataQueryId          : dataQueryId,
      dataSourceId         : activeDataSourceId,
      status               : 'running',
      startedAt            : startedAt,
      executedBodyTextLen  : typeof raw === 'string' ? raw.length : 0
    }));

    // Audit event (no SQL text).
    try { logAudit({ event: 'query:execute', dataQueryId: dataQueryId }); } catch {}

    const controller = new AbortController();
    controllersRef.current.set(dataQueryId, { controller, executionId });

    const startedPerf = performance.now();
    try {
      const body: RunSqlRequest = {
        dataQueryId           : dataQueryId,
        dataSourceId          : activeDataSourceId,
        executedBodyText      : raw,
        parameters            : null,
        dbRole                : null,
        dataQueryExecutionId  : executionId
      };

      const csrf = await ensureCsrfToken();
      const res = await fetch('/api/run-sql', {
        method  : 'POST',
        headers : {
          'content-type'  : 'application/json',
          'x-csrf-token'  : csrf
        },
        body    : JSON.stringify(body),
        signal  : controller.signal
      });

      const elapsedMs = Math.max(0, Math.round(performance.now() - startedPerf));
      let payload: SqlRunResult | null = null;
      try { payload = await res.json(); } catch {}

      if (!res.ok) {
        const status = res.status === 504 ? 'timeout' : 'error';
        dispatch(finishDataQueryExecution({
          dataQueryId          : dataQueryId,
          dataQueryExecutionId : executionId,
          status               : status,
          finishedAt           : new Date().toISOString(),
          durationMs           : elapsedMs,
          message              : payload && !payload.ok ? payload.error : 'Query failed'
        }));
        return;
      }

      if (!payload) {
        dispatch(finishDataQueryExecution({
          dataQueryId          : dataQueryId,
          dataQueryExecutionId : executionId,
          status               : 'error',
          finishedAt           : new Date().toISOString(),
          durationMs           : elapsedMs,
          message              : 'Invalid server response'
        }));
        return;
      }

      if (!payload.ok) {
        dispatch(finishDataQueryExecution({
          dataQueryId          : dataQueryId,
          dataQueryExecutionId : executionId,
          status               : 'error',
          finishedAt           : new Date().toISOString(),
          durationMs           : elapsedMs,
          message              : payload.error
        }));
        return;
      }

      const exec = payload.dataQueryExecution;
      dispatch(finishDataQueryExecution({
        dataQueryId          : dataQueryId,
        dataQueryExecutionId : executionId,
        status               : exec.status,
        finishedAt           : typeof exec.finishedAt === 'string' ? exec.finishedAt : new Date().toISOString(),
        durationMs           : typeof exec.durationMs === 'number' ? exec.durationMs : elapsedMs,
        rowCount             : typeof exec.rowCount === 'number' ? exec.rowCount : null,
        message              : typeof exec.message === 'string' ? exec.message : null,
        resultPayload        : typeof exec.resultPayload !== 'undefined' ? exec.resultPayload : null,
        resultBlobRef        : typeof exec.resultBlobRef === 'string' ? exec.resultBlobRef : null
      }));
    } catch (e: unknown) {
      const elapsedMs = Math.max(0, Math.round(performance.now() - startedPerf));
      const isAbort = (e as any)?.name === 'AbortError';
      dispatch(finishDataQueryExecution({
        dataQueryId          : dataQueryId,
        dataQueryExecutionId : executionId,
        status               : isAbort ? 'canceled' : 'error',
        finishedAt           : new Date().toISOString(),
        durationMs           : elapsedMs,
        message              : isAbort ? 'Canceled' : (e instanceof Error ? e.message : 'Network error')
      }));
    } finally {
      controllersRef.current.delete(dataQueryId);
    }
  }, [activeDataSource?.dataSourceId, dispatch, ensureCsrfToken, openConnectServerModal]);

  const value: SqlRunnerContext = useMemo(() => ({
    runQuery,
    cancel
  }), [runQuery, cancel]);

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
