import type { UUIDv7 }                    from '@Types/primitives';
import type {
  DataSourceKind,
  DbSslMode
}                                         from '@Types/dataSource';


export type DataSourceMeta = {
  dataSourceId            : UUIDv7;
  dataSourceCredentialId  : UUIDv7;
  name                    : string;
  kind                    : DataSourceKind;
  label                   : string | null;
  persistSecret           : boolean;
};

export type DataSourceRecord = {
  dataSourceIds   : UUIDv7[];
  byId            : Record<string, DataSourceMeta>;
  byCredentialId  : Record<string, DataSourceMeta>;
};

// AIDEV-NOTE: Draft/form shape used while the user is typing. Connection fields are
// optional here, but validators must return a fully-typed payload before sending.
// This draft may include secrets (password). Never persist it in Redux or storage.
export type PostgresDataSourceDraft = {
  kind          : 'postgres';
  dataSourceId  : UUIDv7;
  name          : string;
  description?  : string;
  targetLabel?  : string;

  sslMode       : DbSslMode;
  persistSecret : boolean;

  host?         : string;
  port?         : number;
  username?     : string;
  password?     : string;
  database?     : string;
};

export type PgliteDataSourceDraft = {
  kind          : 'pglite';
  dataSourceId  : UUIDv7;
  name          : string;
  description?  : string;
  targetLabel?  : string;

  location?     : string;
  database?     : string;
  username?     : string;
};

export type DataSourceDraft =
  | PostgresDataSourceDraft
  | PgliteDataSourceDraft;
