import type { UUIDv7 }          from '@Types/primitives';
import type { DataSourceMeta }  from '@Redux/records/dataSource/types';


export type DataSourceTestResult = {
  latencyMs       : number;
  serverVersion?  : string;
};

export type ListDataSourceApiResponse = {
  ok      : boolean;
  data    : DataSourceMeta[];
  error?  : unknown;
};

export type CreateDataSourceApiResponse = {
  ok      : boolean;
  data    : DataSourceMeta;
  error?  : unknown;
};

export type TestDataSourceApiResponse = {
  ok      : boolean;
  data    : DataSourceTestResult;
  error?  : unknown;
};

export type DeleteDataSourceApiResponse = {
  ok      : boolean;
  data    : Record<string, never>;
  error?  : unknown;
};

export type GetActiveDataSourceApiResponse = {
  ok      : boolean;
  data    : { dataSourceId: UUIDv7 | null };
  error?  : unknown;
};
