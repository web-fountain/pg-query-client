import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState }     from '@Redux/store';
import type { RouteRecord }   from '../types';
import type { Route }         from '@Types/Route';
import type {
  UpdateResponseBody,
  UpdateResponseBodySchema
}                             from './types';

import {
  createAction, createReducer,
  createSelector, isAnyOf
}                             from '@reduxjs/toolkit';


// Action Creators
export const updateResponseBody       = createAction<UpdateResponseBody>        ('routeRecord/updateResponseBody');
export const updateResponseBodySchema = createAction<UpdateResponseBodySchema>  ('routeRecord/updateResponseBodySchema');

// Selectors
export const select200Response = createSelector.withTypes<RootState>()(
  [
    (state: RootState) => state.routeRecords,
    (state: RootState, routeId: Route['routeId']) => routeId
  ],
  (routeRecords, routeId) => routeRecords[routeId]?.current.responses.filter(response => response.statusCode === 200)
);

// Reducer
const initialState: RouteRecord = {};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(updateResponseBody,
      function(state: RouteRecord, action: PayloadAction<UpdateResponseBody>) {
        const { routeId, responseId, contentType, schema } = action.payload;
        const route = state[routeId];

      if (route) {
        const response = route.current.responses.find(response => response.responseId === responseId)!;
        response.body = response.body?.map(body =>
          body?.contentType === contentType ? { ...body, schema } : body
        );
      }
    })
    .addCase(updateResponseBodySchema,
      function(state: RouteRecord, action: PayloadAction<UpdateResponseBodySchema>) {
        const { routeId, responseId, contentType, schema } = action.payload;
        const route = state[routeId];

        if (route) {
          const response = route.current.responses.find(response => response.responseId === responseId)!;
          response.body = response.body?.map(body =>
            body?.contentType === contentType ? { ...body, schema } : body
          );
        }
      }
    )
    .addMatcher(
      isAnyOf(
        updateResponseBody,
        updateResponseBodySchema
      ),
      function(state: RouteRecord, action: PayloadAction<UpdateResponseBody>) {
        const { routeId, responseId, contentType, schema } = action.payload;
        const route = state[routeId];

        if (!route) return;

        const { current, unsaved, isUnsaved } = route;

        try {
          const parsedSchema = typeof schema === 'string' ? JSON.parse(schema) : schema;
          route.isInvalid = false;
          unsaved.responseBody = {
            update: [{
              responseId,
              contentType,
              schema: parsedSchema
            }]
          };

          if (!isUnsaved) route.isUnsaved = true;
        } catch (error) {
          console.warn('not valid json:', error);
          route.isInvalid = true;
        }
      }
    );
});
