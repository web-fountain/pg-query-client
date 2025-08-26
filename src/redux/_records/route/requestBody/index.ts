import type { PayloadAction }           from '@reduxjs/toolkit';
import type { RootState }               from '@Redux/store';
import type { RequestBody }             from '@Types/Route';
import type { RouteRecord }             from '../types';
import type { UpdateRequestBody }      from './types';

import {
  createAction, createReducer,
  createSelector, isAnyOf
}                                       from '@reduxjs/toolkit';


// Action Creators
export const updateRequestBody  = createAction<UpdateRequestBody> ('routeRecord/updateRequestBody');

// Selectors
export const selectRequestBody = createSelector.withTypes<RootState>()(
  [
    (state: RootState)                   => state.routeRecords,
    (state: RootState, routeId: string)  => routeId
  ],
  (routeRecords, routeId): RequestBody[] => {
    const route = routeRecords[routeId];
    return route?.current?.requestBody ?? [];
  }
);

// Reducer
const initialState: RouteRecord = {};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(updateRequestBody,
      function(state: RouteRecord, action: PayloadAction<UpdateRequestBody>) {
        const { routeId, contentType, schema } = action.payload;
        const route = state[routeId];

        if (route) {
          route.current.requestBody = route.current.requestBody?.map(body =>
            body.contentType === contentType ? { ...body, schema } : body
          );
        }
      }
    )
    .addMatcher(
      isAnyOf(
        updateRequestBody
      ),
      function(state: RouteRecord, action: PayloadAction<UpdateRequestBody>) {
        const { routeId, contentType, schema } = action.payload;
        const route = state[routeId];
        if (!route?.current) return;
        if (!route.current.requestBody) route.current.requestBody = [];

        const { current, unsaved, isUnsaved } = route;
        const foundBody = (current.requestBody as RequestBody[]).find(body => body.contentType === contentType);
        unsaved.requestBody = {
          update: [{
            contentType,
            schema: foundBody?.schema || {}
          }]
        };

        if (!isUnsaved) route.isUnsaved = true;
      }
    );
});
