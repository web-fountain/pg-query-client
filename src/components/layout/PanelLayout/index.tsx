'use client';

import React, { type ReactNode, type ReactElement }   from 'react';

import { useOpSpaceLayout } from '../OpSpaceProvider';
import QueryToolPanel       from '../QueryToolPanel';
import ResizableHandle      from '../ResizableHandle';

import styles               from './styles.module.css';


type Side = 'left' | 'right';
type PanelChild = ReactElement<{ collapsed: boolean; side?: Side }>;

function PanelLayout({ children, left, right }: { children: ReactNode; left?: PanelChild; right?: PanelChild }) {
  // AIDEV-NOTE: Side content is provided via slots; layout owns placement and collapse state.
  const { getConfig, isContentSwapped } = useOpSpaceLayout();
  const leftCfg                         = getConfig('left');
  const rightCfg                        = getConfig('right');
  const contentSwapped                  = isContentSwapped();

  const leftSlot  = contentSwapped ? right : left;
  const rightSlot = contentSwapped ? left  : right;

  return (
    <div
      className={styles['panel-layout']}
      data-left-collapsed={leftCfg.collapsed || undefined}
      data-right-collapsed={rightCfg.collapsed || undefined}
    >
      {leftSlot ? (
        <>
          <aside className={styles['left-side']}>
            {React.cloneElement(leftSlot, { collapsed: leftCfg.collapsed, side: 'left' })}
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
          <aside className={styles['right-side']}>
            {React.cloneElement(rightSlot, { collapsed: rightCfg.collapsed, side: 'right' })}
          </aside>
        </>
      ) : null}
    </div>
  );
}


export default PanelLayout;
