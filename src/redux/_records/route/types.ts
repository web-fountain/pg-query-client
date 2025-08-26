import type { UpdateResponseBody } from './responseBody/types';
import type {
  HTTPMethod,
  Operation,
  QueryParameter,
  RequestHeader,
  RequestBody,
  Response,
  ResponseHeader,
  ResponseBody,
  ResponseMode,
  Route
}                                   from '@Types/Route';
import type { CreateDataQuery, DataQuery }           from '../dataQuery/type';

type SaveRoute = {
  operationSpaceId  : string;
  environmentId     : string;
  serviceId         : string;
  routeId           : string;
  httpMethod?       : {
    create?: HTTPMethod,
    update?: { httpMethod: HTTPMethod },
    delete?: string[]
  },
  operation?        : {
    create?: Operation,
    update?: Operation,
    delete?: string[]
  },
  queryParameter?   : {
    create?: QueryParameter[],
    update?: QueryParameter[],
    delete?: string[]
  },
  requestHeader?    : {
    create?: RequestHeader[],
    update?: RequestHeader[],
    delete?: string[]
  },
  requestBody?      : {
    create?: RequestBody[],
    update?: RequestBody[],
    delete?: string[]
  },
  responses?         : {
    create?: Response[],
    update?: Response[],
    delete?: string[]
  },
  responseHeader?   : {
    create?: ResponseHeader[],
    update?: ResponseHeader[],
    delete?: string[]
  },
  responseBody?     : {
    create?: ResponseBody[],
    update?: Omit<UpdateResponseBody, 'routeId'>[],
    delete?: string[]
  },
  responseMode?     : {
    create?: ResponseMode,
    update?: ResponseMode,
    delete?: string[]
  },
  dataQuery?        : {
    create?: DataQuery
  }
};

type RouteRecord = {
  [routeId: string]: {
    current       : Route;
    persisted     : Route;
    unsaved       : Partial<SaveRoute>;
    isUnsaved     : boolean;
    isInvalid     : boolean;
    lastSaveTimestamp: number | null;
  }
};


export type {
  SaveRoute,
  RouteRecord
};
