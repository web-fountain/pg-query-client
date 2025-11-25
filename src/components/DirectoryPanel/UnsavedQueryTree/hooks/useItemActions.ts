// AIDEV-NOTE: Encapsulates create/rename/move behaviors and parent refreshes.
import { useCallback } from 'react';
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
    try {
      // AIDEV-NOTE: Prefer item-level invalidation when available; fallback to loadChildrenIds
      Promise.all(ids.map((pid) => {
        try { return Promise.resolve((tree as any).invalidateChildren?.(pid)); } catch {}
        return Promise.resolve(tree.loadChildrenIds(pid));
      }));
    } catch {}
  };
  const queueRefresh = (id: string | null | undefined) => {
    if (!id) return;
    refreshQueue.add(id);
    Promise.resolve().then(flushRefreshes);
  };
  const handleCreateFolder: OnCreateFolder = useCallback(async () => {
    try {
      // AIDEV-NOTE: Prevent creating a folder that would end up at aria-level >= 4 (meta level >= 3)
      try {
        const parentItem = (tree as any)?.getItem?.(targetFolderId);
        const parentLevel = (parentItem?.getItemMeta?.()?.level ?? 0) as number;
        if (parentLevel + 1 >= 3) {
          if (typeof window !== 'undefined') window.alert('Folders cannot be nested beyond level 3.');
          return;
        }
      } catch {}
      await apiCreateFolder(targetFolderId, 'New Folder');
      // Invalidate target folder children to reflect new folder
      queueRefresh(targetFolderId);
    } catch (e: any) {
      if (typeof window !== 'undefined') window.alert(e?.message || 'Create folder failed');
    }
  }, [tree, targetFolderId]);

  const handleCreateFile: OnCreateFile = useCallback(async () => {
    try {
      await apiCreateQueryFile(targetFolderId, 'new-query.sql');
      queueRefresh(targetFolderId);
    } catch (e: any) {
      if (typeof window !== 'undefined') window.alert(e?.message || 'Create file failed');
    }
  }, [tree, targetFolderId]);

  const handleRename: OnRename = useCallback(async (id) => {
    const current = (tree as any)?.getItem?.(id)?.getItemName?.() ?? '';
    const next = typeof window !== 'undefined' ? window.prompt('Rename to:', current) : null;
    if (!next || next === current) return;
    try {
      const { parentId } = await apiRenameItem(id, next);
      // Prefer invalidating the item itself, then its parent children
      try { await (tree as any).invalidateItem?.(id); } catch {}
      queueRefresh(parentId ?? undefined);
    } catch (e: any) {
      if (typeof window !== 'undefined') window.alert(e?.message || 'Rename failed');
    }
  }, [tree]);

  const handleDropMove: OnDropMove = useCallback(async (dragId, dropTargetId, isTargetFolder) => {
    let parentId: string | null = null;
    if (isTargetFolder) parentId = dropTargetId;
    else parentId = await apiGetParentId(dropTargetId);
    if (!parentId) return;
    // AIDEV-NOTE: Guard against moves that would place a folder at aria-level >= 4 (meta level >= 3)
    try {
      const draggedItem = (tree as any)?.getItem?.(dragId);
      const targetItem = (tree as any)?.getItem?.(parentId);
      const draggedIsFolder = !!draggedItem?.isFolder?.();
      const parentLevel = (targetItem?.getItemMeta?.()?.level ?? 0) as number;
      const newLevel = parentLevel + 1;
      if (draggedIsFolder && newLevel >= 3) {
        if (typeof window !== 'undefined') window.alert('Folders cannot be nested beyond level 3.');
        return;
      }
    } catch {}
    try {
      const { oldParentId, newParentId } = await apiMoveItem(dragId, parentId);
      // Invalidate both parents' children
      queueRefresh(oldParentId ?? undefined);
      queueRefresh(newParentId ?? undefined);
      // Optionally invalidate moved item cache
      try { await (tree as any).invalidateItem?.(dragId); } catch {}
    } catch (e: any) {
      if (typeof window !== 'undefined') window.alert(e?.message || 'Move failed');
    }
  }, [tree]);

  return {
    handleCreateFolder,
    handleCreateFile,
    handleRename,
    handleDropMove
  };
}
