'use client';

import type { ReactNode } from 'react';

import { useMainLayout }  from '../MainLayoutProvider';
import styles             from './styles.module.css';
import LeftPanel          from '../LeftPanel';
import CenterPanel        from '../CenterPanel';
import RightPanel         from '../RightPanel';
import ResizableHandle    from '../ResizableHandle';


function PanelLayout({ children }: { children: ReactNode }) {
  const { leftCollapsed, rightCollapsed, swapped } = useMainLayout();

  return (
    <div
      className={styles['panel-layout']}
      data-left-collapsed={leftCollapsed || undefined}
      data-right-collapsed={rightCollapsed || undefined}
      data-swapped={swapped || undefined}
    >
      {/* Left block */}
      <aside className={styles['left']}>
        <LeftPanel collapsed={leftCollapsed} />
      </aside>
      <div className={styles['handle-left']}>
        <ResizableHandle side="left" />
      </div>

      {/* Center content */}
      <main className={styles['center']}>
        <CenterPanel>{children}</CenterPanel>
      </main>

      {/* Right block */}
      <div className={styles['handle-right']}>
        <ResizableHandle side="right" />
      </div>
      <aside className={styles['right']}>
        <RightPanel collapsed={rightCollapsed} />
      </aside>
    </div>
  );
}


export default PanelLayout;
