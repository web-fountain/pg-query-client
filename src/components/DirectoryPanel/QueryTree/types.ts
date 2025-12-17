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

export type TreeItemDomProps = {
  'aria-selected'?: boolean | 'true' | 'false';
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  [key: string]: unknown;
};

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

// AIDEV-NOTE: Subset of the Headless Tree *instance* API used by QueryTree logic hooks.
// This is intentionally structural (not tied to @headless-tree internal types) so we can
// keep hook boundaries type-safe while still being resilient to minor library upgrades.
export type TreeState = {
  expandedItems? : string[];
  selectedItems? : string[];
  focusedItem?   : string;
};

export type TreeContainerProps = {
  style?     : React.CSSProperties;
  className? : string;
  onFocus?   : (e: React.FocusEvent) => void;
  onBlur?    : (e: React.FocusEvent) => void;
  ref?       : unknown;
  [key: string]: unknown;
};

export type TreeItemInstanceApi<TData> = TreeItemApi<TData> & {
  invalidateItemData?      : () => void;
  invalidateChildrenIds?   : () => void;
  updateCachedChildrenIds? : (ids: string[]) => void;
  getTree?                 : () => TreeApi<TData>;
};

export type TreeApi<TData> = {
  getState?          : () => TreeState;
  getItems?          : () => Array<TreeItemInstanceApi<TData>>;
  getItemInstance?   : (id: string) => TreeItemInstanceApi<TData> | null | undefined;
  loadChildrenIds?   : (id: string) => void;
  getContainerProps? : (label: string) => TreeContainerProps;
  setSelectedItems?  : (ids: string[]) => void;
  setExpandedItems?  : (ids: string[]) => void;
  collapseAll?       : () => void;
  // AIDEV-NOTE: Headless Tree supports a config updater function. We keep this permissive because
  // the config shape is library-defined and can evolve across versions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setConfig?         : (updater: (prev: any) => any) => void;
};

// AIDEV-NOTE: UI action handler types, separated for reusability across Toolbar/Row and hooks.
export type OnRename        = (id: string) => void | Promise<void>;
export type OnDropMove      = (dragId: string, dropTargetId: string, isTargetFolder: boolean) => void | Promise<void>;
export type OnCreateFolder  = () => void | Promise<void>;
export type OnCreateFile    = () => void | Promise<void>;
export type OnCollapseAll   = () => void | Promise<void>;

export type DragPayload = string;

export type TreeConfig = {
  containerLabel: string;
  maxDepth: number;
};
