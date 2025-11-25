'use client';

import type { ReactNode }   from 'react';

import { Activity }         from 'react';
import { useOpSpaceLayout } from '../OpSpaceProvider';
import ResizableHandle      from '../ResizableHandle';

import styles               from './styles.module.css';


function RightPanel({ children }: { children: ReactNode }) {
  const layout    = useOpSpaceLayout();
  const rightCfg  = layout.getConfig('right');

  return (
    <>
      <div className={styles['handle-right']}>
        <ResizableHandle side="right" />
      </div>

      <aside
        className={styles['right-side']}
        data-op-space-layout-side="right"
        aria-expanded={!rightCfg.collapsed}
      >
        {/* AIDEV-NOTE: Hide heavy work when collapsed, but keep state via Activity. */}
        <Activity mode={rightCfg.collapsed ? 'hidden' : 'visible'}>
          {children}
        </Activity>
      </aside>
    </>
  );
}


export default RightPanel;
