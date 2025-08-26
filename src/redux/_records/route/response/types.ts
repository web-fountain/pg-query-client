import type { Response, Route } from '@Types/Route';


type UpdateResponseStatusCode = {
  routeId         : Route['routeId'];
  prevStatusCode  : Response['statusCode'];
  newStatusCode   : Response['statusCode'];
};


export type {
  UpdateResponseStatusCode
};
