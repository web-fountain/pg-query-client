import type { HTTPMethod, URLPath, PathParameter } from '@Types/Route';


type URLPathHTTPMethod = URLPath & {
  httpMethods       : HTTPMethod[];
};

type ResetPathParameters = {
  urlPathId         : URLPath['urlPathId'];
};

type UpdateURLPathName = {
  urlPathId         : URLPath['urlPathId']
  name              : URLPath['name']
};

type CreatePathParameter = {
  urlPathId         : URLPath['urlPathId']
  newPathParameters : PathParameter[];
};

type UpdatePathParameterName = {
  urlPathId         : URLPath['urlPathId'];
  pathParameters    : PathParameter[];
};

type UpdatePathParameterValue = {
  urlPathId         : URLPath['urlPathId'];
  pathParameterId   : PathParameter['pathParameterId'];
  value             : PathParameter['value'];
};

type UpdatePathParameterDataType = {
  urlPathId         : URLPath['urlPathId'];
  pathParameterId   : PathParameter['pathParameterId'];
  dataType          : PathParameter['dataType'];
};

type UpdatePathParameterDataFormat = {
  urlPathId         : URLPath['urlPathId'];
  pathParameterId   : PathParameter['pathParameterId'];
  dataFormat        : PathParameter['dataFormat'];
};

type UpdatePathParameterDescription = {
  urlPathId         : URLPath['urlPathId'];
  pathParameterId   : PathParameter['pathParameterId'];
  description       : PathParameter['description'];
};

type DeletePathParameter = {
  urlPathId         : URLPath['urlPathId'];
  pathParameterIds  : PathParameter['pathParameterId'][];
};

type SavePath = {
  urlPathId       : string;
  name            : string;
  pathParameters? : {
    create?: PathParameter[],
    update?: PathParameter[];
    delete?: PathParameter['pathParameterId'][];
  }
};

type URLPathRecord = {
  [key: string]: {
    current   : URLPathHTTPMethod;
    persisted : URLPathHTTPMethod;
    unsaved   : Partial<SavePath>;
    isUnsaved : boolean;
  }
};


export type {
  URLPathHTTPMethod,
  UpdateURLPathName,
  ResetPathParameters,
  CreatePathParameter,
  UpdatePathParameterName,
  UpdatePathParameterValue,
  UpdatePathParameterDataType,
  UpdatePathParameterDataFormat,
  UpdatePathParameterDescription,
  DeletePathParameter,
  URLPathRecord,
  SavePath
};
