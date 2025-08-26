import type { PayloadAction }   from '@reduxjs/toolkit';
import type { RootState }       from '@Redux/store';
import type {
  DataQuery,
  DataQueryRecord,
  CreateDataQuery,
  UpdateDataQuery,
  UpdateDataQueryName,
  UpdateDataQueryText,
  UpdateDataQueryOutputSchema
}                               from './type';

import {
  createAction, createReducer, current as __current,
  createSelector, isAnyOf
}                               from '@reduxjs/toolkit';
import { dataQueryDiff }        from '@Utilities/diffToSave';


// Action Creators
export const setDataQueryRecord           = createAction<DataQuery>                   ('query/setDataQueryRecord');
export const createDataQuery              = createAction<CreateDataQuery>             ('query/createDataQuery');
export const updateDataQuery              = createAction<UpdateDataQuery>             ('query/updateDataQuery');
export const updateDataQueryName          = createAction<UpdateDataQueryName>         ('query/updateDataQueryName');
export const updateDataQueryText          = createAction<UpdateDataQueryText>         ('query/updateDataQueryText');
export const updateDataQueryOutputSchema  = createAction<UpdateDataQueryOutputSchema> ('query/updateDataQueryOutputSchema');
export const updateDataQueryIsUnsaved     = createAction<{ dataQueryId: string }>     ('query/updateDataQueryIsUnsaved');

// Selectors
export const selectRouteDataQueryRecord = createSelector.withTypes<RootState>()(
  [
    (state: RootState) => state.routeRecords,
    (state: RootState) => state.dataQueryRecords,
    (state: RootState, routeId: string) => routeId
  ],
  (routeRecords, dataQueryRecords, routeId): DataQuery | undefined => {
    const dataQueryId = routeRecords[routeId]?.current?.dataQueryId;
    if (dataQueryId && dataQueryRecords && dataQueryRecords[dataQueryId]) {
      return dataQueryRecords[dataQueryId].current;
    }
    return undefined;
  }
);

export const selectDataQueryIsAttached = createSelector.withTypes<RootState>()(
  [
    (state: RootState) => state.routeRecords,
    (state: RootState, routeId: string) => routeId,
    (state: RootState) => state.dataQueryRecords
  ],
  (routeRecords, routeId, dataQueryRecords) => {
    const dataQueryId = routeRecords[routeId]?.current?.dataQueryId;
    if (dataQueryId && dataQueryRecords && dataQueryRecords[dataQueryId]) {
      return dataQueryRecords[dataQueryId].current.isAttached;
    }
    return false;
  }
);

export const selectDataQueryUnsaved = createSelector.withTypes<RootState>()(
  [
    (state: RootState) => state.dataQueryRecords,
    (state: RootState, dataQueryId: string) => dataQueryId
  ],
  (dataQueryRecords, dataQueryId) => {
    if (dataQueryRecords && dataQueryRecords[dataQueryId]) {
      return {
        isUnsaved: dataQueryRecords[dataQueryId].isUnsaved,
        unsaved: dataQueryRecords[dataQueryId].unsaved
      };
    }

    return {
      isUnsaved: false,
      unsaved: {}
    };
  }
);

