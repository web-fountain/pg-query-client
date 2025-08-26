'use client';

import type { ReactNode }     from 'react';
import type { ReduxStore }    from '@Redux/store';

import { useEffect, useRef }  from 'react';
import { Provider }           from 'react-redux';
import { makeStore }          from '@Redux/store';
import { rehydrateLayout }    from '@Redux/records/layout';


function StoreProvider({ children }:{ children: ReactNode }) {
  const storeRef = useRef<ReduxStore | null>(null);

  if (!storeRef.current) {
    // Create the store instance the first time this renders
    storeRef.current = makeStore();
  }

  // AIDEV-NOTE: Client-only debounced persistence of tabs + mirror CSS vars for layout panels
  useEffect(() => {
    const store = storeRef.current;
    if (!store) return;

    let timer: number | null = null;
    // On first mount, hydrate layout from localStorage (collapsed and widths)
    try {
      const raw = window.localStorage.getItem('pg-query-client/layout');
      if (raw) {
        const parsed = JSON.parse(raw);
        store.dispatch(rehydrateLayout(parsed));
      }
    } catch {}

    const unsubscribe = store.subscribe(() => {
      const state = store.getState();
      const clientId = state.route.clientId as string | null;
      // Persist tabs scoped by clientId; layout persists globally

      // Persist only tabs and activeTabId
      if (clientId) {
        const payload = {
          tabs: state.tabs.tabs,
          activeTabId: state.tabs.activeTabId
        };

        if (timer !== null) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          try {
            window.localStorage.setItem('pg-query-client/query-workspace/tabs' + `/${clientId}` , JSON.stringify(payload));
          } catch {}
        }, 250);
      }

      // Mirror layout widths + collapsed state to CSS variables/attributes and broadcast event
      try {
        const leftW  = state.layout.left.width;
        const rightW = state.layout.right.width;
        document.documentElement.style.setProperty('--op-space-layout-left-panel-width',  `${leftW}px`);
        document.documentElement.style.setProperty('--op-space-layout-right-panel-width', `${rightW}px`);
        if (state.layout.left.collapsed) {
          document.documentElement.setAttribute('data-op-space-left-collapsed', '');
        } else {
          document.documentElement.removeAttribute('data-op-space-left-collapsed');
        }
        if (state.layout.right.collapsed) {
          document.documentElement.setAttribute('data-op-space-right-collapsed', '');
        } else {
          document.documentElement.removeAttribute('data-op-space-right-collapsed');
        }
        window.dispatchEvent(new CustomEvent('op-space-layout-widths', { detail: { lw: leftW, rw: rightW } }));
      } catch {}
      // Persist layout collapsed/widths globally (not per client)
      try {
        const layoutPayload = {
          left:  { width: state.layout.left.width,  collapsed: state.layout.left.collapsed },
          right: { width: state.layout.right.width, collapsed: state.layout.right.collapsed },
          contentSwapped: state.layout.contentSwapped
        };
        window.localStorage.setItem('pg-query-client/layout', JSON.stringify(layoutPayload));
      } catch {}
    });

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return <Provider store={storeRef.current}>{children}</Provider>;
}


export default StoreProvider;
