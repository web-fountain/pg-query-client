import type { UUIDv7 } from '@Types/primitives';

export type DbSslMode =
  | 'disable'
  | 'prefer'
  | 'require'
  | 'verify-ca'
  | 'verify-full';

export type DataSourceKind =
  | 'postgres';

// AIDEV-NOTE: Safe, non-secret connection metadata suitable for client storage and display.
// Do not include passwords, full URIs with embedded creds, or TLS private keys here.
export type DataSourceMeta = {
  kind            : DataSourceKind;
  dataSourceId    : UUIDv7;
  serverGroupName : string;
  host            : string;
  port            : number;
  username        : string;
  database        : string;
  sslMode         : DbSslMode;
  createdAt?      : string;
};

export type DataSourceRecord = {
  dataSourceIds       : UUIDv7[];
  byId                : Record<string, DataSourceMeta>;
  activeDataSourceId  : UUIDv7 | null;
};

// AIDEV-NOTE: Draft payload used for "test" / "create" flows. This may include secrets
// (password, URI with embedded creds). Never persist this object in Redux or browser storage.
export type DataSourceDraft = {
  kind            : DataSourceKind;
  serverGroupName : string;
  sslMode         : DbSslMode;
  // AIDEV-NOTE: If true, the backend may persist the secret material (password/URI)
  // encrypted at rest. If false, secrets should be treated as ephemeral.
  // This flag must never be used to persist secrets client-side.
  persistSecret?  : boolean;
  // URI mode (may include creds; treat as secret)
  dataSourceUri?  : string;
  // Params mode
  host?           : string;
  port?           : number;
  username?       : string;
  password?       : string;
  database?       : string;
};
