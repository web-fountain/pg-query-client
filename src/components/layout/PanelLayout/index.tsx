'use client';

import type { ReactNode }   from 'react';

import { useOpSpaceLayout } from '@Components/layout/OpSpaceProvider';
import styles               from './styles.module.css';


function PanelLayout({ children }: { children: ReactNode }) {
  const layoutCtx       = useOpSpaceLayout();
  const leftCfg         = layoutCtx.getConfig('left');
  const rightCfg        = layoutCtx.getConfig('right');
  const contentSwapped  = layoutCtx.isContentSwapped();

  return (
    <div
      className={styles['panel-layout']}
      data-op-space-layout="root"
      data-left-collapsed={leftCfg.collapsed || undefined}
      data-right-collapsed={rightCfg.collapsed || undefined}
      data-content-swapped={contentSwapped || undefined}
    >
      {children}
    </div>
  );
}


export default PanelLayout;
