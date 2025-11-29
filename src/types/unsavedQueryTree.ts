import type { UUIDv7 } from '@Types/primitives';


type UnsavedQueryTreeGroupNode = {
  nodeId        : string;
  parentNodeId  : string | number | null;
  kind          : 'group';
  groupId       : number;
  position      : number;
  name          : string;
};

type UnsavedQueryTreeNode = {
  nodeId        : UUIDv7;
  parentNodeId  : number;
  kind          : 'file';
  groupId       : number;
  position      : number;
  name          : string;
  mountId       : UUIDv7;
};

type UnsavedTreeNode = UnsavedQueryTreeGroupNode | UnsavedQueryTreeNode;

type UnsavedQueryTree = {
  rootId              : 'unsaved-root';
  nodes               : Record<string, UnsavedTreeNode>;
  childrenByParentId  : Record<string, UUIDv7[]>;
};


export type {
  UnsavedQueryTreeGroupNode,
  UnsavedQueryTreeNode,
  UnsavedTreeNode,
  UnsavedQueryTree
};
