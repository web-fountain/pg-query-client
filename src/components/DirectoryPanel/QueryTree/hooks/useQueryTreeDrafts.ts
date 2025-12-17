'use client';

import type { TreeNode }                  from '@Redux/records/queryTree/types';
import type { UUIDv7 }                    from '@Types/primitives';
import type { TreeApi }                   from '../types';

import { useCallback, useEffect, useRef } from 'react';

import { useReduxDispatch }               from '@Redux/storeHooks';
import {
  insertChildAtIndex,
  removeNode,
  upsertNode
}                                         from '@Redux/records/queryTree';
import {
  createQueryFolderThunk,
  createSavedQueryFileThunk,
  getQueryTreeNodeChildrenThunk
}                                         from '@Redux/records/queryTree/thunks';
import { DEFAULT_QUERY_FILE_EXT }         from '@Redux/records/queryTree/constraints';
import { generateUUIDv7 }                 from '@Utils/generateId';

import {
  computeChildrenIdsAfterInsert,
  primeChildrenIdsCache,
  updateChildrenIdsCache
}                                         from '../utils/headlessTreeCache';



export type DraftFolderState = {
  nodeId        : string;
  parentId      : string;
  name          : string;
  isSubmitting  : boolean;
};

export type DraftFileState = {
  nodeId        : string;
  parentId      : string;
  dataQueryId   : UUIDv7;
  name          : string;
  isSubmitting  : boolean;
};

type Args = {
  tree                      : TreeApi<TreeNode>;
  rootId                    : string;
  isTreeFocused             : boolean;
  queryTreeRef              : React.RefObject<any>;
  draftFolder               : DraftFolderState | null;
  setDraftFolder            : (v: DraftFolderState | null | ((prev: DraftFolderState | null) => DraftFolderState | null)) => void;
  draftFile                 : DraftFileState | null;
  setDraftFile              : (v: DraftFileState | null | ((prev: DraftFileState | null) => DraftFileState | null)) => void;
  ensureFolderExpanded      : (folderNodeId: string) => Promise<void>;
  selectTreeItem            : (nodeId: string) => void;
  scrollSelectedRowIntoView : () => void;
  navigateToSaved           : (dataQueryId: UUIDv7) => void;
};

type Result = {
  draftFolderRef      : React.RefObject<DraftFolderState | null>;
  draftFileRef        : React.RefObject<DraftFileState | null>;
  onCreateFolderDraft : () => void | Promise<void>;
  onCreateFileDraft   : () => void | Promise<void>;
  createRootFileDraft : () => void;
  onEditingNameChange : (nodeId: string, next: string) => void;
  onEditingCommit     : (nodeId: string, finalName: string) => void | Promise<void>;
  onEditingCancel     : (nodeId: string) => void | Promise<void>;
};

