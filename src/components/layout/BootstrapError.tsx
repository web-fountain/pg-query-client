'use client';

import styles from './BootstrapError.module.css';


// AIDEV-NOTE: Client component for workspace bootstrap failure.
// Uses window.location.reload() because this is shown when server data
// fetch fails - no Redux state available to retry via dispatch.
function BootstrapError({ requestId }: { requestId?: string }) {
  return (
    <div className={styles['container']}>
      <div className={styles['card']}>
        <div className={styles['icon']}>⚠</div>
        <h2 className={styles['title']}>Failed to load workspace</h2>
        <p className={styles['message']}>
          Something went wrong while loading your workspace data.
          Please try again.
        </p>
        {requestId ? (
          <p className={styles['request-id']}>
            Error ID: <code className={styles['request-id-code']}>{requestId}</code>
          </p>
        ) : null}
        <button
          type="button"
          className={styles['button']}
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    </div>
  );
}


export default BootstrapError;
