export type SetResponseRecord = {
  routeId: string;
  response: ResponseResult;
};


export type ResponseResult = {
  statusCode: number;
  latency   : number;
  size      : number;
  headers   : Record<string, string>;
  body      : any;
};


export type ResponseRecord = {
  [routeId: string]: ResponseResult[];
};
