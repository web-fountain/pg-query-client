import type { ResponseHeader, Route, Response } from '@Types/Route';


type CreateResponseHeader = {
  routeId           : Route['routeId'];
  responseId        : Response['responseId'];
  newResponseHeader : ResponseHeader;
};

type UpdateResponseHeader = {
  routeId           : Route['routeId'];
  responseId        : Response['responseId'];
  responseHeaderId  : ResponseHeader['responseHeaderId'];
};

type UpdateResponseHeaderName = {
  routeId           : Route['routeId'];
  responseId        : Response['responseId'];
  responseHeaderId  : ResponseHeader['responseHeaderId'];
  name              : ResponseHeader['name'];
};

type UpdateResponseHeaderDataType = {
  routeId           : Route['routeId'];
  responseId        : Response['responseId'];
  responseHeaderId  : ResponseHeader['responseHeaderId'];
  dataType          : ResponseHeader['dataType'];
};

type UpdateResponseHeaderDataFormat = {
  routeId           : Route['routeId'];
  responseId        : Response['responseId'];
  responseHeaderId  : ResponseHeader['responseHeaderId'];
  dataFormat        : ResponseHeader['dataFormat'];
};

type UpdateResponseHeaderIsRequired = {
  routeId           : Route['routeId'];
  responseId        : Response['responseId'];
  responseHeaderId  : ResponseHeader['responseHeaderId'];
  isRequired        : ResponseHeader['isRequired'];
};

type UpdateResponseHeaderDescription = {
  routeId           : Route['routeId'];
  responseId        : Response['responseId'];
  responseHeaderId  : ResponseHeader['responseHeaderId'];
  description       : ResponseHeader['description'];
};

type DeleteResponseHeader = UpdateResponseHeader;


export type {
  CreateResponseHeader,
  DeleteResponseHeader,
  ResponseHeader,
  UpdateResponseHeader,
  UpdateResponseHeaderName,
  UpdateResponseHeaderDataType,
  UpdateResponseHeaderDataFormat,
  UpdateResponseHeaderIsRequired,
  UpdateResponseHeaderDescription
};
