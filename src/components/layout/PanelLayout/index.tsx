'use client';

import type { ReactNode } from 'react';

import { useMainLayout }  from '../MainLayoutProvider';
import styles             from './styles.module.css';
import LeftPanel          from '../LeftPanel';
import CenterPanel        from '../CenterPanel';
import RightPanel         from '../RightPanel';
import ResizableHandle    from '../ResizableHandle';


function PanelLayout({ children }: { children: ReactNode }) {
  // AIDEV-NOTE: Static grid; content mapping flips via provider. Handles are side-fixed.
  const { getConfig, isContentSwapped } = useMainLayout();
  const left = getConfig('left');
  const right = getConfig('right');
  const contentSwapped = isContentSwapped();

  return (
    <div
      className={styles['panel-layout']}
      data-left-collapsed={left.collapsed || undefined}
      data-right-collapsed={right.collapsed || undefined}
    >
      {/* Left block */}
      <aside className={styles['left']}>
        {contentSwapped
          ? <RightPanel collapsed={left.collapsed} side="left" />
          : <LeftPanel  collapsed={left.collapsed}  side="left" />}
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
        {contentSwapped
          ? <LeftPanel  collapsed={right.collapsed} side="right" />
          : <RightPanel collapsed={right.collapsed} side="right" />}
      </aside>
    </div>
  );
}


export default PanelLayout;
