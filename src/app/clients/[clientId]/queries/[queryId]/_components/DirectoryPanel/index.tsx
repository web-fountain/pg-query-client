'use client';

import { useOpSpaceLayout } from '@Components/layout/OpSpaceProvider';
import Icon                 from '@Components/Icons';

import QueryTree            from './QueryTree';
import styles               from './styles.module.css';


function DirectoryPanel({ collapsed, side = 'right' }: { collapsed: boolean; side?: 'left' | 'right' }) {
  const layout        = useOpSpaceLayout();

  return (
    <div
      className={styles['directory-panel']}
      data-collapsed={collapsed || undefined}
      data-panel-side={side}
    >
      {collapsed ? (
        <div className={styles['collapsed-icon']} onClick={() => layout.expandSide(side)}>
          {/* AIDEV-NOTE: Icon-only view when collapsed to 40px width */}
          <Icon name={side === 'right' ? 'panel-layout-right' : 'panel-layout-left'} aria-hidden="true" />
        </div>
      ) : (
        <QueryTree rootId="root" />
      )}
    </div>
  );
}


export default DirectoryPanel;
