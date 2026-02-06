'use client';

import { useMemo, useState }              from 'react';

import { useReduxSelector }               from '@Redux/storeHooks';
import { selectLatestDataQueryExecution } from '@Redux/records/dataQueryExecution';

import { useQueriesRoute }                from '../../_providers/QueriesRouteProvider';
import JSONEditor                         from '../JSONEditor';

import styles                             from './styles.module.css';


function QueryResults() {
  const { dataQueryId }           = useQueriesRoute();
  const latestExecution           = useReduxSelector(selectLatestDataQueryExecution, dataQueryId);
  const [activeTab, setActiveTab] = useState<'data-output' | 'messages'>('data-output');

  const executionPayload = useMemo<Record<string, unknown> | null>(() => {
    if (!latestExecution) return null;
    if (latestExecution.status !== 'succeeded') return null;

    const rows      = Array.isArray(latestExecution.rows) ? latestExecution.rows : [];
    const rowCount  = typeof latestExecution.rowCount === 'number' ? latestExecution.rowCount : rows.length;
    const elapsedMs = typeof latestExecution.elapsedMs === 'number' ? latestExecution.elapsedMs : 0;

    return {
      rows,
      rowCount,
      fields: Array.isArray(latestExecution.fields) ? latestExecution.fields : undefined,
      elapsedMs,
      isTruncated: Boolean(latestExecution.isTruncated)
    };
  }, [latestExecution]);

  const panelHeader = useMemo(() => {
    if (!latestExecution) return null;
    if (latestExecution.status !== 'succeeded') return null;

    const rowCount = typeof latestExecution.rowCount === 'number' ? latestExecution.rowCount : 0;
    const elapsedMs = typeof latestExecution.elapsedMs === 'number' ? latestExecution.elapsedMs : null;
    const returnedRows = Array.isArray(latestExecution.rows) ? latestExecution.rows.length : 0;

    const isTruncated =
      Boolean(latestExecution.isTruncated)
        || (returnedRows > 0 && rowCount > returnedRows);

    const rowsLabel = isTruncated
      ? `Showing rows: ${returnedRows} (of ${rowCount})`
      : `Total rows: ${rowCount}`;

    return (
      <div className={styles['panel-header']}>
        <span className={styles['panel-header-item']}>{rowsLabel}</span>
        {elapsedMs !== null && (
          <span className={styles['panel-header-item']}>Query complete: {elapsedMs} ms</span>
        )}
      </div>
    );
  }, [latestExecution]);

  const messagesText = useMemo(() => {
    if (!latestExecution) {
      return 'No messages. Execute a query to see messages.';
    }

    if (latestExecution.status === 'running') {
      return 'Running query…';
    }

    if (latestExecution.status === 'failed') {
      return latestExecution.error || latestExecution.message || 'Query failed.';
    }

    const elapsed = Math.max(0, Number(latestExecution.elapsedMs || 0));
    const rows = Array.isArray(latestExecution.rows) ? latestExecution.rows : [];
    const rowCount = typeof latestExecution.rowCount === 'number' ? latestExecution.rowCount : rows.length;

    const isTruncated =
      Boolean(latestExecution.isTruncated)
        || (rows.length > 0 && rowCount > rows.length);

    const suffix = isTruncated
      ? ` Showing first ${rows.length} rows (of ${rowCount}).`
      : '';

    const base = latestExecution.message
      ? latestExecution.message
      : `Successfully run. Total query runtime: ${elapsed} msec. ${rowCount} rows affected.`;

    return `${base}${suffix}`;
  }, [latestExecution]);

  return (
    <div className={styles['query-results']}>
      {/* AIDEV-NOTE: Results tab strip (compact, also serves as header). */}
      <div className={styles['tabs-bar']}>
        <div role="tablist" aria-label="Results tabs" aria-orientation="horizontal">
          <button
            role="tab"
            id="tab-data-output"
            aria-controls="panel-data-output"
            aria-selected={activeTab === 'data-output'}
            className={styles['tab']}
            tabIndex={activeTab === 'data-output' ? 0 : -1}
            onClick={() => setActiveTab('data-output')}
          >
            Results
          </button>
          <button
            role="tab"
            id="tab-messages"
            aria-controls="panel-messages"
            aria-selected={activeTab === 'messages'}
            className={styles['tab']}
            tabIndex={activeTab === 'messages' ? 0 : -1}
            onClick={() => setActiveTab('messages')}
          >
            Messages
          </button>
        </div>
      </div>

      {/* AIDEV-NOTE: Active tabpanel */}
      {activeTab === 'data-output' && (
        <div
          id="panel-data-output"
          role="tabpanel"
          aria-labelledby="tab-data-output"
          className={styles['tabpanel']}
        >
          {panelHeader}
          <div className={styles['results-container']}>
            {executionPayload ? (
              <JSONEditor value={executionPayload} />
            ) : (
              <div className={styles['placeholder']}>
                <div className={styles['placeholder-icon']}>📊</div>
                <p className={styles['placeholder-text']}>
                  {latestExecution?.status === 'running'
                    ? 'Running query…'
                    : latestExecution?.status === 'failed'
                      ? 'Query failed. See Messages for details.'
                      : 'No data output. Execute a query to get output.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'messages' && (
        <div
          id="panel-messages"
          role="tabpanel"
          aria-labelledby="tab-messages"
          className={styles['tabpanel']}
        >
          <div className={styles['results-container']}>
            <p className={styles['message-text']}>{messagesText}</p>
          </div>
        </div>
      )}

      {/* AIDEV-NOTE: Footer hidden by CSS for now. */}
      <div className={styles['footer']}>
        <div className={styles['info']}>
          <span className={styles['info-text']} />
        </div>
      </div>
    </div>
  );
}


export default QueryResults;
