'use client';

import { useOpSpaceLayout } from '@Components/layout/OpSpaceProvider';
import Icon                 from '@Components/Icons';

import QueryTree            from './QueryTree';
import Tabs                 from './Tabs';
import HistoryList          from './HistoryList';
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

      {/* AIDEV-NOTE: Keep tabs and both panels mounted; hide via collapsed state above */}
      <div style={{ display: collapsed ? 'none' : 'contents' }} aria-hidden={collapsed}>
        <Tabs
          defaultTabId='queries'
          tabs={[
            { id: 'queries', label: 'Queries', icon: 'file-lines', panel: <QueryTree rootId='root' /> },
            { id: 'history', label: 'History', icon: 'clock-rotate-left', panel: <HistoryList /> }
          ]}
        />
      </div>
    </div>
  );
}


export default DirectoryPanel;
