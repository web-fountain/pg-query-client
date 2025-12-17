// AIDEV-NOTE: Encapsulates QueryTree row + toolbar actions. Draft creation is delegated
// to the caller (QueriesTree) so the UI can insert an inline-edit row before committing.
import type { OnCreateFolder, OnCreateFile, OnRename, OnDropMove } from '../types';

import { useReduxDispatch } from '@Redux/storeHooks';
import { moveSavedQueryNodeThunk } from '@Redux/records/queryTree/thunks';


type LoadableTree = {
  loadChildrenIds: (id: string) => void;
  collapseAll?: () => void;
  setExpandedItems?: (ids: string[]) => void;
  setConfig?: (updater: unknown) => void;
};

type UseItemActionsOptions = {
  // AIDEV-NOTE: Caller inserts a provisional draft folder row + wires inline editing.
  onCreateFolderDraft?: () => void | Promise<void>;
  // AIDEV-NOTE: Caller inserts a provisional draft file row + wires inline editing.
  onCreateFileDraft?: () => void | Promise<void>;
};

export function useItemActions(tree: LoadableTree, rootId: string, options?: UseItemActionsOptions) {
  const dispatch = useReduxDispatch();

  const alertIfBrowser = (message: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.alert(message);
    } catch {}
  };

  const handleCreateFolder: OnCreateFolder = async () => {
    if (options?.onCreateFolderDraft) {
      await options.onCreateFolderDraft();
      return;
    }
    alertIfBrowser('Folder creation is not wired yet.');
  };

  const handleCreateFile: OnCreateFile = async () => {
    if (options?.onCreateFileDraft) {
      await options.onCreateFileDraft();
      return;
    }
    alertIfBrowser('File creation is not wired yet.');
  };

  const handleRename: OnRename = async () => {
    alertIfBrowser('Renaming queries from the tree is not supported yet.');
  };

  const handleDropMove: OnDropMove = async (dragId, dropTargetId, isTargetFolder) => {
    if (!isTargetFolder) {
      return;
    }

    await dispatch(moveSavedQueryNodeThunk({
      nodeId          : dragId,
      newParentNodeId : dropTargetId
    }));
  };

  const handleCollapseAll = async () => {
    // AIDEV-NOTE: Collapse all folders by resetting expanded state to root-only.
    // (Root is synthetic and must stay "expanded" so the root list remains visible.)
    const root = String(rootId || '');
    if (!root) return;

    try {
      if (typeof tree.collapseAll === 'function') {
        tree.collapseAll();
        return;
      }
    } catch {}

    const nextExpandedItems = [root];

    try {
      if (typeof tree.setExpandedItems === 'function') {
        tree.setExpandedItems(nextExpandedItems);
        return;
      }
    } catch {}

    try {
      if (typeof tree.setConfig === 'function') {
        tree.setConfig((prev: any) => {
          const prevState = prev?.state || {};
          return {
            ...prev,
            state: {
              ...prevState,
              expandedItems: nextExpandedItems
            }
          };
        });
      }
    } catch {}
  };

  return {
    handleCreateFolder,
    handleCreateFile,
    handleRename,
    handleDropMove,
    handleCollapseAll
  };
}
