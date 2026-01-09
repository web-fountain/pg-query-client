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
}>('dataSourceRecords/setDataSourcesFromBootstrap');

export const upsertDataSourceFromFetch = createAction<{ dataSource: DataSourceMeta }>(
  'dataSourceRecords/upsertDataSourceFromFetch'
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

export const selectDataSourceByCredentialId = createSelector.withTypes<RootState>()(
  [
    (state) => state.dataSourceRecords.byCredentialId,
    (_state: RootState, credentialId: UUIDv7 | null) => credentialId
  ],
  (byCredentialId, credentialId): DataSourceMeta | null => {
    if (!credentialId) return null;
    return byCredentialId[credentialId] ?? null;
  },
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

// O(1)
export const selectActiveTabDataSourceCredentialId = createSelector.withTypes<RootState>()(
  [
    (state) => state.tabs.activeTabId,
    (state) => state.tabs.entities
  ],
  (activeTabId, entities): UUIDv7 | null => {
    if (!activeTabId) return null;
    return entities[activeTabId]?.dataSourceCredentialId ?? null;
  },
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

// O(n), but only when dataSourceRecords changes; no array allocations
export const selectPgliteDataSourceCredentialId = createSelector.withTypes<RootState>()(
  [
    (state) => state.dataSourceRecords.dataSourceIds,
    (state) => state.dataSourceRecords.byId
  ],
  (ids, byId): UUIDv7 | null => {
    for (let i = 0; i < ids.length; i++) {
      const ds = byId[ids[i]];
      if (ds && ds.kind === 'pglite') return ds.dataSourceCredentialId;
    }
    return null;
  },
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

// O(1)
export const selectLastSelectedDataSourceCredentialId = createSelector.withTypes<RootState>()(
  [
    selectActiveTabDataSourceCredentialId,
    selectPgliteDataSourceCredentialId
  ],
  (fromTab, fromPglite): UUIDv7 | null => fromTab ?? fromPglite,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);


// Reducer
const initialState: DataSourceRecord = {
  dataSourceIds   : [],
  byId            : {},
  byCredentialId  : {}
};

export default createReducer(initialState, (builder) => {
  builder
    .addCase(setDataSourcesFromBootstrap,
      function(state: DataSourceRecord, action: PayloadAction<{ dataSources: DataSourceMeta[] }>) {
        const { dataSources } = action.payload;

        state.dataSourceIds  = [];
        state.byId           = {};
        state.byCredentialId = {};

        for (const ds of (dataSources || [])) {
          if (!ds?.dataSourceId) continue;
          state.dataSourceIds.push(ds.dataSourceId);
          state.byId[ds.dataSourceId] = ds;
          state.byCredentialId[ds.dataSourceCredentialId] = ds;
        }
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
        state.byCredentialId[ds.dataSourceCredentialId] = ds;
      }
    )
});
