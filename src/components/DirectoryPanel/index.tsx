'use client';

import type { ReactNode }   from 'react';
import { useOpSpaceLayout } from '@Components/layout/OpSpaceProvider';
import Icon                 from '@Components/Icons';

import UnsavedQueryTree     from './UnsavedQueryTree';
import QueriesTree          from './QueriesTree';

import styles               from './styles.module.css';


type Props = {
  side?      : 'left' | 'right';
  // AIDEV-NOTE: Optional streaming slots; falls back to client trees when not provided.
  unsavedSlot?: ReactNode;
  queriesSlot?: ReactNode;
};

function DirectoryPanel({ side = 'right', unsavedSlot, queriesSlot }: Props) {
  const layout    = useOpSpaceLayout();
  const collapsed = layout.getConfig(side).collapsed;

  return (
    <div
      className={styles['directory-panel']}
      data-collapsed={collapsed || undefined}
      data-panel-side={side}
    >
      <div
        className={styles['collapsed-icon']}
        onClick={() => layout.expandSide(side)}
        style={{ display: collapsed ? 'flex' : 'none' }}
        aria-hidden={!collapsed}
      >
        <Icon name={side === 'right' ? 'panel-layout-right' : 'panel-layout-left'} aria-hidden='true' />
      </div>

      <div className={styles['sections']} style={{ display: collapsed ? 'none' : 'flex' }} aria-hidden={collapsed}>
        <div className={styles['section-wrapper']} data-expanded='true'>
          {unsavedSlot ?? <UnsavedQueryTree rootId='unsaved-queries' label='Unsaved Queries' />}
        </div>
        <div className={styles['section-wrapper']} data-expanded='true'>
          {queriesSlot ?? <QueriesTree rootId='queries' label='Queries' />}
        </div>
      </div>
    </div>
  );
}


export default DirectoryPanel;
