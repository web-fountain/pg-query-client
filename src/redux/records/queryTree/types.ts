import type { UUIDv7 }  from '@Types/primitives';
import type {
  QueryTree,
  TreeNode
}                       from '@Types/queryTree';


type QueryTreeRecord = QueryTree;

type NodePlacement = {
  root      : string;
  groupdId  : number;
  tabId     : UUIDv7;
  sortKey   : string;
  position  : number;
}


export type {
  NodePlacement,
  QueryTreeRecord,
  TreeNode
};
