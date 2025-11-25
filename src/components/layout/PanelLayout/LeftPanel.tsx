'use client';

import type { ReactNode }   from 'react';

import { Activity }         from 'react';
import { useOpSpaceLayout } from '../OpSpaceProvider';
import ResizableHandle      from '../ResizableHandle';

import styles               from './styles.module.css';


function LeftPanel({ children }: { children: ReactNode }) {
  const layout  = useOpSpaceLayout();
  const leftCfg = layout.getConfig('left');

  return (
    <>
      <aside
        className={styles['left-side']}
        data-op-space-layout-side="left"
        aria-expanded={!leftCfg.collapsed}
      >
        {/* AIDEV-NOTE: Keep panel work hidden when collapsed via Activity; preserve state. */}
        <Activity mode={leftCfg.collapsed ? 'hidden' : 'visible'}>
          {children}
        </Activity>
      </aside>

      <div className={styles['handle-left']}>
        <ResizableHandle side="left" />
      </div>
    </>
  );
}


export default LeftPanel;
