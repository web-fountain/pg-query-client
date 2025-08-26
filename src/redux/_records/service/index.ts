import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@Redux/store';
import type { Service, ServiceRecord }    from './types';

import {
  createAction, createReducer,
  createSelector
} from '@reduxjs/toolkit';


// Action Creators
export const setServiceRecord = createAction<Service>('serviceRecord/setServiceRecord');

// Selectors
export const selectServiceId = createSelector.withTypes<RootState>()(
  [
    (state: RootState) => state.serviceRecords,
  ],
  (serviceRecords) => serviceRecords.serviceId,
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
);

// Reducer
const initialState: ServiceRecord = {};

export default createReducer(initialState, (builder) => {
  builder.addCase(setServiceRecord,
    function(state: ServiceRecord, action: PayloadAction<Service>) {
      const service = action.payload;
      state[service.serviceId] = service;
    }
  );
});
