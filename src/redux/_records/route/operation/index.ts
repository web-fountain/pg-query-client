import type { PayloadAction }                           from '@reduxjs/toolkit';
import type { RootState }                               from '@Redux/store';
import type { RouteRecord }                             from '../types';
import type { UpdateOperationName }                     from './types';

import { createAction, createReducer, createSelector }  from '@reduxjs/toolkit';
import { operationDiff }                                from '@Utilities/diffToSave';


// Action Creators
export const updateOperationName = createAction<UpdateOperationName>('routeRecord/updateOperationName');

// Selectors
export const selectOperationName = createSelector.withTypes<RootState>()(
  [
      (state: RootState)                  => state.routeRecords,
      (state: RootState, routeId: string) => routeId
    ],
    (routeRecords, routeId) => {
      if (!routeRecords?.[routeId]?.current?.operationName) return null;
    return routeRecords[routeId].current.operationName;
  },
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
);

// Reducer
const initialState: RouteRecord = {};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(updateOperationName,
      function(state: RouteRecord, action: PayloadAction<UpdateOperationName>) {
        const { routeId, operationId, operationName } = action.payload;
        const route = state[routeId];

      if (!route) return;

      const { current, persisted, unsaved } = route;
      current.operationName = operationName;

      const diff = operationDiff(operationId, persisted.operationName, current.operationName)

      if (diff) {
        unsaved.operation = diff;
        if (!route.isUnsaved) route.isUnsaved = true;
      } else {
        delete unsaved.operation;

        const unsavedKeys = Object.keys(unsaved);
        if (unsavedKeys.length === 0 && route.isUnsaved) route.isUnsaved = false;
      }
    });
});
