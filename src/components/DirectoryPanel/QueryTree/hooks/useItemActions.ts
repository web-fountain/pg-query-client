// AIDEV-NOTE: Encapsulates create/rename/move behaviors and parent refreshes.
// AIDEV-TODO: Implement real QueryTree thunks for rename and wire them here.
import type { OnCreateFolder, OnCreateFile, OnRename, OnDropMove }  from '../types';

import { useReduxDispatch }                                         from '@Redux/storeHooks';
import { moveSavedQueryNodeThunk }                                  from '@Redux/records/queryTree/thunks';


type LoadableTree = { loadChildrenIds: (id: string) => void } & { [key: string]: unknown };

type UseItemActionsOptions = {
  // AIDEV-NOTE: Called when the user clicks "New Folder". The caller (QueriesTreeInner)
  // is responsible for inserting a provisional draft node and wiring inline editing.
  onCreateFolderDraft?: () => void | Promise<void>;
  // AIDEV-NOTE: Called when the user clicks "New File". The caller (QueriesTreeInner)
  // is responsible for inserting a provisional draft file node and wiring inline editing.
  onCreateFileDraft?: () => void | Promise<void>;
};

export function useItemActions(_tree: LoadableTree, _targetFolderId: string, options?: UseItemActionsOptions) {
  const dispatch = useReduxDispatch();

  const handleCreateFolder: OnCreateFolder = async () => {
    // AIDEV-NOTE: Folder creation is a two-phase flow:
    // 1) UI inserts a provisional draft node and shows an inline input.
    // 2) On commit, a real backend-backed folder is created.
    // This hook delegates draft insertion to QueriesTreeInner via options.
    if (options?.onCreateFolderDraft) {
      await options.onCreateFolderDraft();
    } else {
      if (typeof window !== 'undefined') {
        window.alert('Folder creation is not wired yet.');
      }
    }
  };

  const handleCreateFile: OnCreateFile = async () => {
    // AIDEV-NOTE: File creation mirrors folder creation: insert a draft row + inline input,
    // then commit to the backend on Enter/blur in the QueryTree component.
    if (options?.onCreateFileDraft) {
      await options.onCreateFileDraft();
      return;
    }

    if (typeof window !== 'undefined') {
      window.alert('File creation is not wired yet.');
    }
  };

  const handleRename: OnRename = async () => {
    // AIDEV-TODO: Implement rename for QueryTree nodes via a thunk that updates both the
    // queryTree slice and the underlying dataQuery record.
    if (typeof window !== 'undefined') {
      window.alert('Renaming queries from the tree is not supported yet.');
    }
  };

  const handleDropMove: OnDropMove = async (dragId, dropTargetId, isTargetFolder) => {
    // AIDEV-NOTE: Saved QueryTree DnD supports moving files and folders into folders (or root).
    if (!isTargetFolder) {
      return;
    }

    await dispatch(moveSavedQueryNodeThunk({
      nodeId          : dragId,
      newParentNodeId : dropTargetId
    }));
  };

  return {
    handleCreateFolder,
    handleCreateFile,
    handleRename,
    handleDropMove,
    // AIDEV-TODO: Implement collapse-all behavior using headless-tree APIs (e.g., expandAllFeature)
    // or a future thunk. For now, the toolbar wiring expects this handler to exist.
    handleCollapseAll: async () => {
      if (typeof window !== 'undefined') {
        window.alert('Collapse all is not implemented yet.');
      }
    }
  };
}
