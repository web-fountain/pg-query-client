export type DataQuery = {
  dataQueryId   : string;
  name?         : string;
  queryText?    : string;
  parameters?   : Record<string, any>;
  outputType?   : string;
  outputSchema? : Record<string, any>;
  isAttached?   : boolean;
};

export type UnsavedDataQuery = DataQuery & { routeId: string, queryText?: string | null };

export type SaveDataQuery = {
  create? : {
    dataQueryId   : string;
    name?         : string;
    queryText?    : string;
    outputType?   : string;
    outputSchema? : Record<string, any>;
    isAttached?   : boolean;
  },
  update? : {
    dataQueryId   : string;
    name?         : string;
    queryText?    : string;
    outputType?   : string;
    outputSchema? : Record<string, any>;
    isAttached?   : boolean;
  },
  delete?         : string[];
};

export type DataQueryRecord = {
  [dataQueryId: string]: {
    current   : DataQuery;
    persisted : DataQuery;
    unsaved   : Partial<SaveDataQuery>;
    isUnsaved : boolean;
    isInvalid : boolean;
  };
};

export type CreateDataQuery = {
  routeId     : string;
  dataQueryId : string;
  outputType? : string;
  isAttached? : boolean;
} & (
  | { name: string; queryText?: string }
  | { name?: string; queryText: string }
);

export type UpdateDataQuery = {
  dataQueryId   : string;
  name?         : string;
  queryText?    : string;
  parameters?   : Record<string, any>;
  outputType?   : string;
  outputSchema? : Record<string, any>;
};

export type UpdateDataQueryName = {
  dataQueryId : string;
  name        : string;
};

export type UpdateDataQueryText = {
  dataQueryId : string;
  queryText   : string;
};

export type UpdateDataQueryOutputSchema = {
  dataQueryId : string;
  outputSchema: Record<string, any>;
};
