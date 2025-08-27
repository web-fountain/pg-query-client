import { configureStore } from '@reduxjs/toolkit';

import routeReducer       from './records/route';
import tabsReducer        from './records/tabs';


const makeStore = (preloadedState?: Partial<{ route: any; tabs: any; layout: any }>) => {
  return configureStore({
    reducer: {
      route   : routeReducer,
      tabs    : tabsReducer
    },
    preloadedState
  });
};

// Infer the type of makeStore and infer the `RootState` and `ReduxDispatch` types from the store itself
type ReduxStore     = ReturnType<typeof makeStore>
type RootState      = ReturnType<ReduxStore['getState']>
type ReduxDispatch  = ReduxStore['dispatch']


export { makeStore };
export type { ReduxStore, RootState, ReduxDispatch};
