import type { Service } from '@Types/Service';


type Environment = {
  environmentId : string;
  name          : string;
  baseURL       : string;
};

type DataSourcePostgres = {
  host     : string;
  port     : number;
  dbName   : string;
  userName : string;
  sslMode  : string;
};

type DataSource = {
  dataSourceId    : string;
  displayName     : string;
  type            : string;
  postgresConfig? : DataSourcePostgres;
};

type OperationSpaceRecord = {
  operationSpaceId    : string;
  selectedEnvironment : Environment;
  environments        : Environment[];
  services            : Service[];
  dataSources         : DataSource[];
};


export type {
  OperationSpaceRecord,
  Environment,
  DataSource,
  DataSourcePostgres
};
