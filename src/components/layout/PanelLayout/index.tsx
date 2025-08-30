'use client';

import type { ReactElement, ReactNode } from 'react';

import React                            from 'react';
import { useOpSpaceLayout }             from '../OpSpaceProvider';
import QueryToolPanel                   from '../QueryToolPanel';
import ResizableHandle                  from '../ResizableHandle';

import styles                           from './styles.module.css';


type Side = 'left' | 'right';
type PanelChild = ReactElement<{ collapsed: boolean; side?: Side }>;

function PanelLayout({ children, left, right }: { children: ReactNode; left?: PanelChild; right?: PanelChild }) {
  // AIDEV-NOTE: Side content is provided via slots; layout owns placement and collapse state via Redux.
  const layoutCtx       = useOpSpaceLayout();
  const leftCfg         = layoutCtx.getConfig('left');
  const rightCfg        = layoutCtx.getConfig('right');
  const contentSwapped  = layoutCtx.isContentSwapped();

  // AIDEV-NOTE: Keep instances in their original asides; CSS swaps visual positions
  const leftSlot  = left;
  const rightSlot = right;

  return (
    <div
      className={styles['panel-layout']}
      data-op-space-layout="root"
      data-left-collapsed={leftCfg.collapsed || undefined}
      data-right-collapsed={rightCfg.collapsed || undefined}
      data-content-swapped={contentSwapped || undefined}
    >
      {leftSlot ? (
        <>
          <aside
            className={styles['left-side']}
            data-op-space-layout-side="left"
            aria-expanded={!leftCfg.collapsed}
          >
            {React.cloneElement(
              leftSlot as React.ReactElement<any>,
              { collapsed: leftCfg.collapsed, side: 'left' }
            )}
          </aside>
          <div className={styles['handle-left']}>
            <ResizableHandle side="left" />
          </div>
        </>
      ) : null}

      <main className={styles['center']}>
        <QueryToolPanel>{children}</QueryToolPanel>
      </main>

      {rightSlot ? (
        <>
          <div className={styles['handle-right']}>
            <ResizableHandle side="right" />
          </div>
          <aside
            className={styles['right-side']}
            data-op-space-layout-side="right"
            aria-expanded={!rightCfg.collapsed}
          >
            {React.cloneElement(
              rightSlot as React.ReactElement<any>,
              { collapsed: rightCfg.collapsed, side: 'right' }
            )}
          </aside>
        </>
      ) : null}
    </div>
  );
}


export default PanelLayout;
