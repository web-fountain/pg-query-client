import type { HTTPMethod } from '@Types/Route';


type UpdateHTTPMethod = {
  routeId    : string;
  urlPathId  : string;
  newHTTPMethod  : HTTPMethod;
  prevHTTPMethod : HTTPMethod;
};


export type {
  UpdateHTTPMethod
};
