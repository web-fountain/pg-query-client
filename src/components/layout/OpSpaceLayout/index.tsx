'use client';

import type { ReactNode } from 'react';

import { SQLValidatorProvider } from '@/app/opspace/[opspaceId]/queries/[dataQueryId]/_providers/SQLValidatorProvider';
import OpSpaceLayoutProvider    from '../OpSpaceProvider';
import Titlebar                 from '../Titlebar';
import PanelLayout              from '../PanelLayout';

import styles                   from './styles.module.css';


function OpSpaceLayout({ children }: { children: ReactNode }) {
  return (
    <OpSpaceLayoutProvider>
      <SQLValidatorProvider>
        <div className={styles['op-space-layout']}>
          <Titlebar />
          <PanelLayout>{children}</PanelLayout>
        </div>
      </SQLValidatorProvider>
    </OpSpaceLayoutProvider>
  );
}


export default OpSpaceLayout;
