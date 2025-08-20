'use client';

import type { ReactNode } from 'react';

import MainLayoutProvider from '../MainLayoutProvider';
import Header             from '../Header';
import PanelLayout        from '../PanelLayout';
import styles             from './styles.module.css';


function MainLayout({ children }: { children: ReactNode }) {
  return (
    <MainLayoutProvider>
      <div className={styles['main-layout']}>
        <Header />
        <PanelLayout>{children}</PanelLayout>
      </div>
    </MainLayoutProvider>
  );
}


export default MainLayout;
