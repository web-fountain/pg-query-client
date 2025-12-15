// AIDEV-NOTE: Encapsulates create/rename/move behaviors and parent refreshes.
// AIDEV-TODO: Implement real QueryTree thunks for rename/move and wire them here.
import type { OnCreateFolder, OnCreateFile, OnRename, OnDropMove }  from '../types';


type LoadableTree = { loadChildrenIds: (id: string) => void } & { [key: string]: unknown };

type UseItemActionsOptions = {
  // AIDEV-NOTE: Called when the user clicks "New Folder". The caller (QueriesTreeInner)
  // is responsible for inserting a provisional draft node and wiring inline editing.
  onCreateFolderDraft?: () => void | Promise<void>;
};

export function useItemActions(_tree: LoadableTree, _targetFolderId: string, options?: UseItemActionsOptions) {

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
    // AIDEV-TODO: Implement file creation for QueryTree using a thunk that inserts a new
    // saved query node and syncs with the backend.
    if (typeof window !== 'undefined') {
      window.alert('Creating files in Queries is not supported yet.');
    }
  };

  const handleRename: OnRename = async () => {
    // AIDEV-TODO: Implement rename for QueryTree nodes via a thunk that updates both the
    // queryTree slice and the underlying dataQuery record.
    if (typeof window !== 'undefined') {
      window.alert('Renaming queries from the tree is not supported yet.');
    }
  };

  const handleDropMove: OnDropMove = async () => {
    // AIDEV-TODO: Implement drag-and-drop move for QueryTree nodes backed by a thunk that
    // enforces depth/section constraints and syncs with the backend.
    return;
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
