import type { PayloadAction }   from '@reduxjs/toolkit';
import type { RootState }       from '@Redux/store';
import type {
  OperationSpaceRecord,
  Environment,
  DataSource
}                               from './types';

import {
  createAction, createReducer,
  createSelector
}                               from '@reduxjs/toolkit';


// Action Creators
export const setOperationSpaceRecord  = createAction<OperationSpaceRecord>  ('operationSpace/setOperationSpaceRecord');
export const setSelectedEnvironment   = createAction<Environment>           ('operationSpace/setSelectedEnvironment');

// Selectors
export const selectOperationSpace = createSelector.withTypes<RootState>()(
  [
    (state: RootState) => state.operationSpace
  ],
  (operationSpace) => operationSpace as OperationSpaceRecord,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

export const selectCurrentEnvironment = createSelector.withTypes<RootState>()(
  [
    (state: RootState) => state.operationSpace
  ],
  (operationSpace) => operationSpace.selectedEnvironment as Environment,
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
);

export const selectEnvironments = createSelector.withTypes<RootState>()(
  [
    (state: RootState) => state.operationSpace
  ],
  (operationSpace) => operationSpace.environments as Environment[],
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
);

export const selectDataSources = createSelector.withTypes<RootState>()(
  [
    (state: RootState) => state.operationSpace
  ],
  (operationSpace) => operationSpace.dataSources as DataSource[],
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
);

// Reducer
const initialState: OperationSpaceRecord = {
  operationSpaceId: '',
  selectedEnvironment: {
    environmentId : '00000000-0000-7000-0000-000000000000',
    name          : 'Local Env',
    baseURL       : 'http://localhost:3000'
  },
  environments: [],
  services: [],
  dataSources: []
};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(setOperationSpaceRecord,
      function(state: OperationSpaceRecord, action: PayloadAction<OperationSpaceRecord>) {
        return { ...state, ...action.payload };
      }
    )
    .addCase(setSelectedEnvironment, (state: OperationSpaceRecord, action: PayloadAction<Environment>) => {
      state.selectedEnvironment = action.payload;
    });
});
