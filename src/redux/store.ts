import { configureStore, combineReducers }  from '@reduxjs/toolkit';

import routeErrorsMiddleware   from './middleware/routeErrorsMiddleware';
import dataSourceReducer       from './records/dataSource';
import dataQueryReducer        from './records/dataQuery';
import errorsReducer           from './records/errors';
import queryFolderReducer      from './records/queryFolder';
import queryTreeReducer        from './records/queryTree';
import tabbarReducer           from './records/tabbar';
import unsavedQueryTreeReducer from './records/unsavedQueryTree';
import uiFocusReducer          from './records/uiFocus';


// AIDEV-NOTE: Combine reducers to guide TS inference and avoid object-vs-function reducer confusion
const rootReducer = combineReducers({
  dataSourceRecords   : dataSourceReducer,
  dataQueryRecords    : dataQueryReducer,
  errors              : errorsReducer,
  queryFolderRecords  : queryFolderReducer,
  queryTree           : queryTreeReducer,
  tabs                : tabbarReducer,
  unsavedQueryTree    : unsavedQueryTreeReducer,
  uiFocus             : uiFocusReducer
});

const makeStore = (preloadedState?: Partial<RootState>) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(routeErrorsMiddleware)
  });
};

// Infer the type of makeStore and infer the `RootState` and `ReduxDispatch` types from the store itself
type ReduxStore     = ReturnType<typeof makeStore>;
type RootState      = ReturnType<typeof rootReducer>;
type ReduxDispatch  = ReduxStore['dispatch'];


export { makeStore };
export type { ReduxStore, RootState, ReduxDispatch};
