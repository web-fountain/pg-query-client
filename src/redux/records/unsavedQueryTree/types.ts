import type { UUIDv7 }  from '@Types/primitives';
import type {
  UnsavedQueryTree,
  UnsavedQueryTreeNode,
  UnsavedTreeNode
}                       from '@Types/unsavedQueryTree';


type UnsavedQueryTreeRecord = UnsavedQueryTree;

type NodePlacement = {
  groupId   : number;
  tabId     : UUIDv7;
  position  : number;
  sortKey   : string;
}


export type {
  NodePlacement,
  UnsavedQueryTreeRecord,
  UnsavedQueryTreeNode,
  UnsavedTreeNode
};
