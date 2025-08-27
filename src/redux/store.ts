import { configureStore, combineReducers } from '@reduxjs/toolkit';

import routeReducer       from './records/route';
import tabsReducer        from './records/tabs';


// AIDEV-NOTE: Combine reducers to guide TS inference and avoid object-vs-function reducer confusion
const rootReducer = combineReducers({
  route: routeReducer,
  tabs: tabsReducer
});


const makeStore = (preloadedState?: RootState) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState
  });
};

// Infer the type of makeStore and infer the `RootState` and `ReduxDispatch` types from the store itself
type ReduxStore     = ReturnType<typeof makeStore>;
type RootState      = ReturnType<typeof rootReducer>;
type ReduxDispatch  = ReduxStore['dispatch'];


export { makeStore };
export type { ReduxStore, RootState, ReduxDispatch};
