import type { PayloadAction }                           from '@reduxjs/toolkit';
import type { RootState }                               from '@Redux/store';
import type { RouteRecord }                             from '../types';
import type { UpdateHTTPMethod }                        from './types';

import { createAction, createReducer, createSelector }  from '@reduxjs/toolkit';
import { httpMethodDiff }                               from '@Utilities/diffToSave';


// Action Creators
export const updateHTTPMethod = createAction<UpdateHTTPMethod>('routeRecord/updateHTTPMethod');

// Selectors
export const selectHTTPMethod = createSelector.withTypes<RootState>()(
  [
    (state: RootState)                  => state.routeRecords,
    (state: RootState, routeId: string) => routeId
  ],
  (routeRecords, routeId) => {
    if (!routeRecords?.[routeId]?.current?.httpMethod) return null;
    return routeRecords[routeId].current.httpMethod;
  },
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
);

// Reducer
const initialState: RouteRecord = {};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(updateHTTPMethod,
      function(state: RouteRecord, action: PayloadAction<UpdateHTTPMethod>) {
        const { routeId, newHTTPMethod } = action.payload;
        const route = state[routeId];

      if (!route) return;

      const { current, persisted, unsaved, isUnsaved } = route;
      current.httpMethod = newHTTPMethod;

      const diff = httpMethodDiff(persisted.httpMethod, current.httpMethod);

      if (diff) {
        unsaved.httpMethod = diff;
        if (!isUnsaved) route.isUnsaved = true;
      } else {
        delete unsaved.httpMethod;

        const unsavedKeys = Object.keys(unsaved);
        if (unsavedKeys.length === 0 && route.isUnsaved) route.isUnsaved = false;
      }
    });
});
