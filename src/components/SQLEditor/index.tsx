'use client';

import styles from './styles.module.css';


function SQLEditor() {
  return (
    <div className={styles['sql-editor']}>
      <div className={styles['header']}>
        <h2 className={styles['title']}>SQL Editor</h2>
      </div>
      <div className={styles['editor-container']}>
        <textarea
          className={styles['editor']}
          placeholder="-- Enter your SQL query here..."
          rows={12}
        />
      </div>
      <div className={styles['toolbar']}>
        <button className={styles['run-button']}>
          Run Query
        </button>
        <button className={styles['clear-button']}>
          Clear
        </button>
      </div>
    </div>
  );
}


export default SQLEditor;
