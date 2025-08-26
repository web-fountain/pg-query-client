import type { PayloadAction }                           from '@reduxjs/toolkit';
import type { RootState }                               from '@Redux/store';
import type { RouteRecord }                             from '../types';
import type { UpdateResponseMode }                      from './types';

import { createAction, createReducer, createSelector }  from '@reduxjs/toolkit';
import { responseModeDiff }                             from '@Utilities/diffToSave';


// Action Creators
export const updateResponseMode = createAction<UpdateResponseMode>('routeRecord/updateResponseMode');

// Selectors
export const selectResponseMode = createSelector.withTypes<RootState>()(
  [
    (state: RootState)                  => state.routeRecords,
    (state: RootState, routeId: string) => routeId
  ],
  (routeRecords, routeId) => {
    if (!routeRecords?.[routeId]?.current?.responseMode) return null;
    return routeRecords[routeId].current.responseMode;
  },
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
);

// Reducer
const initialState: RouteRecord = {};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(updateResponseMode,
      function(state: RouteRecord, action: PayloadAction<UpdateResponseMode>) {
        const { routeId, newResponseMode } = action.payload;
        const route = state[routeId];

      if (!route) return;

      const { current, persisted, unsaved, isUnsaved } = route;
      current.responseMode = newResponseMode;

      const diff = responseModeDiff(persisted.responseMode, current.responseMode);
      console.log('diff', diff);

      if (diff) {
        unsaved.responseMode = diff;
        if (!isUnsaved) route.isUnsaved = true;
      } else {
        delete unsaved.responseMode;

        const unsavedKeys = Object.keys(unsaved);
        if (unsavedKeys.length === 0 && route.isUnsaved) route.isUnsaved = false;
      }
    });
});
