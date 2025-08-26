import type { RootState } from '@Redux/store';
import type { Route, URLPath }     from '@Types/Route';
import type { HTTPMethod, Parameter } from '../../apimeq/types/httpParts';

import { createSelector } from '@reduxjs/toolkit';


interface AssembledAPIRequest {
  path: string;
  httpMethod: HTTPMethod;
  parameters: Parameter[];
}

const selectAssembleAPIRequest = createSelector.withTypes<RootState>()(
  [
    (state: RootState) => state.routeRecords,
    (state: RootState) => state.urlPathRecords,
    (state: RootState, routeId: Route['routeId']) => routeId
  ],
  (routeRecords, urlPathRecords, routeId): AssembledAPIRequest | null => {
    const routeRecord   = routeRecords[routeId];
    if (!routeRecord) return null;

    const urlPathId     = routeRecord.current.urlPathId;
    const urlPathRecord = urlPathRecords[urlPathId];
    if (!urlPathRecord) return null;

    const path        = urlPathRecord.current.name;
    const httpMethod  = routeRecord.current.httpMethod;

    let parameters: Parameter[] = [];

    // Helper function to safely add parameters from a source array using openapiSpec
    const addParametersFromSource = (sourceArray: any[] | undefined) => {
      if (Array.isArray(sourceArray)) {
        const extractedParams = sourceArray
          // Extract the 'openapiSpec' field which should conform to the 'Parameter' type.
          .map((p: any) => p?.openapiSpec as Parameter)
          // Filter out any potentially null/undefined results or items without openapiSpec
          .filter((p): p is Parameter => p !== null && p !== undefined);
        parameters = parameters.concat(extractedParams);
      }
    };

    // Add parameters from various sources
    addParametersFromSource(routeRecord.current.queryParameters);   // From route record
    addParametersFromSource(urlPathRecord.current.pathParameters);  // From URL path record
    addParametersFromSource(routeRecord.current.requestHeaders);    // From route record

    return {
      path,
      httpMethod,
      parameters,
    };
  }
);


export default selectAssembleAPIRequest;
