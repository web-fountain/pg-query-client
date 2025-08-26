import type { PayloadAction }   from '@reduxjs/toolkit';
import type { RootState }       from '@Redux/store';
import type { RouteRecord }     from '../types';
import type {
  ResponseHeader,
  Response,
}                               from '@Types/Route';
import type {
  CreateResponseHeader,
  UpdateResponseHeaderName,
  UpdateResponseHeaderDataType,
  UpdateResponseHeaderDataFormat,
  UpdateResponseHeaderIsRequired,
  UpdateResponseHeaderDescription,
  DeleteResponseHeader
}                               from './types';

import {
  createAction, createReducer,
  createSelector, isAnyOf
}                               from '@reduxjs/toolkit';
import { responseHeaderDiff }   from '@Utilities/diffToSave';


// Action Creators
export const createResponseHeader             = createAction<CreateResponseHeader>            ('routeRecord/createResponseHeader');
export const updateResponseHeaderName         = createAction<UpdateResponseHeaderName>        ('routeRecord/updateResponseHeaderName');
export const updateResponseHeaderDataType     = createAction<UpdateResponseHeaderDataType>    ('routeRecord/updateResponseHeaderDataType');
export const updateResponseHeaderDataFormat   = createAction<UpdateResponseHeaderDataFormat>  ('routeRecord/updateResponseHeaderDataFormat');
export const updateResponseHeaderIsRequired   = createAction<UpdateResponseHeaderIsRequired>  ('routeRecord/updateResponseHeaderIsRequired');
export const updateResponseHeaderDescription  = createAction<UpdateResponseHeaderDescription> ('routeRecord/updateResponseHeaderDescription');
export const deleteResponseHeader             = createAction<DeleteResponseHeader>            ('routeRecord/deleteResponseHeader');

// Selectors
export const selectResponseHeaders = createSelector.withTypes<RootState>()(
  [
    (state: RootState)                  => state.routeRecords,
    (state: RootState, routeId: string) => routeId,
    (state: RootState, routeId: string, responseId: string) => responseId
  ],
  (routeRecords, routeId, responseId) => {
    if (!routeRecords?.[routeId]?.current?.responses) return [];
    const response = routeRecords[routeId].current.responses.find(response => response.responseId === responseId);
    return response?.headers || [];
  }
);



// Reducer
const initialState: RouteRecord = {};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(createResponseHeader,
      function(state: RouteRecord, action: PayloadAction<CreateResponseHeader>) {
        const { routeId, responseId, newResponseHeader } = action.payload;
        const route = state[routeId];

        if (route) {
          const response = route.current.responses.find(response => response.responseId === responseId)!;

          if (!response.headers) {
            response.headers = [newResponseHeader];
          } else {
            response.headers.push(newResponseHeader);
          }
        }
      }
    )
    .addCase(updateResponseHeaderName,
      function(state: RouteRecord, action: PayloadAction<UpdateResponseHeaderName>) {
        const { routeId, responseId, responseHeaderId, name } = action.payload;
        const route = state[routeId];

        if (route) {
          const response = route.current.responses.find(r => r.responseId === responseId);

          if (response?.headers) {
            response.headers = response.headers.map(header =>
              header.responseHeaderId === responseHeaderId ? { ...header, name } : header
            );
          }
        }
      }
    )
    .addCase(updateResponseHeaderDataType,
      function(state: RouteRecord, action: PayloadAction<UpdateResponseHeaderDataType>) {
        const { routeId, responseId, responseHeaderId, dataType } = action.payload;
        const route = state[routeId];

        if (route) {
          const response = route.current.responses.find(r => r.responseId === responseId);

          if (response?.headers) {
            response.headers = response.headers.map(header =>
              header.responseHeaderId === responseHeaderId ? { ...header, dataType } : header
            );
          }
        }
      }
    )
    .addCase(updateResponseHeaderDataFormat,
      function(state: RouteRecord, action: PayloadAction<UpdateResponseHeaderDataFormat>) {
        const { routeId, responseId, responseHeaderId, dataFormat } = action.payload;
        const route = state[routeId];

        if (route) {
          const response = route.current.responses.find(r => r.responseId === responseId);

          if (response?.headers) {
            response.headers = response.headers.map(header =>
              header.responseHeaderId === responseHeaderId ? { ...header, dataFormat } : header
            );
          }
        }
      }
    )
    .addCase(updateResponseHeaderDescription,
      function(state: RouteRecord, action: PayloadAction<UpdateResponseHeaderDescription>) {
        const { routeId, responseId, responseHeaderId, description } = action.payload;
        const route = state[routeId];

        if (route) {
          const response = route.current.responses.find(response => response.responseId === responseId);

          if (response?.headers) {
            response.headers = response.headers.map(header => {
              if (header.responseHeaderId === responseHeaderId) {
                if (description === undefined || description === '') {
                  const { description, ...rest } = header;
                  return rest;
                } else {
                  return { ...header, description };
                }
              } else {
                return header;
              }
            });
          }
        }
      }
    )
    .addCase(updateResponseHeaderIsRequired,
      function(state: RouteRecord, action: PayloadAction<UpdateResponseHeaderIsRequired>) {
        const { routeId, responseId, responseHeaderId, isRequired } = action.payload;
        const route = state[routeId];

        if (route) {
          const response = route.current.responses.find(r => r.responseId === responseId);

          if (response?.headers) {
            response.headers = response.headers.map(header =>
              header.responseHeaderId === responseHeaderId ? { ...header, isRequired } : header
            );
          }
        }
      }
    )
    .addCase(deleteResponseHeader,
      function(state: RouteRecord, action: PayloadAction<DeleteResponseHeader>) {
        const { routeId, responseId, responseHeaderId } = action.payload;
        const route = state[routeId];

        if (route) {
          const response = route.current.responses.find(response => response.responseId === responseId);

          if (response?.headers) {
            response.headers = response.headers.filter(header => header.responseHeaderId !== responseHeaderId);
          }

          if (response?.headers?.length === 0) {
            delete response.headers;
          }
        }
      }
    )
    .addMatcher(
      isAnyOf(
        createResponseHeader,
        updateResponseHeaderName,
        updateResponseHeaderDataType,
        updateResponseHeaderDataFormat,
        updateResponseHeaderDescription,
        updateResponseHeaderIsRequired,
        deleteResponseHeader
      ),
      function(state: RouteRecord, action: PayloadAction<any>) {
        const { routeId, responseId } = action.payload;
        const route = state[routeId];

        if (!route) return;

        const { current, persisted, unsaved, isUnsaved } = route;

        const currentResponse   = current.responses.find(r => r.responseId === responseId);
        const persistedResponse = persisted.responses.find(r => r.responseId === responseId);

        if (!currentResponse || !persistedResponse) return;

        const diff = responseHeaderDiff(persistedResponse.headers || [], currentResponse.headers || []);

        if (diff) {
          unsaved.responseHeader = diff;
          if (!isUnsaved) route.isUnsaved = true;
        } else {
          delete unsaved.responseHeader;

          const unsavedKeys = Object.keys(unsaved);
          if (unsavedKeys.length === 0 && isUnsaved) route.isUnsaved = false;
        }
      }
    );
});
