import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState }     from '@Redux/store';
import type { UUIDv7 }        from '@Types/primitives';
import type {
  DataSourceMeta,
  DataSourceRecord
}                             from './types';

import {
  createAction,
  createReducer,
  createSelector
}                             from '@reduxjs/toolkit';


export type { DataSourceMeta, DataSourceRecord } from './types';

// Actions
export const setDataSourcesFromBootstrap = createAction<{
  dataSources        : DataSourceMeta[];
  activeDataSourceId : UUIDv7 | null;
}>('dataSourceRecords/setDataSourcesFromBootstrap');

export const upsertDataSourceFromFetch = createAction<{ dataSource: DataSourceMeta }>(
  'dataSourceRecords/upsertDataSourceFromFetch'
);

export const setActiveDataSourceId = createAction<{ dataSourceId: UUIDv7 | null }>(
  'dataSourceRecords/setActiveDataSourceId'
);

// Selectors
export const selectDataSourceRecords = createSelector.withTypes<RootState>()(
  [(state) => state.dataSourceRecords],
  (dataSourceRecords): DataSourceRecord => dataSourceRecords,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

export const selectDataSourceList = createSelector.withTypes<RootState>()(
  [(state) => state.dataSourceRecords],
  (dataSourceRecords) => dataSourceRecords.dataSourceIds.map((id) => dataSourceRecords.byId[id]).filter(Boolean),
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

export const selectActiveDataSourceId = createSelector.withTypes<RootState>()(
  [(state) => state.dataSourceRecords.activeDataSourceId],
  (activeDataSourceId) => activeDataSourceId,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

export const selectActiveDataSourceMeta = createSelector.withTypes<RootState>()(
  [(state) => state.dataSourceRecords],
  (dataSourceRecords) => {
    const id = dataSourceRecords.activeDataSourceId;
    if (!id) return null;
    return dataSourceRecords.byId[id] || null;
  },
  { devModeChecks: { identityFunctionCheck: 'never' } }
);


// Reducer
const initialState: DataSourceRecord = {
  dataSourceIds       : [],
  byId                : {},
  activeDataSourceId  : null
};

export default createReducer(initialState, (builder) => {
  builder
    .addCase(setDataSourcesFromBootstrap,
      function(state: DataSourceRecord, action: PayloadAction<{ dataSources: DataSourceMeta[]; activeDataSourceId: UUIDv7 | null }>) {
        const { dataSources, activeDataSourceId } = action.payload;
        state.dataSourceIds = [];
        state.byId = {};

        for (const ds of (dataSources || [])) {
          if (!ds?.dataSourceId) continue;
          state.dataSourceIds.push(ds.dataSourceId);
          state.byId[ds.dataSourceId] = ds;
        }

        state.activeDataSourceId = activeDataSourceId;
      }
    )
    .addCase(upsertDataSourceFromFetch,
      function(state: DataSourceRecord, action: PayloadAction<{ dataSource: DataSourceMeta }>) {
        const ds = action.payload.dataSource;
        if (!ds?.dataSourceId) return;

        if (!state.byId[ds.dataSourceId]) {
          state.dataSourceIds.push(ds.dataSourceId);
        }
        state.byId[ds.dataSourceId] = ds;
      }
    )
    .addCase(setActiveDataSourceId,
      function(state: DataSourceRecord, action: PayloadAction<{ dataSourceId: UUIDv7 | null }>) {
        state.activeDataSourceId = action.payload.dataSourceId;
      }
    );
});
