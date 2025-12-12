import type { DataQuery }             from '@Types/dataQuery';
import type { Extension, UUIDv7 }     from '@Types/primitives';
import type { UnsavedQueryTreeNode }  from '@Types/unsavedQueryTree';


// AIDEV-NOTE: Backend API response shapes for query server actions.
export type CreateNewUnsavedDataQueryPayload = {
  dataQueryId: UUIDv7;
  name?: string;
};

export type UpdateDataQueryPayload = {
  dataQueryId: UUIDv7;
  name?: string;
  queryText?: string;
};

export type ListDataQueriesApiResponse =
  | { ok: false }
  | { ok: true; data: DataQuery[] };

export type CreateUnsavedDataQueryResult = {
  dataQueryId: UUIDv7;
  name: string;
  ext: Extension;
  tab: {
    groupId: number;
    tabId: UUIDv7;
    mountId: UUIDv7;
    position: number;
  };
  tree: UnsavedQueryTreeNode;
};

export type CreateUnsavedDataQueryApiResponse =
  | { ok: false }
  | { ok: true; data: CreateUnsavedDataQueryResult };

export type UpdateDataQueryResult = {
  dataQueryId: UUIDv7;
  nodeId?: UUIDv7;
};

export type UpdateDataQueryApiResponse =
  | { ok: false }
  | { ok: true; data: UpdateDataQueryResult };
