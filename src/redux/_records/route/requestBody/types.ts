import type { RequestBody } from '@Types/Route';


type UpdateRequestBody = {
  routeId     : string;
  contentType : RequestBody['contentType'];
  schema      : RequestBody['schema'];
};


export type {
  UpdateRequestBody
};
