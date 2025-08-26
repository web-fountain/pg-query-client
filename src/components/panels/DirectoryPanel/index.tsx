'use client';

import { useOpSpaceLayout } from '@Components/layout/OpSpaceProvider';
import { useClientRoute }   from '@Components/providers/ClientRouteProvider';
import styles               from './styles.module.css';


function DirectoryPanel({ collapsed, side = 'right' }: { collapsed: boolean; side?: 'left' | 'right' }) {
  const { expandSide } = useOpSpaceLayout();
  const { clientId }   = useClientRoute();

  return (
    <div
      className={styles['directory-panel']}
      data-collapsed={collapsed || undefined}
      data-panel-side={side}
    >
      {collapsed ? (
        <div className={styles['collapsed-icon']} onClick={() => expandSide(side)}>
          {/* AIDEV-NOTE: Icon-only view when collapsed to 40px width */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
      ) : (
        <div className={styles['placeholder']}>Directory Panel (client {clientId.slice(0, 8)}…)</div>
      )}
    </div>
  );
}


export default DirectoryPanel;
