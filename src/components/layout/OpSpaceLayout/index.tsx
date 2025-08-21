'use client';

import type { ReactNode } from 'react';

import OpSpaceLayoutProvider  from '../OpSpaceProvider';
import TitleBar               from '../Titlebar';
import PanelLayout            from '../PanelLayout';

import styles                 from './styles.module.css';


function OpSpaceLayout({ children }: { children: ReactNode }) {
  return (
    <OpSpaceLayoutProvider>
      <div className={styles['op-space-layout']}>
        <TitleBar />
        <PanelLayout>{children}</PanelLayout>
      </div>
    </OpSpaceLayoutProvider>
  );
}


export default OpSpaceLayout;
