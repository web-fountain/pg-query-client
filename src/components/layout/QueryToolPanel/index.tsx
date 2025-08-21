'use client';

import type { ReactNode } from 'react';
import styles             from './styles.module.css';


function QueryToolPanel({ children }: { children: ReactNode }) {
  return (
    <div className={styles['query-tool-panel']}>
      {children}
    </div>
  );
}


export default QueryToolPanel;
