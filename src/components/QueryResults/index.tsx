'use client';

import styles from './styles.module.css';


function QueryResults() {
  return (
    <div className={styles['query-results']}>
      <div className={styles['header']}>
        <h2 className={styles['title']}>Query Results</h2>
        <div className={styles['status']}>
          <span className={styles['status-text']}>Ready to execute query</span>
        </div>
      </div>
      <div className={styles['results-container']}>
        <div className={styles['placeholder']}>
          <div className={styles['placeholder-icon']}>
            📊
          </div>
          <p className={styles['placeholder-text']}>
            No query results yet. Execute a SQL query to see the results here.
          </p>
        </div>
      </div>
      <div className={styles['footer']}>
        <div className={styles['info']}>
          <span className={styles['info-text']}>0 rows • 0ms execution time</span>
        </div>
      </div>
    </div>
  );
}


export default QueryResults;
