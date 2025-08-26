import type { PayloadAction }   from '@reduxjs/toolkit';
import type { RootState }       from '@Redux/store';
import type { Route }           from '@Types/Route';
import type { RouteRecord }     from './types';

import {
  createAction, createReducer,
  createSelector, isAnyOf
}                               from '@reduxjs/toolkit';

import methodReducers           from './httpMethod';
import operationReducers        from './operation';
import queryParametersReducer   from './queryParameters';
import requestHeadersReducer    from './requestHeader';
import requestBodyReducer       from './requestBody';
import responseReducer          from './response';
import responseHeadersReducer   from './responseHeader';
import responseBodyReducer      from './responseBody';
import responseModeReducer      from './responseMode';

import type { CreateDataQuery } from '../dataQuery/type';
import { createDataQuery }      from '../dataQuery';


// Action Creators
export const setRouteRecord               = createAction<Route>             ('routeRecord/setRouteRecord');
export const updateRouteLastSaveTimestamp = createAction<{routeId: string}> ('routeRecord/updateRouteLastSaveTimestamp');

// Selectors
export const selectRouteRecord    = createSelector.withTypes<RootState>()(
  [
    (state: RootState)                  => state.routeRecords,
    (state: RootState, routeId: string) => routeId
  ],
  (routeRecords, routeId) => {
    if (!routeRecords?.[routeId]) return null;
    return routeRecords[routeId];
  }
);

export const selectCurrentRoute   = createSelector.withTypes<RootState>()(
  [
    (state: RootState)                  => state.routeRecords,
    (state: RootState, routeId: string) => routeId
  ],
  (routeRecords, routeId) => routeRecords[routeId]?.current
);

export const selectURLPathId      = createSelector.withTypes<RootState>()(
  [
    (state: RootState)                  => state.routeRecords,
    (state: RootState, routeId: string) => routeId
  ],
  (routeRecords, routeId) => {
    return routeRecords[routeId]?.current?.urlPathId;
  }
);

export const selectPathParameters = createSelector.withTypes<RootState>()(
  [
    (state: RootState)                  => state.routeRecords,
    (state: RootState)                  => state.urlPathRecords,
    (state: RootState, routeId: string) => routeId
  ],
  (routeRecords, urlPathRecords, routeId) => {
    const urlPathId = routeRecords[routeId]?.current?.urlPathId;
    return urlPathId ? urlPathRecords[urlPathId]?.current?.pathParameters : [];
  }
);

export const selectLastSaveTimestamp = createSelector.withTypes<RootState>()(
  [
    (state: RootState) => state.routeRecords,
  ],
  (routeRecords) => {
    if (!routeRecords) return null;
    return Object.values(routeRecords).reduce((latest, route) => {
      if (route.lastSaveTimestamp && (latest === null || route.lastSaveTimestamp > latest)) {
        return route.lastSaveTimestamp;
      }
      return latest;
    }, null as number | null);
  }
);

// Reducer
const initialState: RouteRecord = {};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(setRouteRecord,
      function(state: RouteRecord, action: PayloadAction<Route>) {
        const { routeId } = action.payload;
        const route = state[routeId];

        if (route && route.isUnsaved) {
          route.persisted = action.payload;
        } else {
          state[routeId] = {
            current   : action.payload,
            persisted : action.payload,
            unsaved   : {},
            isUnsaved : false,
            isInvalid : false,
            lastSaveTimestamp: null
          };
        }
      }
    )
    .addCase(updateRouteLastSaveTimestamp,
      function(state: RouteRecord, action: PayloadAction<{routeId: string}>) {
        const { routeId } = action.payload;
        const route = state[routeId];

        if (!route) return;
        route.lastSaveTimestamp = Date.now();
        route.isUnsaved = false;
        route.unsaved = {};
        route.isInvalid = false;
      }
    )
    .addMatcher(
      isAnyOf(
        createDataQuery
      ),
      function(state: RouteRecord, action: PayloadAction<CreateDataQuery>) {
        const { dataQueryId, routeId, ...rest } = action.payload;
        const route = state[routeId];
        if (!route) return;
        route.current.dataQueryId = dataQueryId;
      }
    )
    .addDefaultCase((state, action) => {
      methodReducers          (state, action);
      operationReducers       (state, action);
      queryParametersReducer  (state, action);
      requestHeadersReducer   (state, action);
      requestBodyReducer      (state, action);
      responseReducer         (state, action);
      responseHeadersReducer  (state, action);
      responseBodyReducer     (state, action);
      responseModeReducer     (state, action);
    })
});