// Reducer
const initialState: DataQueryRecord = {};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(setDataQueryRecord,
      function(state: DataQueryRecord, action: PayloadAction<DataQuery>) {
        const { dataQueryId } = action.payload;
        const dataQuery = state[dataQueryId];

        // this action is ONLY called when there is data coming from the database
        // if there is isUnsaved data, we need to update the persisted data
        // and perform a diff to recalculate the unsaved data
        if (dataQuery && dataQuery.isUnsaved) {
          dataQuery.persisted = action.payload;
        } else {
          state[dataQueryId] = {
            current   : action.payload,
            persisted : action.payload,
            unsaved   : {},
            isUnsaved : false,
            isInvalid : false
          };
        }
      }
    )
    .addCase(createDataQuery,
      function(state: DataQueryRecord, action: PayloadAction<CreateDataQuery>) {
        const { routeId, dataQueryId, ...rest } = action.payload;

        state[dataQueryId] = {
          current   : { dataQueryId, ...rest },
          persisted : { dataQueryId, ...rest },
          unsaved   : {},
          isUnsaved : false,
          isInvalid : false
        }
      }
    )
    .addCase(updateDataQuery,
      function(state: DataQueryRecord, action: PayloadAction<UpdateDataQuery>) {
        const { dataQueryId } = action.payload;
        const dataQuery = state[dataQueryId];

        if (dataQuery) {
          dataQuery.current = { ...dataQuery.current, ...action.payload };
        }
      }
    )
    .addCase(updateDataQueryName,
      function(state: DataQueryRecord, action: PayloadAction<UpdateDataQueryName>) {
        const { dataQueryId } = action.payload;
        const dataQuery = state[dataQueryId];

        if (dataQuery) {
          dataQuery.current = { ...dataQuery.current, ...action.payload };
        }
      }
    )
    .addCase(updateDataQueryText,
      function(state: DataQueryRecord, action: PayloadAction<UpdateDataQueryText>) {
        const { dataQueryId } = action.payload;
        const dataQuery = state[dataQueryId];

        if (dataQuery) {
          dataQuery.current = { ...dataQuery.current, ...action.payload };
        }
      }
    )
    .addCase(updateDataQueryOutputSchema,
      function(state: DataQueryRecord, action: PayloadAction<UpdateDataQueryOutputSchema>) {
        const { dataQueryId } = action.payload;
        const dataQuery = state[dataQueryId];

        if (dataQuery) {
          dataQuery.current = { ...dataQuery.current, ...action.payload };
        }
      }
    )
    .addCase(updateDataQueryIsUnsaved,
      function(state: DataQueryRecord, action: PayloadAction<{ dataQueryId: string }>) {
        const { dataQueryId } = action.payload;
        const dataQuery = state[dataQueryId];

        if (dataQuery) {
          dataQuery.isUnsaved = false;
          dataQuery.unsaved = {};
        }
      }
    )
    .addMatcher(
      isAnyOf(
        setDataQueryRecord
      ),
      function(state: DataQueryRecord, action: PayloadAction<DataQuery>) {
        const { dataQueryId } = action.payload;
        const dataQuery = state[dataQueryId];

        if (!dataQuery || !dataQuery.isUnsaved) return;

        let { current, persisted, isUnsaved } = dataQuery;
        const { parameters: _pp, ..._persisted } = persisted;
        const { parameters: _cp, ..._current } = current;

        const diff = dataQueryDiff(
          { ..._persisted, parameters: __current(_pp) },
          { ..._current, parameters: __current(_cp) }
        );
        // console.log('setDataQueryRecord diff', diff);

        if (diff) {
          dataQuery.unsaved = diff;
          if (!isUnsaved) dataQuery.isUnsaved = true;
        } else {
          dataQuery.unsaved = {};
          if (isUnsaved) dataQuery.isUnsaved = false;
        }
      }
    )
    .addMatcher(
      isAnyOf(
        createDataQuery,
        updateDataQuery,
        updateDataQueryName,
        updateDataQueryText,
        updateDataQueryOutputSchema
      ),
      function(state: DataQueryRecord, action: PayloadAction<UpdateDataQuery>) {
        const { dataQueryId } = action.payload;
        const dataQuery = state[dataQueryId];

        if (!dataQuery) return;

        let { current, persisted, isUnsaved } = dataQuery;
        const { parameters: _pp, ..._persisted } = persisted;
        const { parameters: _cp, ..._current } = current;

        // console.log('persisted', __current(_pp));
        // console.log('current', __current(_cp));

        const diff = dataQueryDiff(persisted, current);
        console.log('updateDataQuery diff', diff);

        if (diff) {
          dataQuery.unsaved = diff;
          if (!isUnsaved) dataQuery.isUnsaved = true;
        } else {
          dataQuery.unsaved = {};
          if (isUnsaved) dataQuery.isUnsaved = false;
        }
      }
    )
});
