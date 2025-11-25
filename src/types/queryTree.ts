import type { UUIDv7 } from '@Types/primitives';


type TreeNode = {
  nodeId        : UUIDv7;
  parentNodeId  : UUIDv7 | null;  // null for root
  kind          : 'folder' | 'file';
  label         : string;
  sortKey       : string;
  mountId       : string;
  level?        : number;
};

type Nodes = {
  [nodeId: UUIDv7]: TreeNode;
};

type ChildrenByParentId = {
  [parentNodeId: UUIDv7]: UUIDv7[];
};

type NodeIdsByFolderId = {
  [folderId: UUIDv7]: UUIDv7[];
};

type NodeIdsByDataQueryId = {
  [dataQueryId: UUIDv7]: UUIDv7[];
};

type QueryTree = {
  nodes                 : Nodes;
  childrenByParentId    : ChildrenByParentId;
  nodeIdsByFolderId     : NodeIdsByFolderId;
  nodeIdsByDataQueryId  : NodeIdsByDataQueryId;
};


export type {
  ChildrenByParentId,
  Nodes,
  NodeIdsByFolderId,
  NodeIdsByDataQueryId,
  QueryTree,
  TreeNode
};
