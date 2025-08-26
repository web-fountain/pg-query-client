import type { PayloadAction }       from '@reduxjs/toolkit';
import type { RootState }           from '@Redux/store';
import type { HTTPMethod, URLPath } from '@Types/Route';
import type {
  URLPathRecord, URLPathHTTPMethod,
  ResetPathParameters,
  UpdateURLPathName,
  CreatePathParameter,
  UpdatePathParameterName,
  UpdatePathParameterValue,
  UpdatePathParameterDataType,
  UpdatePathParameterDataFormat,
  UpdatePathParameterDescription,
  DeletePathParameter
}                                   from './types';

import {
  createAction, createReducer, current as _current,
  createSelector, isAnyOf
}                                   from '@reduxjs/toolkit';

import { updateHTTPMethod }         from '@Redux/records/route/httpMethod';
import {
  urlPathNameDiff,
  pathParameterDiff
}                                   from '@Utilities/diffToSave';


// NOTE:
// Even though the URLPathRecord tracks the http methods the URLPathRecord is not responsible for updating them.
// The URLPathRecord tracks the http methods to provide a list of methods for the UI to render.


// Action Creators
export const setURLPathRecord               = createAction<URLPathHTTPMethod>               ('pathRecords/setURLPathRecord');
export const resetPathParameters            = createAction<ResetPathParameters>             ('pathRecords/resetPathParameters')
export const updateURLPathName              = createAction<UpdateURLPathName>               ('pathRecords/updateURLPathName');
export const createPathParameter            = createAction<CreatePathParameter>             ('pathRecords/createPathParameter');
export const updatePathParameterName        = createAction<UpdatePathParameterName>         ('pathRecords/updatePathParameterName');
export const updatePathParameterValue       = createAction<UpdatePathParameterValue>        ('pathRecords/updatePathParameterValue');
export const updatePathParameterDataType    = createAction<UpdatePathParameterDataType>     ('pathRecords/updatePathParameterDataType');
export const updatePathParameterDataFormat  = createAction<UpdatePathParameterDataFormat>   ('pathRecords/updatePathParameterDataFormat');
export const updatePathParameterDescription = createAction<UpdatePathParameterDescription>  ('pathRecords/updatePathParameterDescription');
export const deletePathParameter            = createAction<DeletePathParameter>             ('pathRecords/deletePathParameter');

// Selectors
export const selectPathMethods = createSelector.withTypes<RootState>()(
  [
    (state: RootState)                  => state.urlPathRecords,
    (state: RootState, urlPathId: string)  => urlPathId
  ],
  (pathRecords, urlPathId) => {
    if (!pathRecords?.[urlPathId]?.current?.httpMethods) return [];
    return pathRecords[urlPathId].current.httpMethods;
  },
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
);

export const selectPathname = createSelector.withTypes<RootState>()(
  [
    (state: RootState)                  => state.urlPathRecords,
    (state: RootState, urlPathId: string)  => urlPathId
  ],
  (pathRecords, urlPathId) => {
    if (!pathRecords?.[urlPathId]?.current?.name) return null;
    return pathRecords[urlPathId].current.name;
  },
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
);

export const selectPathParameters = createSelector.withTypes<RootState>()(
  [
    (state: RootState)                    => state.urlPathRecords,
    (state: RootState, urlPathId: string) => urlPathId
  ],
  (urlPathRecords, urlPathId) => {
    if (!urlPathRecords?.[urlPathId]?.current?.pathParameters) return [];
    return urlPathRecords[urlPathId].current.pathParameters;
  }
);

