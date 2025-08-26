import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState }     from '@Redux/store';
import type { RouteRecord }   from '../types';
import type {
  CreateRequestHeader,
  UpdateRequestHeaderName,
  UpdateRequestHeaderValue,
  UpdateRequestHeaderDataType,
  UpdateRequestHeaderDataFormat,
  UpdateRequestHeaderIsRequired,
  UpdateRequestHeaderDescription,
  DeleteRequestHeader
}                             from './types';

import {
  createAction, createReducer,
  createSelector, isAnyOf
}                             from '@reduxjs/toolkit';
import { requestHeaderDiff }  from '@Utilities/diffToSave';


// Action Creators
export const createRequestHeader            = createAction<CreateRequestHeader>            ('routeRecord/createRequestHeader');
export const updateRequestHeaderName        = createAction<UpdateRequestHeaderName>        ('routeRecord/updateRequestHeaderName');
export const updateRequestHeaderValue       = createAction<UpdateRequestHeaderValue>       ('routeRecord/updateRequestHeaderValue');
export const updateRequestHeaderDataType    = createAction<UpdateRequestHeaderDataType>    ('routeRecord/updateRequestHeaderDataType');
export const updateRequestHeaderDataFormat  = createAction<UpdateRequestHeaderDataFormat>  ('routeRecord/updateRequestHeaderDataFormat');
export const updateRequestHeaderIsRequired  = createAction<UpdateRequestHeaderIsRequired>  ('routeRecord/updateRequestHeaderIsRequired');
export const updateRequestHeaderDescription = createAction<UpdateRequestHeaderDescription> ('routeRecord/updateRequestHeaderDescription');
export const deleteRequestHeader            = createAction<DeleteRequestHeader>            ('routeRecord/deleteRequestHeader');

// Selectors
export const selectRequestHeaders = createSelector.withTypes<RootState>()(
  [
    (state: RootState)                  => state.routeRecords,
    (state: RootState, routeId: string) => routeId
  ],
  (routeRecords, routeId) => {
    const route = routeRecords[routeId];
    return route?.current?.requestHeaders ?? [];
  }
);

// Reducer
const initialState: RouteRecord = {};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(createRequestHeader,
      function(state: RouteRecord, action: PayloadAction<CreateRequestHeader>) {
        const { routeId, newRequestHeader } = action.payload;
        const route = state[routeId];

        if (route) {
          if (!route.current.requestHeaders) {
            route.current.requestHeaders = [newRequestHeader];
          } else {
            route.current.requestHeaders.push(newRequestHeader);
          }
        }
      }
    )
    .addCase(updateRequestHeaderName,
      function(state: RouteRecord, action: PayloadAction<UpdateRequestHeaderName>) {
        const { routeId, requestHeaderId, name } = action.payload;
        const route = state[routeId];

        if (route) {
          route.current.requestHeaders = route.current.requestHeaders?.map(header =>
            header.requestHeaderId === requestHeaderId ? { ...header, name } : header
          );
        }
      }
    )
    .addCase(updateRequestHeaderValue,
      function(state: RouteRecord, action: PayloadAction<UpdateRequestHeaderValue>) {
        const { routeId, requestHeaderId, value } = action.payload;
        const route = state[routeId];

        if (route) {
          route.current.requestHeaders = route.current.requestHeaders?.map(header => {
            if (header.requestHeaderId === requestHeaderId) {
              if (value === undefined || value === '') {
                const { value, ...rest } = header;
                return rest;
              } else {
                return { ...header, value };
              }
            }

            return header;
          });
        }
      }
    )
    .addCase(updateRequestHeaderDataType,
      function(state: RouteRecord, action: PayloadAction<UpdateRequestHeaderDataType>) {
        const { routeId, requestHeaderId, dataType } = action.payload;
        const route = state[routeId];

        if (route) {
          route.current.requestHeaders = route.current.requestHeaders?.map(header =>
            header.requestHeaderId === requestHeaderId ? { ...header, dataType } : header
          );
        }
      }
    )
    .addCase(updateRequestHeaderDataFormat,
      function(state: RouteRecord, action: PayloadAction<UpdateRequestHeaderDataFormat>) {
        const { routeId, requestHeaderId, dataFormat } = action.payload;
        const route = state[routeId];

        if (route) {
          route.current.requestHeaders = route.current.requestHeaders?.map(header => {
            if (header.requestHeaderId === requestHeaderId) {
              if (dataFormat === '--') {
                const { dataFormat: _, ...headerWithoutDataFormat } = header;
                return headerWithoutDataFormat;
              } else {
                return { ...header, dataFormat };
              }
            }

            return header;
          });
        }
      }
    )
    .addCase(updateRequestHeaderDescription,
      function(state: RouteRecord, action: PayloadAction<UpdateRequestHeaderDescription>) {
        const { routeId, requestHeaderId, description } = action.payload;
        const route = state[routeId];

        if (route) {
          route.current.requestHeaders = route.current.requestHeaders?.map(header => {
            if (header.requestHeaderId === requestHeaderId) {
              if (description === undefined || description === '') {
                const { description, ...rest } = header;
                return rest;
              } else {
                return { ...header, description };
              }
            }

            return header;
          });
        }
      }
    )
    .addCase(updateRequestHeaderIsRequired,
      function(state: RouteRecord, action: PayloadAction<UpdateRequestHeaderIsRequired>) {
        const { routeId, requestHeaderId, isRequired } = action.payload;
        const route = state[routeId];

        if (route) {
          route.current.requestHeaders = route.current.requestHeaders?.map(header =>
            header.requestHeaderId === requestHeaderId ? { ...header, isRequired } : header
          );
        }
      }
    )
    .addCase(deleteRequestHeader,
      function(state: RouteRecord, action: PayloadAction<DeleteRequestHeader>) {
        const { routeId, requestHeaderId } = action.payload;
        const route = state[routeId];

        if (route) {
          route.current.requestHeaders = route.current.requestHeaders?.filter(
            header => header.requestHeaderId !== requestHeaderId
          );

          if (route.current.requestHeaders?.length === 0) {
            delete route.current.requestHeaders;
          }
        }
      }
    )
    .addMatcher(
      isAnyOf(
        createRequestHeader,
        updateRequestHeaderName,
        updateRequestHeaderValue,
        updateRequestHeaderDataType,
        updateRequestHeaderDataFormat,
        updateRequestHeaderIsRequired,
        updateRequestHeaderDescription,
        deleteRequestHeader
      ),
      function(state: RouteRecord, action: PayloadAction<{ routeId: string }>) {
        const { routeId } = action.payload;
        const route = state[routeId];

        if (!route) return;

        const { current, persisted, unsaved, isUnsaved } = route;

        // Filter out the openapiSpec key from the requestHeaders before diffing
        const _persistedRequestHeaders = persisted.requestHeaders?.map(({ openapiSpec, ...rest }) => rest);
        const _currentRequestHeaders   = current.requestHeaders?.map(({ openapiSpec, ...rest }) => rest);

        const diff = requestHeaderDiff(
          _persistedRequestHeaders ?? [],
          _currentRequestHeaders ?? []
        );

        if (diff) {
          unsaved.requestHeader = diff;
          if (!isUnsaved) route.isUnsaved = true;
        } else {
          delete unsaved.requestHeader;

          const unsavedKeys = Object.keys(unsaved);
          if (unsavedKeys.length === 0 && isUnsaved) route.isUnsaved = false;
        }
      }
    );
});
