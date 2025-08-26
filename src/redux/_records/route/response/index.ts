import type { PayloadAction }             from '@reduxjs/toolkit';
import type { RootState }                 from '@Redux/store';
import type { RouteRecord }               from '../types';
import type { UpdateResponseStatusCode }  from './types';

import {
  createAction, createReducer,
  createSelector, isAnyOf
}                                         from '@reduxjs/toolkit';
import { responseDiff }                   from '@Utilities/diffToSave';


// Action Creators
export const updateResponseStatusCode = createAction<UpdateResponseStatusCode> ('routeRecord/updateResponseStatusCode');

// Selectors
export const selectRouteResponses = createSelector.withTypes<RootState>()(
  [
    (state: RootState)                  => state.routeRecords,
    (state: RootState, routeId: string) => routeId
  ],
  (routeRecords, routeId) => {
    if (!routeRecords?.[routeId]?.current?.responses) return [];
    return routeRecords[routeId].current.responses;
  }
);

// Reducer
const initialState: RouteRecord = {};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(updateResponseStatusCode,
      function(state: RouteRecord, action: PayloadAction<UpdateResponseStatusCode>) {
        const { routeId, prevStatusCode, newStatusCode } = action.payload;
        const route = state[routeId];

      if (route) {
        route.current.responses = route.current.responses.map(response =>
          response.statusCode === prevStatusCode ? { ...response, statusCode: newStatusCode } : response
        );
      }
    })
    .addMatcher(
      isAnyOf(
        updateResponseStatusCode,
      ),
      function(state: RouteRecord, action: PayloadAction<{ routeId: string }>) {
        const { routeId } = action.payload;
        const route = state[routeId];

        if (!route) return;

        const { current, persisted, unsaved, isUnsaved } = route;
        const diff = responseDiff(persisted.responses, current.responses);

        if (diff) {
          unsaved.responses = diff;
          if (!isUnsaved) route.isUnsaved = true;
        } else {
          delete unsaved.responses;

          const unsavedKeys = Object.keys(unsaved);
          if (unsavedKeys.length === 0 && isUnsaved) route.isUnsaved = false;
        }
      }
    )
});
