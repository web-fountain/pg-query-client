import type { PayloadAction }   from '@reduxjs/toolkit';
import type { RootState }       from '@Redux/store';
import type { UUIDv7 }          from '@Types/primitives';
import type {
  DataQueryExecutionRecord,
  DataQueryExecution
}                               from './types';

import {
  createAction, createReducer,
  createSelector
}                               from '@reduxjs/toolkit';


// Action Creators
export const setDataQueryExecutionRecord      = createAction<DataQueryExecutionRecord> ('queryExecution/setDataQueryExecutionRecord');
export const upsertDataQueryExecution         = createAction<DataQueryExecution>       ('queryExecution/upsertDataQueryExecution');
export const clearDataQueryExecutionsForQuery = createAction<{ dataQueryId: UUIDv7 }>('queryExecution/clearDataQueryExecutionsForQuery');


// Selectors
const EMPTY_EXECUTIONS: DataQueryExecution[] = [];

export const selectDataQueryExecutionsForQuery = createSelector.withTypes<RootState>()(
  [
    (state: RootState) => state.dataQueryExecutionRecords,
    (_state: RootState, dataQueryId: UUIDv7 | null) => dataQueryId
  ],
  (dataQueryExecutionRecords, dataQueryId) => {
    if (!dataQueryId) return EMPTY_EXECUTIONS;
    return dataQueryExecutionRecords[dataQueryId] ?? EMPTY_EXECUTIONS;
  },
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

export const selectLatestDataQueryExecution = createSelector.withTypes<RootState>()(
  [selectDataQueryExecutionsForQuery],
  (executions) => {
    const len = executions.length;
    return len > 0 ? executions[len - 1] : null;
  },
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

export const selectIsDataQueryExecutionRunning = createSelector.withTypes<RootState>()(
  [selectLatestDataQueryExecution],
  (execution) => execution?.status === 'running',
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

// Reducer
const initialState: DataQueryExecutionRecord = {};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(setDataQueryExecutionRecord,
      function(_state: DataQueryExecutionRecord, action: PayloadAction<DataQueryExecutionRecord>) {
        return action.payload;
      }
    )
    .addCase(clearDataQueryExecutionsForQuery,
      function(state: DataQueryExecutionRecord, action: PayloadAction<{ dataQueryId: UUIDv7 }>) {
        const dataQueryId = action.payload.dataQueryId;
        if (state[dataQueryId]) {
          delete state[dataQueryId];
        }
      }
    )
    .addCase(upsertDataQueryExecution,
      function(state: DataQueryExecutionRecord, action: PayloadAction<DataQueryExecution>) {
        const execution = action.payload;
        const dataQueryId = execution.dataQueryId;

        if (!state[dataQueryId]) {
          state[dataQueryId] = [];
        }

        const list = state[dataQueryId];
        const executionId = execution.dataQueryExecutionId;

        for (let executionIndex = list.length - 1; executionIndex >= 0; executionIndex--) {
          if (list[executionIndex]?.dataQueryExecutionId === executionId) {
            list[executionIndex] = execution;
            return;
          }
        }

        list.push(execution);
      }
    )
});
