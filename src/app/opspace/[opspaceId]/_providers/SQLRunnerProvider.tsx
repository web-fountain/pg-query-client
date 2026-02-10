'use client';

import type { ReactNode }                         from 'react';
import type { UUIDv7 }                            from '@Types/primitives';

import {
  createContext, useCallback, useContext,
  useMemo
}                                                 from 'react';

import { logAudit }                               from '@Observability/client/audit';
import { useDataSourceUI }                        from '@OpSpaceProviders/DataSourceProvider';
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
  const { dataQueryId }                   = useQueriesRoute();
  const selectedDataSourceCredentialId    = useReduxSelector(selectActiveTabDataSourceCredentialId);
  const isRunning                         = useReduxSelector(selectIsDataQueryExecutionRunning, dataQueryId);
  const dispatch                          = useReduxDispatch();
  const { openReconnectDataSourceModal }  = useDataSourceUI();

  type RunQueryRequest = {
    sql                     : string;
    dataQueryId             : UUIDv7;
    dataSourceCredentialId  : UUIDv7;
  };

  const runQueryWithIds = useCallback(async (request: RunQueryRequest) => {
    // AIDEV-NOTE: Preserve original SQL exactly; only guard against fully-empty (whitespace-only) submissions.
    const raw = request.sql;
    if ((raw || '').trim().length === 0) return;

    const activeDataQueryId       = request.dataQueryId;
    const dataSourceCredentialId  = request.dataSourceCredentialId;

    // AIDEV-NOTE: Keep raw SQL out of Redux actions/state. We only persist length in Redux.
    // This avoids leaking query text via action meta/DevTools while still supporting execution.
    const dataQueryExecutionId  = generateUUIDv7();
    const startedAtClient       = new Date().toISOString();

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
      const errorCode = postResult.errorCode;
      dispatch(upsertDataQueryExecution({
        dataQueryExecutionId    : dataQueryExecutionId,
        dataQueryId             : activeDataQueryId,
        dataSourceCredentialId  : dataSourceCredentialId,
        status                  : 'failed',
        queryTextLen            : raw.length,
        startedAt               : startedAtClient,
        finishedAt              : finishedAtClient,
        ...(typeof errorCode === 'string' ? { errorCode } : {}),
        error                   : postResult.message || 'Query failed'
      }));

      // AIDEV-NOTE: Request-level failures (`!httpOk`) may still include domain codes.
      // Handle `secret_not_found` here so reconnect works for non-2xx envelopes.
      if (errorCode === 'secret_not_found') {
        openReconnectDataSourceModal({
          dataSourceCredentialId,
          reasonMessage: postResult.message || null,
          onSuccess: () => {
            // AIDEV-NOTE: Intentionally retry the exact failed request context
            // (same SQL + query id + credential id), even if active tab/connection changed.
            runQueryWithIds({ sql: raw, dataQueryId: activeDataQueryId, dataSourceCredentialId });
          }
        });
      }

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

    // AIDEV-NOTE: Execution-level failures come back as HTTP 200 with `status: 'error'`.
    // We check `secret_not_found` here too so both backend error shapes trigger reconnect.
    if (normalized.status === 'failed' && normalized.errorCode === 'secret_not_found') {
      openReconnectDataSourceModal({
        dataSourceCredentialId,
        reasonMessage: normalized.error || null,
        onSuccess: () => {
          // AIDEV-NOTE: Preserve original execution target for deterministic retry.
          runQueryWithIds({ sql: raw, dataQueryId: activeDataQueryId, dataSourceCredentialId });
        }
      });
    }
  }, [dispatch, openReconnectDataSourceModal]);

  const runQuery = useCallback(async (sql: string) => {
    const activeDataQueryId = dataQueryId as UUIDv7 | null;
    if (!activeDataQueryId) return;

    const activeCredentialId = selectedDataSourceCredentialId as UUIDv7 | null;
    if (!activeCredentialId) return;
    await runQueryWithIds({
      sql,
      dataQueryId: activeDataQueryId,
      dataSourceCredentialId: activeCredentialId
    });
  }, [dataQueryId, runQueryWithIds, selectedDataSourceCredentialId]);

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
