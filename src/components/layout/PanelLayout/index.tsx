'use client';

import type { ReactNode }   from 'react';

import { useOpSpaceLayout } from '../OpSpaceProvider';
import ChatPanel            from '../ChatPanel';
import QueryToolPanel       from '../QueryToolPanel';
import DirectoryPanel       from '../DirectoryPanel';
import ResizableHandle      from '../ResizableHandle';

import styles               from './styles.module.css';


function PanelLayout({ children }: { children: ReactNode }) {
  // AIDEV-NOTE: Static grid; content mapping flips via provider. Handles are side-fixed.
  const { getConfig, isContentSwapped } = useOpSpaceLayout();
  const left                            = getConfig('left');
  const right                           = getConfig('right');
  const contentSwapped                  = isContentSwapped();

  return (
    <div
      className={styles['panel-layout']}
      data-left-collapsed={left.collapsed || undefined}
      data-right-collapsed={right.collapsed || undefined}
    >
      {/* Left block */}
      <aside className={styles['left-side']}>
        {contentSwapped
          ? <DirectoryPanel collapsed={left.collapsed} side="left" />
          : <ChatPanel collapsed={left.collapsed}  side="left" />}
      </aside>
      <div className={styles['handle-left']}>
        <ResizableHandle side="left" />
      </div>

      {/* Center content */}
      <main className={styles['center']}>
        <QueryToolPanel>{children}</QueryToolPanel>
      </main>

      {/* Right block */}
      <div className={styles['handle-right']}>
        <ResizableHandle side="right" />
      </div>
      <aside className={styles['right-side']}>
        {contentSwapped
          ? <ChatPanel collapsed={right.collapsed} side="right" />
          : <DirectoryPanel collapsed={right.collapsed} side="right" />}
      </aside>
    </div>
  );
}


export default PanelLayout;
