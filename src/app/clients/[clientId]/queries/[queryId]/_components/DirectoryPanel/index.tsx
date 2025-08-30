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
      {/* AIDEV-NOTE: Always render both views to preserve QueryTree state */}
      <div
        className={styles['collapsed-icon']}
        onClick={() => layout.expandSide(side)}
        style={{ display: collapsed ? 'flex' : 'none' }}
        aria-hidden={!collapsed}
      >
        <Icon name={side === 'right' ? 'panel-layout-right' : 'panel-layout-left'} aria-hidden='true' />
      </div>

      {/* AIDEV-NOTE: Keep QueryTree mounted but hidden when collapsed */}
      <div style={{ display: collapsed ? 'none' : 'contents' }} aria-hidden={collapsed}>
        <QueryTree rootId='root' />
      </div>
    </div>
  );
}


export default DirectoryPanel;
