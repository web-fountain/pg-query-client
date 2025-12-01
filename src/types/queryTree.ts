import type { UUIDv7 } from '@Types/primitives';


type QueryTreeFolderNode = {
  nodeId        : string | UUIDv7;
  parentNodeId  : string | null;
  kind          : 'folder';
  label         : string;
  sortKey       : string;
  mountId       : string | UUIDv7;
  level         : number;
}

type QueryTreeNode = {
  nodeId        : UUIDv7;
  parentNodeId  : string | UUIDv7;
  kind          : 'file';
  label         : string;
  sortKey       : string;
  mountId       : UUIDv7;
  level         : number;
}

type TreeNode = QueryTreeFolderNode | QueryTreeNode;

// AIDEV-NOTE: Using string index signatures for compatibility with runtime access patterns.
// UUIDv7 is a branded string type, but object keys are always strings at runtime.
type Nodes = {
  [nodeId: string]: TreeNode;
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
  QueryTreeFolderNode,
  QueryTreeNode,
  TreeNode
};
