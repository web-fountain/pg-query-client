// AIDEV-NOTE: Encapsulates create/rename/move behaviors and parent refreshes.
import { OnCreateFolder, OnCreateFile, OnRename, OnDropMove } from '../types';
import {
  createFolder as apiCreateFolder,
  createQueryFile as apiCreateQueryFile,
  renameItem as apiRenameItem,
  moveItem as apiMoveItem,
  getParentId as apiGetParentId
} from '../api/fsClient';

type LoadableTree = { loadChildrenIds: (id: string) => void } & { [key: string]: unknown };

export function useItemActions(tree: LoadableTree, targetFolderId: string) {
  // AIDEV-NOTE: micro-batching for parent refreshes within same tick
  let refreshQueue = new Set<string>();
  const flushRefreshes = () => {
    const ids = Array.from(refreshQueue);
    refreshQueue = new Set();
    if (ids.length === 0) return;
    try { Promise.all(ids.map((pid) => Promise.resolve(tree.loadChildrenIds(pid)))); } catch {}
  };
  const queueRefresh = (id: string | null | undefined) => {
    if (!id) return;
    refreshQueue.add(id);
    Promise.resolve().then(flushRefreshes);
  };
  const handleCreateFolder: OnCreateFolder = async () => {
    try {
      await apiCreateFolder(targetFolderId, 'New Folder');
      queueRefresh(targetFolderId);
    } catch (e: any) {
      if (typeof window !== 'undefined') window.alert(e?.message || 'Create folder failed');
    }
  };

  const handleCreateFile: OnCreateFile = async () => {
    try {
      await apiCreateQueryFile(targetFolderId, 'new-query.sql');
      queueRefresh(targetFolderId);
    } catch (e: any) {
      if (typeof window !== 'undefined') window.alert(e?.message || 'Create file failed');
    }
  };

  const handleRename: OnRename = async (id) => {
    const current = (tree as any)?.getItem?.(id)?.getItemName?.() ?? '';
    const next = typeof window !== 'undefined' ? window.prompt('Rename to:', current) : null;
    if (!next || next === current) return;
    try {
      const { parentId } = await apiRenameItem(id, next);
      queueRefresh(parentId ?? undefined);
    } catch (e: any) {
      if (typeof window !== 'undefined') window.alert(e?.message || 'Rename failed');
    }
  };

  const handleDropMove: OnDropMove = async (dragId, dropTargetId, isTargetFolder) => {
    let parentId: string | null = null;
    if (isTargetFolder) parentId = dropTargetId;
    else parentId = await apiGetParentId(dropTargetId);
    if (!parentId) return;
    try {
      const { oldParentId, newParentId } = await apiMoveItem(dragId, parentId);
      queueRefresh(oldParentId ?? undefined);
      queueRefresh(newParentId ?? undefined);
    } catch (e: any) {
      if (typeof window !== 'undefined') window.alert(e?.message || 'Move failed');
    }
  };

  return {
    handleCreateFolder,
    handleCreateFile,
    handleRename,
    handleDropMove
  };
}
