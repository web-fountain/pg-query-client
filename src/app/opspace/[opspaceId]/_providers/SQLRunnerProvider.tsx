'use client';

import type { ReactNode }                         from 'react';
import type { UUIDv7 }                            from '@Types/primitives';

import {
  createContext, useCallback, useContext,
  useMemo
}                                                 from 'react';

import { logAudit }                               from '@Observability/client/audit';
import { useReduxDispatch, useReduxSelector }     from '@Redux/storeHooks';
import {
  clearDataQueryExecutionsForQuery,
  selectIsDataQueryExecutionRunning,
  upsertDataQueryExecution
}                                                 from '@Redux/records/dataQueryExecution';
import { selectActiveTabDataSourceCredentialId }  from '@Redux/records/dataSource';
import { postQueryExecution }                     from '@Redux/records/dataQueryExecution/api';
import { normalizeQueryExecutionApiPayload }      from '@Redux/records/dataQueryExecution/normalize';
import { generateUUIDv7 }                         from '@Utils/generateId';
import { useQueriesRoute }                        from '../queries/_providers/QueriesRouteProvider';


type SqlRunnerContext = {
  isRunning: boolean;
  runQuery: (sql: string) => Promise<void>;
  clear: () => void;
};

const Ctx = createContext<SqlRunnerContext | null>(null);

function SQLRunnerProvider({ children }: { children: ReactNode }) {
  const { dataQueryId }                 = useQueriesRoute();
  const selectedDataSourceCredentialId  = useReduxSelector(selectActiveTabDataSourceCredentialId);
  const isRunning                       = useReduxSelector(selectIsDataQueryExecutionRunning, dataQueryId);
  const dispatch                        = useReduxDispatch();

  const runQuery = useCallback(async (sql: string) => {
    // AIDEV-NOTE: Preserve original SQL exactly; only guard against fully-empty (whitespace-only) submissions.
    console.log('[SQLRunner] runQuery called', { dataQueryId, selectedDataSourceCredentialId });
    const raw = sql;
    if ((raw || '').trim().length === 0) return;

    const activeDataQueryId = dataQueryId as UUIDv7 | null;
    if (!activeDataQueryId) return;

    const dataSourceCredentialId = selectedDataSourceCredentialId as UUIDv7 | null;
    if (!dataSourceCredentialId) return;

    // AIDEV-NOTE: Keep raw SQL out of Redux actions/state. We only persist length in Redux.
    // This avoids leaking query text via action meta/DevTools while still supporting execution.
    const dataQueryExecutionId = generateUUIDv7();
    const startedAtClient      = new Date().toISOString();

    dispatch(upsertDataQueryExecution({
      dataQueryExecutionId    : dataQueryExecutionId,
      dataQueryId             : activeDataQueryId,
      dataSourceCredentialId  : dataSourceCredentialId,
      status                  : 'running',
      queryTextLen            : raw.length,
      startedAt               : startedAtClient
    }));

    // AIDEV-NOTE: Fire-and-forget audit event for correlation/compliance; never include raw SQL.
    try {
      logAudit({ event: 'query:execute', dataQueryId: activeDataQueryId });
    } catch {}

    const postResult = await postQueryExecution({
      dataQueryId             : activeDataQueryId,
      dataQueryExecutionId    : dataQueryExecutionId,
      dataSourceCredentialId  : dataSourceCredentialId,
      queryText               : raw
    });

    const finishedAtClient = new Date().toISOString();

    if (!postResult.ok) {
      dispatch(upsertDataQueryExecution({
        dataQueryExecutionId    : dataQueryExecutionId,
        dataQueryId             : activeDataQueryId,
        dataSourceCredentialId  : dataSourceCredentialId,
        status                  : 'failed',
        queryTextLen            : raw.length,
        startedAt               : startedAtClient,
        finishedAt              : finishedAtClient,
        error                   : postResult.message
      }));
      return;
    }

    if (!postResult.httpOk) {
      dispatch(upsertDataQueryExecution({
        dataQueryExecutionId    : dataQueryExecutionId,
        dataQueryId             : activeDataQueryId,
        dataSourceCredentialId  : dataSourceCredentialId,
        status                  : 'failed',
        queryTextLen            : raw.length,
        startedAt               : startedAtClient,
        finishedAt              : finishedAtClient,
        error                   : postResult.message || 'Query failed'
      }));
      return;
    }

    const normalized = normalizeQueryExecutionApiPayload({
      dataQueryExecutionId    : dataQueryExecutionId,
      dataQueryId             : activeDataQueryId,
      dataSourceCredentialId  : dataSourceCredentialId,
      queryTextLen            : raw.length,
      startedAtClient         : startedAtClient,
      finishedAtClient        : finishedAtClient,
      payload                 : postResult.payload
    });

    dispatch(upsertDataQueryExecution(normalized));
  }, [dataQueryId, dispatch, selectedDataSourceCredentialId]);

  const clear = useCallback(() => {
    const activeDataQueryId = dataQueryId as UUIDv7 | null;
    if (!activeDataQueryId) return;
    dispatch(clearDataQueryExecutionsForQuery({ dataQueryId: activeDataQueryId }));
  }, [dataQueryId, dispatch]);

  const value: SqlRunnerContext = useMemo(() => ({
    isRunning,
    runQuery,
    clear
  }), [isRunning, runQuery, clear]);

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
