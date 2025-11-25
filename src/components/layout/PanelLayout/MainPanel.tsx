'use client';

import type { ReactNode } from 'react';
import styles             from './styles.module.css';


function MainPanel({ children }: { children: ReactNode }) {
  return (
    <main className={styles['center']}>
      {children}
    </main>
  );
}


export default MainPanel;
