import type { UUIDv7 } from '@Types/primitives';


export type DataSourceKind =
  | 'pglite'
  | 'postgres';

export type DbSslMode =
  | 'disable'
  | 'prefer'
  | 'require'
  | 'verify-ca'
  | 'verify-full';

export type PostgresDataSourceTestPayload = {
  kind      : 'postgres';
  name      : string;
  sslMode   : DbSslMode;
  host      : string;
  port      : number;
  username  : string;
  password  : string;
  database  : string;
};

export type PostgresDataSourceCreatePayload = {
  kind          : 'postgres';
  dataSourceId  : UUIDv7;
  name          : string;
  description?  : string;
  targetLabel?  : string; // look-alike URI (for display purposes)

  sslMode       : DbSslMode;
  persistSecret : boolean;

  host          : string;
  port          : number;
  username      : string;
  password      : string;
  database      : string;
};

export type PgliteDataSourceCreatePayload = {
  kind          : 'pglite';
  dataSourceId  : UUIDv7;
  name          : string;
  description?  : string;
  targetLabel?  : string;

  location      : string;
  database      : string;
  username      : string;
};

export type ReconnectDataSourceCredentialPayload = {
  dataSourceCredentialId  : UUIDv7;
  password                : string;
  persistSecret?          : boolean;
};

// AIDEV-NOTE: Canonical union payload shape for POST /data-sources (create).
export type DataSource =
  | PostgresDataSourceCreatePayload
  | PgliteDataSourceCreatePayload;
