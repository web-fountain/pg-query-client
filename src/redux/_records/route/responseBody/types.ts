import type { Response, ResponseBody, Route } from '@Types/Route';


type UpdateResponseBody = {
  routeId: Route['routeId'];
} & Pick<Response, 'responseId'> & ResponseBody;

type UpdateResponseBodySchema = {
  routeId: Route['routeId'];
} & Pick<Response, 'responseId'> & { contentType: string, schema: string };


export type {
  UpdateResponseBody,
  UpdateResponseBodySchema
};
