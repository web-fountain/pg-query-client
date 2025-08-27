'use client';

import type { ReactNode }     from 'react';
import type { ReduxStore }    from '@Redux/store';

import { useEffect, useRef }  from 'react';
import { Provider }           from 'react-redux';
import { makeStore }          from '@Redux/store';


function StoreProvider({ children }:{ children: ReactNode }) {
  const storeRef = useRef<ReduxStore | null>(null);

  if (!storeRef.current) {
    // Create the store instance the first time this renders
    storeRef.current = makeStore();
  }

  // AIDEV-NOTE: Client-only debounced persistence of tabs
  useEffect(() => {
    const store = storeRef.current;
    if (!store) return;

    let timer: number | null = null;
    const unsubscribe = store.subscribe(() => {
      const state = store.getState();
      const clientId = state.route.clientId as string | null;
      // Persist tabs scoped by clientId

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

    });

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return <Provider store={storeRef.current}>{children}</Provider>;
}


export default StoreProvider;
