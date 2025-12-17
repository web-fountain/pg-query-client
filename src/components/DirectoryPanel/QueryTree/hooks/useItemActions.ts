// AIDEV-NOTE: Encapsulates QueryTree row + toolbar actions. Draft creation is delegated
// to the caller (QueriesTree) so the UI can insert an inline-edit row before committing.
import type {
  OnCreateFolder, OnCreateFile,
  OnRename, OnDropMove,
  TreeApi
}                                   from '../types';

import { useEffectEvent }           from 'react';
import { useReduxDispatch }         from '@Redux/storeHooks';
import { moveSavedQueryNodeThunk }  from '@Redux/records/queryTree/thunks';


type UseItemActionsOptions = {
  // AIDEV-NOTE: Caller inserts a provisional draft folder row + wires inline editing.
  onCreateFolderDraft?  : () => void | Promise<void>;
  // AIDEV-NOTE: Caller inserts a provisional draft file row + wires inline editing.
  onCreateFileDraft?    : () => void | Promise<void>;
};

export function useItemActions(tree: TreeApi<unknown>, rootId: string, options?: UseItemActionsOptions) {
  const dispatch = useReduxDispatch();
  const onCreateFolderDraft = options?.onCreateFolderDraft;
  const onCreateFileDraft   = options?.onCreateFileDraft;

  const alertIfBrowser = (message: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.alert(message);
    } catch {}
  };

  const handleCreateFolder: OnCreateFolder = useEffectEvent(async () => {
    if (onCreateFolderDraft) {
      await onCreateFolderDraft();
      return;
    }
    alertIfBrowser('Folder creation is not wired yet.');
  });

  const handleCreateFile: OnCreateFile = useEffectEvent(async () => {
    if (onCreateFileDraft) {
      await onCreateFileDraft();
      return;
    }
    alertIfBrowser('File creation is not wired yet.');
  });

  const handleRename: OnRename = useEffectEvent(async () => {
    alertIfBrowser('Renaming queries from the tree is not supported yet.');
  });

  const handleDropMove: OnDropMove = useEffectEvent(async (dragId, dropTargetId, isTargetFolder) => {
    if (!isTargetFolder) {
      return;
    }

    await dispatch(moveSavedQueryNodeThunk({
      nodeId          : dragId,
      newParentNodeId : dropTargetId
    }));
  });

  const handleCollapseAll = useEffectEvent(async () => {
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
  });

  return {
    handleCreateFolder,
    handleCreateFile,
    handleRename,
    handleDropMove,
    handleCollapseAll
  };
}