// Reducer
const initialState: URLPathRecord = {};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(setURLPathRecord,
      function(state: URLPathRecord, action: PayloadAction<URLPathHTTPMethod>) {
        const path = action.payload;
        state[path.urlPathId] = {
          current: path,
          persisted: path,
          unsaved: {},
          isUnsaved: false
        };
      }
    )
    .addCase(resetPathParameters,
      function(state: URLPathRecord, action: PayloadAction<ResetPathParameters>) {
        const { urlPathId } = action.payload;
        const path = state[urlPathId];

        if (path) {
          path.current.pathParameters = path.persisted.pathParameters;
        }
      }
    )
    .addCase(updateURLPathName,
      function(state: URLPathRecord, action: PayloadAction<UpdateURLPathName>) {
        const { urlPathId, name } = action.payload;
        const urlPath = state[urlPathId];

        if (!urlPath) return;
        const { current, persisted, unsaved, isUnsaved } = urlPath;
        current.name = name;

        const diff = urlPathNameDiff(urlPathId, persisted.name, name);

        if (diff) {
          urlPath.unsaved = { ...unsaved, ...diff };
          if (!isUnsaved) urlPath.isUnsaved = true;
        } else {
          console.log('pathname no diff', unsaved);
          if (!unsaved.pathParameters) {
            urlPath.unsaved = {};
            urlPath.isUnsaved = false;
          }
        }
      }
    )
    .addCase(createPathParameter,
      function(state: URLPathRecord, action: PayloadAction<CreatePathParameter>) {
        const { urlPathId, newPathParameters } = action.payload;
        const path = state[urlPathId];

        if (path) {
          if (!path.current.pathParameters) {
            path.current.pathParameters = [...newPathParameters]
          } else {
            path.current.pathParameters.push(...newPathParameters);
          }
        }
      }
    )
    .addCase(updatePathParameterName,
      function(state: URLPathRecord, action: PayloadAction<UpdatePathParameterName>) {
        const { urlPathId, pathParameters } = action.payload;
        const path = state[urlPathId];

        if (path) {
          path.current.pathParameters = path.current.pathParameters?.map(param => {
            const newParam = pathParameters.find(p => p.pathParameterId === param.pathParameterId);
            return newParam ? { ...param, name: newParam.name } : param;
          });
        }
      }
    )
    .addCase(updatePathParameterValue,
      function(state: URLPathRecord, action: PayloadAction<UpdatePathParameterValue>) {
        const { urlPathId, pathParameterId, value } = action.payload;
        const path = state[urlPathId];

        if (path) {
          path.current.pathParameters = path.current.pathParameters?.map(param =>
            param.pathParameterId === pathParameterId ? { ...param, value } : param
          );
        }
      }
    )
    .addCase(updatePathParameterDataType,
      function(state: URLPathRecord, action: PayloadAction<UpdatePathParameterDataType>) {
        const { urlPathId, pathParameterId, dataType } = action.payload;
        const path = state[urlPathId];

        if (path) {
          path.current.pathParameters = path.current.pathParameters?.map(param =>
            param.pathParameterId === pathParameterId ? { ...param, dataType } : param
          );
        }
      }
    )
    .addCase(updatePathParameterDataFormat,
      function(state: URLPathRecord, action: PayloadAction<UpdatePathParameterDataFormat>) {
        const { urlPathId, pathParameterId, dataFormat } = action.payload;
        const path = state[urlPathId];

        if (path) {
          path.current.pathParameters = path.current.pathParameters?.map(param => {
            if (dataFormat === '--') {
              const { dataFormat: _, ...paramWithoutDataFormat } = param;
              return paramWithoutDataFormat;
            } else {
              return { ...param, dataFormat };
            }
          });
        }
      }
    )
    .addCase(updatePathParameterDescription,
      function(state: URLPathRecord, action: PayloadAction<UpdatePathParameterDescription>) {
        const { urlPathId, pathParameterId, description } = action.payload;
        const path = state[urlPathId];

        if (path) {
          path.current.pathParameters = path.current.pathParameters?.map(param =>
            param.pathParameterId === pathParameterId ? { ...param, description } : param
          );
        }
      }
    )
    .addCase(deletePathParameter,
      function(state: URLPathRecord, action: PayloadAction<DeletePathParameter>) {
        const { urlPathId, pathParameterIds } = action.payload;
        const path = state[urlPathId];

        if (path) {
          path.current.pathParameters = path.current.pathParameters?.filter(param => !pathParameterIds.includes(param.pathParameterId));
        }
      }
    )
    .addMatcher(
      isAnyOf(
        updateHTTPMethod
      ),
      function(state: URLPathRecord, action: PayloadAction<{ urlPathId: URLPath['urlPathId'], newHTTPMethod: HTTPMethod, prevHTTPMethod: HTTPMethod }>) {
        const { urlPathId, newHTTPMethod, prevHTTPMethod } = action.payload;
        const path = state[urlPathId];

        if (!path) return;
        path.current.httpMethods = path.current.httpMethods.map(httpMethod => httpMethod === prevHTTPMethod ? newHTTPMethod : httpMethod);
      }
    )
    .addMatcher(
      isAnyOf(
        createPathParameter,
        updatePathParameterName,
        updatePathParameterValue,
        updatePathParameterDataType,
        updatePathParameterDataFormat,
        updatePathParameterDescription,
        deletePathParameter
      ),
      function(state: URLPathRecord, action: PayloadAction<{ urlPathId: string }>) {
        const { urlPathId } = action.payload;
        const path = state[urlPathId];

        if (!path) return;

        const { current, persisted, unsaved, isUnsaved } = path;

        // Filter out the openapiSpec key from the pathParameters before diffing
        const _persistedPathParameters = persisted.pathParameters?.map(({ openapiSpec, ...rest }) => rest);
        const _currentPathParameters   = current.pathParameters?.map(({ openapiSpec, ...rest }) => rest);

        const diff = pathParameterDiff(
          _persistedPathParameters ?? [],
          _currentPathParameters ?? []
        );

        if (diff) {
          unsaved.pathParameters = diff;
          if (!isUnsaved) path.isUnsaved = true;
        } else {
          delete unsaved.pathParameters;

          const unsavedKeys = Object.keys(unsaved);
          if (unsavedKeys.length === 0 && path.isUnsaved) path.isUnsaved = false;
        }
      }
    );
});
