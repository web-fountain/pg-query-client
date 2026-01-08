import type { UUIDv7 } from '@Types/primitives';

export type DbSslMode =
  | 'disable'
  | 'prefer'
  | 'require'
  | 'verify-ca'
  | 'verify-full';

export type DataSourceKind =
  | 'pglite'
  | 'postgres';

export type DataSourceStatus =
  | 'active'
  | 'disabled';

export type DataSourceMeta = {
  dataSourceId            : UUIDv7;
  dataSourceCredentialId  : UUIDv7;
  name                    : string;
  kind                    : DataSourceKind;
  status                  : DataSourceStatus;
  label                   : string | null;
};

export type DataSourceRecord = {
  dataSourceIds   : UUIDv7[];
  byId            : Record<string, DataSourceMeta>;
  byCredentialId  : Record<string, DataSourceMeta>;
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
