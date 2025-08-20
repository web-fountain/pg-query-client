'use client';

import type { ReactNode } from 'react';
import styles             from './styles.module.css';


function CenterPanel({ children }: { children: ReactNode }) {
  return (
    <div className={styles['center-panel']}>
      {children}
    </div>
  );
}


export default CenterPanel;
