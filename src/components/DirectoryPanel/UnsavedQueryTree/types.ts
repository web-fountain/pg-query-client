// AIDEV-NOTE: Centralized types for SectionTree. Encodes item payloads, tree item API shape,
// and handler signatures to remove `any` usage across modules.

export type NodePayload = {
  id: string;
  kind: 'folder' | 'query';
  name: string;
  tags?: string[];
  level?: number;
};

export type TreeItemMeta = {
  level?: number;
};

export type TreeItemDomProps = Record<string, any>;

// AIDEV-NOTE: Subset of Headless Tree item API that SectionTree uses. Keeps view components type-safe
// without importing the library's internal types here.
export interface TreeItemApi<TData> {
  getId()       : string;
  getItemMeta() : TreeItemMeta;
  getItemData() : TData | undefined;
  getItemName() : string;
  isFolder()    : boolean;
  isExpanded()  : boolean;
  expand()      : void;
  collapse()    : void;
  getProps()    : TreeItemDomProps;
}

// AIDEV-NOTE: UI action handler types, separated for reusability across Toolbar/Row and hooks.
export type OnRename        = (id: string) => void | Promise<void>;
export type OnDropMove      = (dragId: string, dropTargetId: string, isTargetFolder: boolean) => void | Promise<void>;
export type OnCreateFolder  = () => void | Promise<void>;
export type OnCreateFile    = () => void | Promise<void>;
export type OnCloseAll      = () => void | Promise<void>;

export type DragPayload = string;

export type TreeConfig = {
  containerLabel: string;
  maxDepth: number;
};
