'use client';

import type { DataQueryExecutionRecord }                from './types';

import { useMemo, useState }                            from 'react';
import JSONEditor                                       from '@Components/JSONEditor';
import { useSqlRunner }                                 from '@Components/providers/SQLRunnerProvider';

import styles                                           from './styles.module.css';


function QueryResults() {
  const { lastResult, lastError, sqlText } = useSqlRunner();
  const [activeTab, setActiveTab] = useState<'data-output' | 'messages'>('data-output');

  // AIDEV-NOTE: Shape current provider results into the requested DataQueryExecutionRecord.
  const executionPayload = useMemo<DataQueryExecutionRecord | null>(() => {
    if (!lastResult) return null;
    const elapsed = Math.max(0, Number(lastResult.elapsedMs || 0));
    const iso = new Date().toISOString();
    return {
      default: [
        {
          dataSourceId: 'default',
          dataQueryId: 'default',
          queryText: sqlText || '',
          parameters: {},
          interpolatedQueryText: sqlText || '',
          queryTime: `${elapsed} ms`,
          dateTime: iso,
          duration: `${elapsed} ms`,
          totalRows: Number(lastResult.rowCount || 0),
          message: `Successfully run. Total query runtime: ${elapsed} msec. ${Number(lastResult.rowCount || 0)} rows affected.`,
          results: Array.isArray(lastResult.rows) ? lastResult.rows : []
        }
      ]
    };
  }, [lastResult, sqlText]);

  const panelHeader = useMemo(() => {
    if (!lastResult) return null;
    return (
      <div className={styles['panel-header']}>
        <span className={styles['panel-header-item']}>Total rows: {lastResult.rowCount}</span>
        <span className={styles['panel-header-item']}>Query complete: {lastResult.elapsedMs} ms</span>
      </div>
    );
  }, [lastResult]);

  const messagesText = useMemo(() => {
    if (lastError) return lastError.error;
    if (lastResult) {
      const elapsed = Math.max(0, Number(lastResult.elapsedMs || 0));
      return `Successfully run. Total query runtime: ${elapsed} msec. ${Number(lastResult.rowCount || 0)} rows affected.`;
    }
    return 'No messages. Execute a query to see messages.';
  }, [lastResult, lastError]);

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
            Data Output
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
                <p className={styles['placeholder-text']}>No data output. Execute a query to get output.</p>
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
