import type { RequestHeader, Route } from '@Types/Route';


type CreateRequestHeader = {
  routeId           : Route['routeId'];
  newRequestHeader  : RequestHeader;
};

type UpdateRequestHeaderName = {
  routeId         : Route['routeId'];
  requestHeaderId : RequestHeader['requestHeaderId'];
  name            : RequestHeader['name'];
};

type UpdateRequestHeaderValue = {
  routeId         : Route['routeId'];
  requestHeaderId : RequestHeader['requestHeaderId'];
  value           : RequestHeader['value'];
};

type UpdateRequestHeaderDataType = {
  routeId         : Route['routeId'];
  requestHeaderId : RequestHeader['requestHeaderId'];
  dataType        : RequestHeader['dataType'];
};

type UpdateRequestHeaderDataFormat = {
  routeId         : Route['routeId'];
  requestHeaderId : RequestHeader['requestHeaderId'];
  dataFormat      : RequestHeader['dataFormat'];
};

type UpdateRequestHeaderIsRequired = {
  routeId         : Route['routeId'];
  requestHeaderId : RequestHeader['requestHeaderId'];
  isRequired      : RequestHeader['isRequired'];
};

type UpdateRequestHeaderDescription = {
  routeId         : Route['routeId'];
  requestHeaderId : RequestHeader['requestHeaderId'];
  description     : RequestHeader['description'];
};

type DeleteRequestHeader = {
  routeId         : Route['routeId'];
  requestHeaderId : RequestHeader['requestHeaderId'];
};


export type {
  CreateRequestHeader,
  UpdateRequestHeaderName,
  UpdateRequestHeaderValue,
  UpdateRequestHeaderDataType,
  UpdateRequestHeaderDataFormat,
  UpdateRequestHeaderIsRequired,
  UpdateRequestHeaderDescription,
  DeleteRequestHeader
};
