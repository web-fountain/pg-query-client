'use client';

import type { UUIDv7 }                            from '@Types/primitives';
import type { SqlRunnerContextValue }             from './context';

import {
  useCallback,
  useEffectEvent,
  useMemo
}                                                 from 'react';

import { useDataSourceUI }                        from '@OpSpaceProviders/DataSourceProvider';
import { useReduxDispatch, useReduxSelector }     from '@Redux/storeHooks';
import {
  clearDataQueryExecutionsForQuery,
  selectIsDataQueryExecutionRunning
}                                                 from '@Redux/records/dataQueryExecution';
import { executeDataQueryExecution }              from '@Redux/records/dataQueryExecution/execute';
import { selectActiveTabDataSourceCredentialId }  from '@Redux/records/dataSource';
import { useQueriesRoute }                        from '../../queries/_providers/QueriesRouteProvider';


type RunQueryWithIdsRequest = {
  sql: string;
  dataQueryId: UUIDv7;
  dataSourceCredentialId: UUIDv7;
};

function useSqlRunnerValue(): SqlRunnerContextValue {
  const { dataQueryId }                   = useQueriesRoute();
  const selectedDataSourceCredentialId    = useReduxSelector(selectActiveTabDataSourceCredentialId);
  const isRunning                         = useReduxSelector(selectIsDataQueryExecutionRunning, dataQueryId);
  const dispatch                          = useReduxDispatch();
  const { openReconnectDataSourceModal }  = useDataSourceUI();

  const runQueryWithIds = useCallback(async (request: RunQueryWithIdsRequest) => {
    const rawSql = request.sql;

    const executionResult = await executeDataQueryExecution({
      dataQueryId             : request.dataQueryId,
      dataSourceCredentialId  : request.dataSourceCredentialId,
      queryText               : rawSql,
      dispatch
    });

    if (!executionResult.shouldReconnectSecretNotFound) return;

    const activeDataQueryId      = request.dataQueryId;
    const dataSourceCredentialId = request.dataSourceCredentialId;

    openReconnectDataSourceModal({
      dataSourceCredentialId  : dataSourceCredentialId,
      reasonMessage           : executionResult.reconnectReasonMessage,
      onSuccess: () => {
        // AIDEV-NOTE: Intentionally retry the exact failed request context
        // (same SQL + query id + credential id), even if active tab/connection changed.
        runQueryWithIds({ sql: rawSql, dataQueryId: activeDataQueryId, dataSourceCredentialId });
      }
    });
  }, [dispatch, openReconnectDataSourceModal]);

  const runQuery = useEffectEvent(async (sql: string) => {
    const activeDataQueryId = dataQueryId as UUIDv7 | null;
    if (!activeDataQueryId) return;

    const activeCredentialId = selectedDataSourceCredentialId as UUIDv7 | null;
    if (!activeCredentialId) return;

    await runQueryWithIds({
      sql                     : sql,
      dataQueryId             : activeDataQueryId,
      dataSourceCredentialId  : activeCredentialId
    });
  });

  const clear = useEffectEvent(() => {
    const activeDataQueryId = dataQueryId as UUIDv7 | null;
    if (!activeDataQueryId) return;
    dispatch(clearDataQueryExecutionsForQuery({ dataQueryId: activeDataQueryId }));
  });

  const value: SqlRunnerContextValue = useMemo(() => ({
    isRunning,
    runQuery,
    clear
  }), [isRunning, runQuery, clear]);

  return value;
}


export { useSqlRunnerValue };
