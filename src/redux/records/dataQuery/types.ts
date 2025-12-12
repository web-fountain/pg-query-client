import type { UUIDv7 }                        from '@Types/primitives';
import type { DataQuery, DataQueryEditField } from '@Types/dataQuery';


type FieldInvalid = {
  field       : DataQueryEditField;
  actionType  : string;
  message     : string;
  schemaId    : string;
};
export type InvalidMap = Partial<Record<DataQueryEditField, FieldInvalid>>;


export type SaveDataQuery = {
  create? : {
    dataQueryId : UUIDv7;
    name?       : string;
    queryText?  : string;
  },
  update? : {
    dataQueryId : UUIDv7;
    name?       : string;
    queryText?  : string;
  },
  delete?       : UUIDv7[];
};

// Write-time change tracking model (see diffplan.md)
export type DataQueryChanges = {
  [dataQueryId: string]: Partial<{
    name        : string;
    queryText   : string;
    description : string;
    tags        : string[];
    color       : string;
    parameters  : Record<string, any>;
  }>;
};

export type DataQueryRecordItem = {
  current     : DataQuery;
  persisted   : Partial<DataQuery>;
  isUnsaved   : boolean;
  unsaved     : Partial<SaveDataQuery>;
  isInvalid   : boolean;
  invalid     : InvalidMap;
};

export type DataQueryRecord = {
  [dataQueryId: string]: DataQueryRecordItem;
} & {
  // Minimal changes captured at write-time per dataQueryId
  changesById?: DataQueryChanges;
};

export type CreateDataQuery = {
  dataQueryId : UUIDv7;
  name        : string;
};

export type UpdateDataQuery = {
  dataQueryId : UUIDv7;
  name?       : string;
  queryText?  : string;
};

export type UpdateDataQueryName = {
  dataQueryId : UUIDv7;
  name        : string;
};

export type UpdateDataQueryText = {
  dataQueryId : UUIDv7;
  queryText   : string;
};


export type { DataQuery } from '@Types/dataQuery';
