'use client';

import { useReduxDispatch } from '@Redux/storeHooks';
import { expandSide }       from '@Redux/records/layout';
import { useClientRoute }   from '@Components/providers/ClientRouteProvider';
import styles               from './styles.module.css';


function ChatPanel({ collapsed, side = 'left' }: { collapsed: boolean; side?: 'left' | 'right' }) {
  const dispatch      = useReduxDispatch();
  const { clientId }  = useClientRoute();

  return (
    <div
      className={styles['chat-panel']}
      data-collapsed={collapsed || undefined}
      data-panel-side={side}
    >
      {collapsed ? (
        <div className={styles['collapsed-icon']} onClick={() => dispatch(expandSide(side))}>
          {/* AIDEV-NOTE: Icon-only view when collapsed to 40px width */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </div>
      ) : (
        <div className={styles['placeholder']}>Chat Panel (client {clientId.slice(0, 8)}…)</div>
      )}
    </div>
  );
}


export default ChatPanel;
