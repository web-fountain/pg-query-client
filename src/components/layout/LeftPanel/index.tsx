'use client';

import { useMainLayout } from '../MainLayoutProvider';
import styles from './styles.module.css';


function LeftPanel({ collapsed, side = 'left' }: { collapsed: boolean; side?: 'left' | 'right' }) {
  const { expandSide } = useMainLayout();

  return (
    <div className={styles['left-panel']} data-collapsed={collapsed || undefined}>
      {collapsed ? (
        <div className={styles['collapsed-icon']} onClick={() => expandSide(side)}>
          {/* AIDEV-NOTE: Icon-only view when collapsed to 40px width */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </div>
      ) : (
        <div className={styles['placeholder']}>Left Panel</div>
      )}
    </div>
  );
}


export default LeftPanel;
