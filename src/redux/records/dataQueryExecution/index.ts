import type { PayloadAction }   from '@reduxjs/toolkit';
import type { RootState }       from '@Redux/store';
import type {
  DataQueryExecutionRecord,
  DataQueryExecution
}                               from './types';

import {
  createAction, createReducer,
  createSelector
}                               from '@reduxjs/toolkit';


// Action Creators
export const setDataQueryExecutionRecord     = createAction<DataQueryExecutionRecord> ('queryExecution/setDataQueryExecutionRecord');
export const createDataQueryExecutionRecord  = createAction<DataQueryExecution>       ('queryExecution/createDataQueryExecutionRecord');

// Selectors
export const selectLatestDataQueryExecution = createSelector.withTypes<RootState>()(
  [
    (state: RootState) => state.dataQueryRecords,
    (state: RootState, dataQueryId: string) => dataQueryId,
    (state: RootState) => state.dataQueryExecutionRecords
  ],
  (dataQueryRecords, dataQueryId, dataQueryExecutionRecords) => {
    const dataQueryId = dataQueryRecords[dataQueryId]?.current?.dataQueryId;
    if (!dataQueryId) return [];

    if (dataQueryExecutionRecords && dataQueryExecutionRecords[dataQueryId]) {
      const executions = dataQueryExecutionRecords[dataQueryId];
      return executions.length > 0 ? executions[executions.length - 1] : undefined;
    }
  }
);

// Reducer
const initialState: DataQueryExecutionRecord = {};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(setDataQueryExecutionRecord,
      function(state: DataQueryExecutionRecord, action: PayloadAction<unknown>) {
        // need to update this section when populated from database
        //@ts-ignore
        const { dataQueryId, ...rest } = action.payload;
        state[dataQueryId] = rest;
      }
    )
    .addCase(createDataQueryExecutionRecord,
      function(state: DataQueryExecutionRecord, action: PayloadAction<DataQueryExecution>) {
        const { dataQueryId } = action.payload;

        if (!state[dataQueryId]) {
          state[dataQueryId] = [];
        }

        state[dataQueryId].push(action.payload);
      }
    )
});