function useQueryTreeDrafts({
  tree,
  rootId,
  isTreeFocused,
  queryTreeRef,
  draftFolder,
  setDraftFolder,
  draftFile,
  setDraftFile,
  ensureFolderExpanded,
  selectTreeItem,
  scrollSelectedRowIntoView,
  navigateToSaved
}: Args): Result {
  const dispatch = useReduxDispatch();

  // AIDEV-NOTE: Keep the latest draft refs for global event handlers so we don't rely on
  // React state timing (e.g., dblclick can fire before blur-driven draft cancel commits).
  const draftFolderRef  = useRef<DraftFolderState | null>(null);
  const draftFileRef    = useRef<DraftFileState | null>(null);

  draftFolderRef.current  = draftFolder;
  draftFileRef.current    = draftFile;

  const debugLog = useCallback((event: string, payload?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'production') return;
    // eslint-disable-next-line no-console
    console.log('[QueryTree]', event, payload || {});
  }, []);

  const getInsertIndexForPlacement = useCallback((parentNodeId: string, placement: 'top' | 'after-last-folder') => {
    if (placement === 'top') return 0;
    // AIDEV-NOTE: Root children are folder-first, so the first non-folder index is “after last folder”.
    const ids = queryTreeRef.current?.childrenByParentId?.[String(parentNodeId) as any] || [];
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    let idx = 0;
    for (; idx < ids.length; idx++) {
      const n = queryTreeRef.current?.nodes?.[String(ids[idx]) as any] as any;
      if (!n || n.kind !== 'folder') break;
    }
    return idx;
  }, [queryTreeRef]);

  const getCreatePlacement = useCallback((createKind: 'folder' | 'file') => {
    // AIDEV-NOTE: Derive draft placement from headless-tree selection/focus state.
    // Prefer selectedItems (matches visible highlight).
    // AIDEV-NOTE: UX rule — if this tree section is not focused (no active highlight),
    // treat toolbar create as "create at root" even if headless-tree still holds an old selection.
    // This avoids surprising inserts into a previously-selected folder after the user clicks away.
    if (!isTreeFocused) {
      return { parentNodeId: String(rootId), placement: 'after-last-folder' as const };
    }

    // AIDEV-NOTE: In this headless-tree version, `focusedItem` can lag behind selection and
    // is not reliably settable via config updates, so we intentionally do NOT use it for placement.
    const state         = (tree.getState?.() as any) || {};
    const selectedItems = (state?.selectedItems || []) as string[];

    const pickSelectedId = () => {
      // Prefer the most recent non-root selection if multiple exist.
      for (let i = selectedItems.length - 1; i >= 0; i--) {
        const id = String(selectedItems[i]);
        if (id && id !== String(rootId)) return id;
      }
      return '';
    };

    const selectedId = pickSelectedId();
    const selectedNode = selectedId ? (queryTreeRef.current?.nodes?.[selectedId] as any) : null;

    // No selection => root, after last folder boundary.
    if (!selectedId || !selectedNode) {
      return { parentNodeId: String(rootId), placement: 'after-last-folder' as const };
    }

    if (selectedNode.kind === 'folder') {
      if (createKind === 'file') {
        // Folder selected + new file => within folder, after last folder boundary.
        return { parentNodeId: String(selectedId), placement: 'after-last-folder' as const };
      }
      // Folder selected + new folder => within folder, first child (visually right below folder row).
      return { parentNodeId: String(selectedId), placement: 'top' as const };
    }

    // File selected => create in its parent.
    const parentNodeId = String(selectedNode.parentNodeId ?? rootId);
    if (!parentNodeId || parentNodeId === String(rootId)) {
      if (createKind === 'file') {
        // File under root + new file => insert directly below selected file.
        return { parentNodeId: String(rootId), placement: 'after-selected' as const, afterNodeId: String(selectedId) };
      }
      // File under root + new folder => root, after last folder boundary.
      return { parentNodeId: String(rootId), placement: 'after-last-folder' as const };
    }

    if (createKind === 'file') {
      // File inside folder + new file => insert directly below selected file.
      return { parentNodeId, placement: 'after-selected' as const, afterNodeId: String(selectedId) };
    }

    // File inside folder + new folder => parent folder, first child (visually right below folder row).
    return { parentNodeId, placement: 'top' as const };
  }, [isTreeFocused, queryTreeRef, rootId, tree]);

  // AIDEV-NOTE: Draft node insertion/removal does not remount the tree, so we must refresh the
  // parent's children ids when a draft appears/disappears.
  const lastDraftParentIdRef = useRef<string | null>(null);
  useEffect(() => {
    const draftParentId = draftFolder?.parentId || draftFile?.parentId;
    if (draftParentId) lastDraftParentIdRef.current = draftParentId;
    const parentId = draftParentId ?? lastDraftParentIdRef.current;
    if (!parentId) return;

    try {
      const parentItem = tree.getItemInstance?.(parentId);
      parentItem?.invalidateChildrenIds?.();
    } catch {}

    try { tree.loadChildrenIds?.(parentId); } catch {}
  }, [draftFolder?.nodeId, draftFolder?.parentId, draftFile?.nodeId, draftFile?.parentId, tree]);

  const onEditingNameChange = useCallback((nodeId: string, next: string) => {
    const id = String(nodeId || '');
    if (!id) return;

    if (draftFolder?.nodeId && id === String(draftFolder.nodeId)) {
      setDraftFolder((prev) => {
        if (!prev) return prev;
        return { ...prev, name: next };
      });
      return;
    }

    if (draftFile?.nodeId && id === String(draftFile.nodeId)) {
      setDraftFile((prev) => {
        if (!prev) return prev;
        return { ...prev, name: next };
      });
    }
  }, [draftFile?.nodeId, draftFolder?.nodeId, setDraftFile, setDraftFolder]);

  const onEditingCancel = useCallback(async (nodeId: string) => {
    const id = String(nodeId || '');
    if (!id) return;

    if (draftFolder?.nodeId && id === String(draftFolder.nodeId)) {
      const parentId = draftFolder.parentId;
      if (!parentId) return;
      if (draftFolder.isSubmitting) return;
      dispatch(removeNode({ parentId, nodeId: id }));
      setDraftFolder(null);
      return;
    }

    if (draftFile?.nodeId && id === String(draftFile.nodeId)) {
      const parentId = draftFile.parentId;
      if (!parentId) return;
      if (draftFile.isSubmitting) return;
      dispatch(removeNode({ parentId, nodeId: id }));
      setDraftFile(null);
    }
  }, [dispatch, draftFile, draftFolder, setDraftFile, setDraftFolder]);

  const onEditingCommit = useCallback(async (nodeId: string, finalName: string) => {
    const id = String(nodeId || '');
    if (!id) return;

    const trimmed = String(finalName ?? '').trim();
    if (!trimmed) return;

    if (draftFolder?.nodeId && id === String(draftFolder.nodeId)) {
      const parentId = draftFolder.parentId;
      if (!parentId) return;
      if (draftFolder.isSubmitting) return;

      setDraftFolder((prev) => {
        if (!prev) return prev;
        return { ...prev, isSubmitting: true };
      });

      let created: TreeNode | null = null;
      try {
        const parentFolderId = (() => {
          if (String(parentId) === String(rootId)) return undefined;
          const p = queryTreeRef.current?.nodes?.[String(parentId) as any] as any;
          if (!p || p.kind !== 'folder') return undefined;
          const fid = p.mountId;
          return fid ? String(fid) : undefined;
        })();

        created = await dispatch(
          createQueryFolderThunk({
            parentFolderId,
            name: trimmed
          })
        ).unwrap();
      } catch {
        created = null;
      }

      if (created) {
        dispatch(removeNode({ parentId, nodeId: id }));
        setDraftFolder(null);
        try { selectTreeItem(String((created as any).nodeId ?? '')); } catch {}
      } else {
        // AIDEV-NOTE: Backend create failed; keep the draft row so the user can retry or cancel.
        setDraftFolder((prev) => {
          if (!prev) return prev;
          return { ...prev, isSubmitting: false };
        });
      }
      return;
    }

    if (draftFile?.nodeId && id === String(draftFile.nodeId)) {
      const parentId = draftFile.parentId;
      const dataQueryId = draftFile.dataQueryId;
      if (!parentId || !dataQueryId) return;
      if (draftFile.isSubmitting) return;

      setDraftFile((prev) => {
        if (!prev) return prev;
        return { ...prev, isSubmitting: true };
      });

      let created: TreeNode | null = null;
      try {
        const parentFolderId = (() => {
          if (String(parentId) === String(rootId)) return undefined;
          const p = queryTreeRef.current?.nodes?.[String(parentId) as any] as any;
          if (!p || p.kind !== 'folder') return undefined;
          const fid = p.mountId;
          return fid ? String(fid) : undefined;
        })();

        created = await dispatch(
          createSavedQueryFileThunk({
            dataQueryId,
            name: trimmed,
            parentFolderId
          })
        ).unwrap();
      } catch {
        created = null;
      }

      if (created) {
        dispatch(removeNode({ parentId, nodeId: id }));
        setDraftFile(null);
        try { selectTreeItem(String((created as any).nodeId ?? '')); } catch {}
        // AIDEV-NOTE: Navigate to the newly created saved query URL.
        navigateToSaved(created.mountId as UUIDv7);
      } else {
        setDraftFile((prev) => {
          if (!prev) return prev;
          return { ...prev, isSubmitting: false };
        });
      }
    }
  }, [
    dispatch,
    draftFile,
    draftFolder,
    navigateToSaved,
    queryTreeRef,
    rootId,
    selectTreeItem,
    setDraftFile,
    setDraftFolder
  ]);

  const onCreateFolderDraft = useCallback(async () => {
    // AIDEV-NOTE: Only one draft row can exist at a time. If the user clicks “New Folder”
    // while an empty draft exists, cancel it and proceed. If it has text or is submitting,
    // keep it and focus it instead to avoid data loss.
    if (draftFolder) {
      if (draftFolder.isSubmitting) return;
      const trimmed = (draftFolder.name ?? '').trim();
      if (!trimmed) {
        dispatch(removeNode({ parentId: draftFolder.parentId, nodeId: draftFolder.nodeId }));
        setDraftFolder(null);
      } else {
        selectTreeItem(draftFolder.nodeId);
        return;
      }
    }
    if (draftFile) {
      if (draftFile.isSubmitting) return;
      const trimmed = (draftFile.name ?? '').trim();
      if (!trimmed) {
        dispatch(removeNode({ parentId: draftFile.parentId, nodeId: draftFile.nodeId }));
        setDraftFile(null);
      } else {
        selectTreeItem(draftFile.nodeId);
        return;
      }
    }

    const placement = getCreatePlacement('folder');
    const parentId = placement.parentNodeId;
    let fetchedChildren: TreeNode[] | null = null;

    // AIDEV-NOTE: If creating inside a folder, ensure it is expanded and its children are present in Redux.
    if (parentId && parentId !== rootId) {
      try {
        const known = queryTreeRef.current?.childrenByParentId?.[parentId as any];
        if (known === undefined) {
          fetchedChildren = await dispatch(getQueryTreeNodeChildrenThunk({ nodeId: parentId })).unwrap();
        } else {
          fetchedChildren = (known || []).map((id: string) => queryTreeRef.current?.nodes?.[id]).filter(Boolean) as TreeNode[];
        }
      } catch {}

      // AIDEV-NOTE: Prime HT's childrenIds cache BEFORE expanding so HT doesn't schedule a background load via setTimeout.
      primeChildrenIdsCache(tree as any, String(parentId), fetchedChildren);

      // AIDEV-NOTE: Expand after children are known so headless-tree can render the draft reliably.
      await ensureFolderExpanded(parentId);
    }

    const nodeId = generateUUIDv7() as unknown as string;
    const folderId = generateUUIDv7() as unknown as string;

    const parentLevel = (() => {
      if (parentId === rootId) return 0;
      const p = queryTreeRef.current?.nodes?.[String(parentId) as any] as any;
      const lvl = Number(p?.level ?? 0);
      return Number.isFinite(lvl) ? lvl : 0;
    })();

    const draftNode: TreeNode = {
      nodeId       : nodeId as UUIDv7,
      parentNodeId : parentId,
      kind         : 'folder',
      label        : '',
      sortKey      : '',
      // AIDEV-NOTE: mountId is the canonical folder id (queryTreeFolderId), distinct from nodeId.
      mountId      : folderId as UUIDv7,
      level        : parentLevel + 1
    };

    dispatch(upsertNode(draftNode));
    const insertIndex = (() => {
      if (placement.placement === 'top') return 0;
      if (fetchedChildren) {
        let idx = 0;
        for (; idx < fetchedChildren.length; idx++) {
          const k = (fetchedChildren[idx] as any)?.kind;
          if (k !== 'folder') break;
        }
        return idx;
      }
      return getInsertIndexForPlacement(parentId, 'after-last-folder');
    })();

    dispatch(insertChildAtIndex({
      parentId  : parentId,
      node      : draftNode,
      index     : insertIndex
    }));

    // AIDEV-NOTE: Update headless-tree childrenIds cache directly so the draft row renders immediately.
    try {
      const baseIds = (() => {
        if (fetchedChildren) return fetchedChildren.map((c) => String((c as any)?.nodeId ?? '')).filter(Boolean);
        const ids = queryTreeRef.current?.childrenByParentId?.[String(parentId) as any] || [];
        return Array.isArray(ids) ? ids.map((x) => String(x)).filter(Boolean) : [];
      })();
      const nextIds = computeChildrenIdsAfterInsert(baseIds, String(nodeId), insertIndex);
      updateChildrenIdsCache(tree as any, String(parentId), nextIds);
    } catch {}

    // AIDEV-NOTE: For empty folders, some headless-tree configs won't “open” a folder until it has a child.
    // Re-attempt expansion after insertion so the draft is visible.
    if (parentId && parentId !== rootId) {
      try {
        requestAnimationFrame(() => {
          void ensureFolderExpanded(parentId);
          selectTreeItem(nodeId);
          scrollSelectedRowIntoView();
          debugLog('draftCreated', { kind: 'folder', parentId, nodeId });
        });
      } catch {
        selectTreeItem(nodeId);
        scrollSelectedRowIntoView();
        debugLog('draftCreated', { kind: 'folder', parentId, nodeId });
      }
    } else {
      selectTreeItem(nodeId);
      scrollSelectedRowIntoView();
      debugLog('draftCreated', { kind: 'folder', parentId, nodeId });
    }

    setDraftFolder({
      nodeId        : nodeId,
      parentId      : parentId,
      name          : '',
      isSubmitting  : false
    });
  }, [
    debugLog,
    dispatch,
    draftFile,
    draftFolder,
    ensureFolderExpanded,
    getCreatePlacement,
    getInsertIndexForPlacement,
    queryTreeRef,
    rootId,
    scrollSelectedRowIntoView,
    selectTreeItem,
    setDraftFile,
    setDraftFolder,
    tree
  ]);

  const onCreateFileDraft = useCallback(async () => {
    // AIDEV-NOTE: Only one draft row can exist at a time. If the user clicks “New File”
    // while an empty draft exists, cancel it and proceed. If it has text or is submitting,
    // keep it and focus it instead to avoid data loss.
    if (draftFolder) {
      if (draftFolder.isSubmitting) return;
      const trimmed = (draftFolder.name ?? '').trim();
      if (!trimmed) {
        dispatch(removeNode({ parentId: draftFolder.parentId, nodeId: draftFolder.nodeId }));
        setDraftFolder(null);
      } else {
        selectTreeItem(draftFolder.nodeId);
        return;
      }
    }
    if (draftFile) {
      if (draftFile.isSubmitting) return;
      const trimmed = (draftFile.name ?? '').trim();
      if (!trimmed) {
        dispatch(removeNode({ parentId: draftFile.parentId, nodeId: draftFile.nodeId }));
        setDraftFile(null);
      } else {
        selectTreeItem(draftFile.nodeId);
        return;
      }
    }

    const placement = getCreatePlacement('file');
    const parentId = placement.parentNodeId;
    let fetchedChildren: TreeNode[] | null = null;

    // AIDEV-NOTE: If creating inside a folder, ensure it is expanded and its children are present in Redux.
    if (parentId && parentId !== rootId) {
      try {
        const known = queryTreeRef.current?.childrenByParentId?.[parentId as any];
        if (known === undefined) {
          fetchedChildren = await dispatch(getQueryTreeNodeChildrenThunk({ nodeId: parentId })).unwrap();
        } else {
          fetchedChildren = (known || []).map((id: string) => queryTreeRef.current?.nodes?.[id]).filter(Boolean) as TreeNode[];
        }
      } catch {}

      primeChildrenIdsCache(tree as any, String(parentId), fetchedChildren);
      await ensureFolderExpanded(parentId);
    }

    const nodeId = generateUUIDv7() as unknown as string;
    const dataQueryId = generateUUIDv7() as unknown as UUIDv7;

    const parentLevel = (() => {
      if (parentId === rootId) return 0;
      const p = queryTreeRef.current?.nodes?.[String(parentId) as any] as any;
      const lvl = Number(p?.level ?? 0);
      return Number.isFinite(lvl) ? lvl : 0;
    })();

    const draftNode: TreeNode = {
      nodeId       : nodeId as unknown as UUIDv7,
      parentNodeId : parentId,
      kind         : 'file',
      label        : '',
      ext          : DEFAULT_QUERY_FILE_EXT,
      sortKey      : '',
      mountId      : dataQueryId,
      level        : parentLevel + 1
    };

    dispatch(upsertNode(draftNode));
    const insertIndex = (() => {
      if (placement.placement === 'after-selected' && (placement as any).afterNodeId) {
        const afterNodeId = String((placement as any).afterNodeId);
        const ids = queryTreeRef.current?.childrenByParentId?.[String(parentId) as any] || [];
        if (Array.isArray(ids)) {
          const i = ids.indexOf(String(afterNodeId));
          if (i >= 0) return i + 1;
        }
      }
      if (fetchedChildren && placement.placement !== 'after-selected') {
        let idx = 0;
        for (; idx < fetchedChildren.length; idx++) {
          const k = (fetchedChildren[idx] as any)?.kind;
          if (k !== 'folder') break;
        }
        return idx;
      }
      return getInsertIndexForPlacement(
        parentId,
        placement.placement === 'top' ? 'top' : 'after-last-folder'
      );
    })();

    dispatch(insertChildAtIndex({
      parentId  : parentId,
      node      : draftNode,
      index     : insertIndex
    }));

    try {
      const baseIds = (() => {
        if (fetchedChildren) return fetchedChildren.map((c) => String((c as any)?.nodeId ?? '')).filter(Boolean);
        const ids = queryTreeRef.current?.childrenByParentId?.[String(parentId) as any] || [];
        return Array.isArray(ids) ? ids.map((x) => String(x)).filter(Boolean) : [];
      })();
      const nextIds = computeChildrenIdsAfterInsert(baseIds, String(nodeId), insertIndex);
      updateChildrenIdsCache(tree as any, String(parentId), nextIds);
    } catch {}

    if (parentId && parentId !== rootId) {
      try {
        requestAnimationFrame(() => {
          void ensureFolderExpanded(parentId);
          selectTreeItem(nodeId);
          scrollSelectedRowIntoView();
          debugLog('draftCreated', {
            kind        : 'file',
            parentId    : parentId,
            nodeId      : nodeId,
            insertIndex : insertIndex,
            placement   : (placement as any)?.placement,
            afterNodeId : (placement as any)?.afterNodeId
          });
        });
      } catch {
        selectTreeItem(nodeId);
        scrollSelectedRowIntoView();
        debugLog('draftCreated', {
          kind        : 'file',
          parentId    : parentId,
          nodeId      : nodeId,
          insertIndex : insertIndex,
          placement   : (placement as any)?.placement,
          afterNodeId : (placement as any)?.afterNodeId
        });
      }
    } else {
      selectTreeItem(nodeId);
      scrollSelectedRowIntoView();
      debugLog('draftCreated', {
        kind        : 'file',
        parentId    : parentId,
        nodeId      : nodeId,
        insertIndex : insertIndex,
        placement   : (placement as any)?.placement,
        afterNodeId : (placement as any)?.afterNodeId
      });
    }

    setDraftFile({
      nodeId        : nodeId,
      parentId      : parentId,
      dataQueryId   : dataQueryId,
      name          : '',
      isSubmitting  : false
    });
  }, [
    debugLog,
    dispatch,
    draftFile,
    draftFolder,
    ensureFolderExpanded,
    getCreatePlacement,
    getInsertIndexForPlacement,
    queryTreeRef,
    rootId,
    scrollSelectedRowIntoView,
    selectTreeItem,
    setDraftFile,
    setDraftFolder,
    tree
  ]);

  const createRootFileDraft = useCallback(() => {
    const parentId    = rootId;
    const nodeId      = generateUUIDv7() as unknown as string;
    const dataQueryId = generateUUIDv7() as unknown as UUIDv7;

    const draftNode: TreeNode = {
      nodeId       : nodeId as unknown as UUIDv7,
      parentNodeId : parentId,
      kind         : 'file',
      label        : '',
      ext          : DEFAULT_QUERY_FILE_EXT,
      sortKey      : '',
      mountId      : dataQueryId,
      level        : 1
    };

    dispatch(upsertNode(draftNode));
    dispatch(insertChildAtIndex({
      parentId  : parentId,
      node      : draftNode,
      index     : getInsertIndexForPlacement(parentId, 'after-last-folder')
    }));

    setDraftFile({
      nodeId        : nodeId,
      parentId      : parentId,
      dataQueryId   : dataQueryId,
      name          : '',
      isSubmitting  : false
    });

    selectTreeItem(nodeId);

    // AIDEV-NOTE: Best-effort scroll into view so the user always sees the draft row.
    try {
      requestAnimationFrame(() => {
        const el = document.querySelector('[data-row="true"][aria-selected="true"]') as HTMLElement | null;
        el?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
      });
    } catch {}
  }, [dispatch, getInsertIndexForPlacement, rootId, selectTreeItem, setDraftFile]);

  return {
    draftFolderRef,
    draftFileRef,
    onCreateFolderDraft,
    onCreateFileDraft,
    createRootFileDraft,
    onEditingNameChange,
    onEditingCommit,
    onEditingCancel
  };
}


export { useQueryTreeDrafts };
