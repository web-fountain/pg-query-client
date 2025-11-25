'use client';

import type { ReactNode }             from 'react';
import type { ReduxStore, RootState } from '@Redux/store';

import { useEffect, useRef }          from 'react';
import { Provider }                   from 'react-redux';

import { makeStore }                  from '@Redux/store';
import { setQueryTree }               from '@Redux/records/queryTree';


function StoreProvider({ children, preloadedState }:{ children: ReactNode, preloadedState?: Partial<RootState> }) {
  const storeRef = useRef<ReduxStore | null>(null);

  console.log('[StoreProvider] preloadedState', preloadedState);

  if (!storeRef.current) {
    // Create the store instance the first time this renders
    storeRef.current = makeStore(preloadedState);
  }

  // AIDEV-NOTE: Rehydrate queryTree when SSR preloadedState changes across navigations.
  useEffect(() => {
    const store = storeRef.current;
    const tree  = (preloadedState as any)?.queryTree;
    if (store && tree) {
      try { store.dispatch(setQueryTree(tree)); } catch {}
    }
  }, [preloadedState?.queryTree]);

  return <Provider store={storeRef.current}>{children}</Provider>;
}


export default StoreProvider;
