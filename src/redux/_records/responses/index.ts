import type { PayloadAction }           from '@reduxjs/toolkit';
import type { RootState }               from '@Redux/store';
import type {
  ResponseRecord,
  SetResponseRecord
}                                       from './types';

import {
  createAction, createReducer,
  createSelector
}                                       from '@reduxjs/toolkit';


// Action Creators
export const setResponseRecord = createAction<SetResponseRecord>('responses/setResponseRecord');

// Selectors
export const selectResponseRecord = createSelector.withTypes<RootState>()(
  [
    (state: RootState) => state.responseRecords,
    (state: RootState, routeId: string) => routeId
  ],
  (responseRecords, routeId) => responseRecords[routeId] ?? [],
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
);


// Reducer
const initialState: ResponseRecord = {};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(setResponseRecord,
      function(state: ResponseRecord, action: PayloadAction<SetResponseRecord>) {
        const { routeId, response } = action.payload;

        if (!state[routeId]) {
          state[routeId] = [];
        }

        state[routeId].push(response);
      }
    );
});
