import type { QueryParameter, Route } from '@Types/Route';


type CreateQueryParameter = {
  routeId           : Route['routeId'];
  newQueryParameter : QueryParameter;
};

type UpdateQueryParameterName = {
  routeId           : Route['routeId'];
  queryParameterId  : QueryParameter['queryParameterId'];
  name              : QueryParameter['name'];
};

type UpdateQueryParameterValue = {
  routeId           : Route['routeId'];
  queryParameterId  : QueryParameter['queryParameterId'];
  value             : QueryParameter['value'];
};

type UpdateQueryParameterDataType = {
  routeId           : Route['routeId'];
  queryParameterId  : QueryParameter['queryParameterId'];
  dataType          : QueryParameter['dataType'];
};

type UpdateQueryParameterDataFormat = {
  routeId           : Route['routeId'];
  queryParameterId  : QueryParameter['queryParameterId'];
  dataFormat        : QueryParameter['dataFormat'];
};

type UpdateQueryParameterIsRequired = {
  routeId           : Route['routeId'];
  queryParameterId  : QueryParameter['queryParameterId'];
  isRequired        : QueryParameter['isRequired'];
};

type UpdateQueryParameterDescription = {
  routeId           : Route['routeId'];
  queryParameterId  : QueryParameter['queryParameterId'];
  description       : QueryParameter['description'];
};

type DeleteQueryParameter = {
  routeId           : Route['routeId'];
  queryParameterId  : QueryParameter['queryParameterId'];
};


export type {
  CreateQueryParameter,
  UpdateQueryParameterName,
  UpdateQueryParameterValue,
  UpdateQueryParameterDataType,
  UpdateQueryParameterDataFormat,
  UpdateQueryParameterDescription,
  UpdateQueryParameterIsRequired,
  DeleteQueryParameter
};
