'use client';

import type { PayloadAction }         from '@reduxjs/toolkit';
import type { RootState }             from '@Redux/store';
import type { RouteRecord }           from '../types';
import type {
  CreateQueryParameter,
  UpdateQueryParameterName,
  UpdateQueryParameterValue,
  UpdateQueryParameterDataType,
  UpdateQueryParameterDataFormat,
  UpdateQueryParameterDescription,
  UpdateQueryParameterIsRequired,
  DeleteQueryParameter
}                                     from './types';

import {
  createAction, createReducer,
  createSelector, isAnyOf
}                                     from '@reduxjs/toolkit';
import { queryParameterDiff }         from '@Utilities/diffToSave';


// Action Creators
export const createQueryParameter            = createAction<CreateQueryParameter>             ('routeRecord/createQueryParameter');
export const updateQueryParameterName        = createAction<UpdateQueryParameterName>         ('routeRecord/updateQueryParameterName');
export const updateQueryParameterValue       = createAction<UpdateQueryParameterValue>        ('routeRecord/updateQueryParameterValue');
export const updateQueryParameterDataType    = createAction<UpdateQueryParameterDataType>     ('routeRecord/updateQueryParameterDataType');
export const updateQueryParameterDataFormat  = createAction<UpdateQueryParameterDataFormat>   ('routeRecord/updateQueryParameterDataFormat');
export const updateQueryParameterDescription = createAction<UpdateQueryParameterDescription>  ('routeRecord/updateQueryParameterDescription');
export const updateQueryParameterIsRequired  = createAction<UpdateQueryParameterIsRequired>   ('routeRecord/updateQueryParameterIsRequired');
export const deleteQueryParameter            = createAction<DeleteQueryParameter>             ('routeRecord/deleteQueryParameter');

// Selectors
export const selectQueryParameters = createSelector.withTypes<RootState>()(
  [
    (state: RootState)          => state.routeRecords,
    (state: RootState, routeId) => routeId
  ],
  (routeRecords, routeId) => {
    if (!routeRecords?.[routeId]?.current?.queryParameters) return [];
    return routeRecords[routeId].current.queryParameters;
  }
);

// Reducer
const initialState: RouteRecord = {};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(createQueryParameter,
      function(state: RouteRecord, action: PayloadAction<CreateQueryParameter>) {
        const { routeId, newQueryParameter } = action.payload;
        const route = state[routeId];

        if (route) {
          if (!route.current.queryParameters) {
            route.current.queryParameters = [newQueryParameter];
          } else {
            route.current.queryParameters.push(newQueryParameter);
          }
        }
      }
    )
    .addCase(updateQueryParameterName,
      function(state: RouteRecord, action: PayloadAction<UpdateQueryParameterName>) {
        const { routeId, queryParameterId, name } = action.payload;
        const route = state[routeId];

        if (route) {
          route.current.queryParameters = route.current.queryParameters?.map(param =>
            param.queryParameterId === queryParameterId ? { ...param, name } : param
          );
        }
      }
    )
    .addCase(updateQueryParameterValue,
      function(state: RouteRecord, action: PayloadAction<UpdateQueryParameterValue>) {
        const { routeId, queryParameterId, value } = action.payload;
        const route = state[routeId];

        if (route) {
          route.current.queryParameters = route.current.queryParameters?.map(param => {
            if (param.queryParameterId === queryParameterId) {
              if (value === undefined || value === '') {
                const { value, ...rest } = param;
                return rest;
              } else {
                return { ...param, value };
              }
            }

            return param;
          });
        }
      }
    )
    .addCase(updateQueryParameterDataType,
      function(state: RouteRecord, action: PayloadAction<UpdateQueryParameterDataType>) {
        const { routeId, queryParameterId, dataType } = action.payload;
        const route = state[routeId];

        if (route) {
          route.current.queryParameters = route.current.queryParameters?.map(param =>
            param.queryParameterId === queryParameterId ? { ...param, dataType } : param
          );
        }
      }
    )
    .addCase(updateQueryParameterDataFormat,
      function(state: RouteRecord, action: PayloadAction<UpdateQueryParameterDataFormat>) {
        const { routeId, queryParameterId, dataFormat } = action.payload;
        const route = state[routeId];

        if (route) {
          route.current.queryParameters = route.current.queryParameters?.map(param => {
            if (param.queryParameterId === queryParameterId) {
              if (dataFormat === '--') {
                const { dataFormat: _, ...paramWithoutDataFormat } = param;
                return paramWithoutDataFormat;
              } else {
                return { ...param, dataFormat };
              }
            }

            return param;
          });
        }
      }
    )
    .addCase(updateQueryParameterDescription,
      function(state: RouteRecord, action: PayloadAction<UpdateQueryParameterDescription>) {
        const { routeId, queryParameterId, description } = action.payload;
        const route = state[routeId];

        if (route) {
          route.current.queryParameters = route.current.queryParameters?.map(param => {
            if (param.queryParameterId === queryParameterId) {
              if (description === undefined || description === '') {
                const { description, ...rest } = param;
                return rest;
              } else {
                return { ...param, description };
              }
            }

            return param;
          });
        }
      }
    )
    .addCase(updateQueryParameterIsRequired,
      function(state: RouteRecord, action: PayloadAction<UpdateQueryParameterIsRequired>) {
        const { routeId, queryParameterId, isRequired } = action.payload;
        const route = state[routeId];

        if (route) {
          route.current.queryParameters = route.current.queryParameters?.map(param =>
            param.queryParameterId === queryParameterId ? { ...param, isRequired } : param
          );
        }
      }
    )
    .addCase(deleteQueryParameter,
      function(state: RouteRecord, action: PayloadAction<DeleteQueryParameter>) {
        const { routeId, queryParameterId } = action.payload;
        const route = state[routeId];

        if (route) {
          route.current.queryParameters = route.current.queryParameters?.filter(
            param => param.queryParameterId !== queryParameterId
          );

          if (route.current.queryParameters?.length === 0) {
            delete route.current.queryParameters;
          }
        }
      }
    )
    .addMatcher(
      isAnyOf(
        createQueryParameter,
        updateQueryParameterName,
        updateQueryParameterValue,
        updateQueryParameterDataType,
        updateQueryParameterDataFormat,
        updateQueryParameterDescription,
        updateQueryParameterIsRequired,
        deleteQueryParameter
      ),
      function(state: RouteRecord, action: PayloadAction<{ routeId: string }>) {
        const { routeId } = action.payload;
        const route = state[routeId];

        if (!route) return;

        const { current, persisted, unsaved, isUnsaved } = route;

        // Filter out the openapiSpec key from the queryParameters before diffing
        const _persistedQueryParameters = persisted.queryParameters?.map(({ openapiSpec, ...rest }) => rest);
        const _currentQueryParameters   = current.queryParameters?.map(({ openapiSpec, ...rest }) => rest);

        const diff = queryParameterDiff(
          _persistedQueryParameters ?? [],
          _currentQueryParameters ?? []
        );

        if (diff) {
          unsaved.queryParameter = diff;
          if (!isUnsaved) route.isUnsaved = true;
        } else {
          delete unsaved.queryParameter;

          const unsavedKeys = Object.keys(unsaved);
          if (unsavedKeys.length === 0 && isUnsaved) route.isUnsaved = false;
        }
      }
    )
});
