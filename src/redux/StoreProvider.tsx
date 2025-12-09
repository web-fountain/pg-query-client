'use client';

import type { ReactNode }             from 'react';
import type { ReduxStore, RootState } from '@Redux/store';

import { useRef }                     from 'react';
import { Provider }                   from 'react-redux';

import { makeStore }                  from '@Redux/store';


function StoreProvider({ children, preloadedState }:{ children: ReactNode, preloadedState?: Partial<RootState> }) {
  const storeRef = useRef<ReduxStore | null>(null);

  if (!storeRef.current) {
    // Create the store instance the first time this renders
    storeRef.current = makeStore(preloadedState);
  }

  return <Provider store={storeRef.current}>{children}</Provider>;
}


export default StoreProvider;
