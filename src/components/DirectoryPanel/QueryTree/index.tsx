'use client';

import type { QueryTreeRecord, TreeNode } from '@Redux/records/queryTree/types';
import type { UUIDv7 }                    from '@Types/primitives';
import type { TreeItemInstanceApi }       from './types';

import {
  useCallback, useLayoutEffect,
  useRef, useState
}                                         from 'react';
import { usePathname }                    from 'next/navigation';
import {
  useReduxSelector,
  useReduxDispatch
}                                         from '@Redux/storeHooks';
import {
  selectQueryTree
}                                         from '@Redux/records/queryTree';
import {
  moveSavedQueryNodeThunk
}                                         from '@Redux/records/queryTree/thunks';
import {
  selectActiveTabId,
  selectTabIdByMountIdMap,
}                                         from '@Redux/records/tabbar';

import { useTreeSectionState }            from '../hooks/useTreeSectionState';
import { useItemActions }                 from './hooks/useItemActions';
import { useExpandedFoldersState }        from './hooks/useExpandedFoldersState';
import { useQueryTreeBackgroundGestures } from './hooks/useQueryTreeBackgroundGestures';
import { useQueryTreeDnD }                from './hooks/useQueryTreeDnD';
import { useHeadlessTree }                from './hooks/useHeadlessTree';
import type {
  DraftFileState,
  DraftFolderState
}                                         from './hooks/useQueryTreeDrafts';
import { useQueryTreeDrafts }             from './hooks/useQueryTreeDrafts';
import { useQueryTreeExpansion }          from './hooks/useQueryTreeExpansion';
import { useQueryTreeFocus }              from './hooks/useQueryTreeFocus';
import { useQueryTreeInvalidations }      from './hooks/useQueryTreeInvalidations';
import { useQueryTreeSelection }          from './hooks/useQueryTreeSelection';
import { useQueriesRoute }                from '@QueriesProvider/QueriesRouteProvider';
import Row                                from './components/Row';
import SectionHeader                      from './components/SectionHeader';
import TreeBody                           from './components/TreeBody';

import styles                             from './styles.module.css';

// AIDEV-NOTE: Outer wrapper owns section open state + draft UI state.
// The inner tree instance is keyed by section root id so headless-tree state is preserved
// across Redux updates; changes are propagated via targeted invalidations.
function QueriesTree(props: { rootId: string; indent?: number; label?: string }) {
  const { isOpen, setIsOpen } = useTreeSectionState(props.rootId, true);
  const queryTree             = useReduxSelector(selectQueryTree);

  // AIDEV-NOTE: Draft folder UI state must live in the outer wrapper because
  // it should survive any inner remount (e.g., section root changes) and avoid data loss.
  const [draftFolder, setDraftFolder] = useState<DraftFolderState | null>(null);
  const [draftFile, setDraftFile]     = useState<DraftFileState | null>(null);

  // AIDEV-NOTE: Keep a stable key per section root so headless-tree preserves expanded
  // folder state across structural updates. Changes to the underlying Redux tree are
  // propagated via targeted invalidations in QueriesTreeInner instead of full remounts.
  const resetKey = props.rootId;

  return (
    <QueriesTreeInner
      key={resetKey}
      queryTree={queryTree}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      draftFolder={draftFolder}
      setDraftFolder={setDraftFolder}
      draftFile={draftFile}
      setDraftFile={setDraftFile}
      {...props}
    />
  );
}

function QueriesTreeInner(
{
    rootId,
    indent = 20,
    label = 'QUERIES',
    queryTree,
    isOpen,
    setIsOpen,
    draftFolder,
    setDraftFolder,
    draftFile,
    setDraftFile
  }:
  {
    rootId: string;
    indent?: number;
    label?: string;
    queryTree: QueryTreeRecord;
    isOpen: boolean;
    setIsOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
    draftFolder: DraftFolderState | null;
    setDraftFolder: (v: DraftFolderState | null | ((prev: DraftFolderState | null) => DraftFolderState | null)) => void;
    draftFile: DraftFileState | null;
    setDraftFile: (v: DraftFileState | null | ((prev: DraftFileState | null) => DraftFileState | null)) => void;
  }
) {
  const { navigateToSaved, opspaceId } = useQueriesRoute();
  const dispatch            = useReduxDispatch();

  // AIDEV-NOTE: Ref ensures dataLoader always reads latest queryTree,
  // avoiding stale closure issues with useTree config.
  const queryTreeRef    = useRef(queryTree);
  queryTreeRef.current = queryTree;

  // AIDEV-NOTE: Lift tab lookups to parent — single subscription for all rows
  const activeTabId       = useReduxSelector(selectActiveTabId);
  const mountIdToTabIdMap = useReduxSelector(selectTabIdByMountIdMap);
  const pathname          = usePathname();
  // AIDEV-NOTE: Only treat rows as "active from tabbar" when the QueryWorkspace route is mounted.
  // On the opspace landing page (/opspace/{id}) we always want a click to navigate.
  const isOnQueriesRoute  = (pathname || '').split('/').filter(Boolean).includes('queries');

  // AIDEV-NOTE: Scope persisted expansion state by opspace + section root id to avoid cross-opspace bleed.
  const expandedScopeId   = `${opspaceId}:${rootId}`;
  const {
    expanded    : persistedExpandedFolders,
    setExpanded : setPersistedExpandedFolders
  } = useExpandedFoldersState(expandedScopeId);
  const handleDropMoveSaved = useCallback(async (dragId: string, dropTargetId: string) => {
    await dispatch(moveSavedQueryNodeThunk({
      nodeId: dragId,
      newParentNodeId: dropTargetId
    }));
  }, [dispatch]);

  const dnd = useQueryTreeDnD({
    rootId,
    label,
    queryTreeRef,
    pendingInvalidations: queryTree.pendingInvalidations,
    onDropMove: handleDropMoveSaved
  });

  const tree = useHeadlessTree({ rootId, indent, queryTreeRef, dnd });

  useQueryTreeInvalidations({ tree, pendingInvalidations: queryTree.pendingInvalidations });

  // AIDEV-NOTE: Ref for scroll host (used for scrollbar gutter detection).
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const {
    sectionRef,
    isTreeFocused,
    setIsTreeFocused,
    markTreeFocused
  } = useQueryTreeFocus();
  const selection = useQueryTreeSelection({
    tree,
    rootId,
    markTreeFocused,
    setIsTreeFocused
  });

  const scrollSelectedRowIntoView = useCallback(() => {
    try {
      requestAnimationFrame(() => {
        try {
          const el = document.querySelector('[data-row="true"][aria-selected="true"]') as HTMLElement | null;
          el?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
        } catch {}
      });
    } catch {}
  }, []);
  const { ensureFolderExpanded } = useQueryTreeExpansion({
    tree,
    rootId,
    scopeId: expandedScopeId,
    persistedExpandedFolders,
    setPersistedExpandedFolders
  });
  const drafts = useQueryTreeDrafts({
    tree,
    rootId,
    isTreeFocused,
    queryTreeRef,
    draftFolder,
    setDraftFolder,
    draftFile,
    setDraftFile,
    ensureFolderExpanded,
    selectTreeItem: selection.selectTreeItem,
    scrollSelectedRowIntoView,
    navigateToSaved
  });

  const gestures = useQueryTreeBackgroundGestures({
    sectionRef,
    selectTreeItem: selection.selectTreeItem,
    clearSelectionToRoot: selection.clearSelectionToRoot,
    scrollSelectedRowIntoView,
    createRootFileDraft: drafts.createRootFileDraft,
    draftFolderRef: drafts.draftFolderRef,
    draftFileRef: drafts.draftFileRef
  });

  // AIDEV-NOTE: Row actions scoped to this section root
  const actions = useItemActions(tree, rootId, {
    onCreateFolderDraft: drafts.onCreateFolderDraft,
    onCreateFileDraft: drafts.onCreateFileDraft
  });

  // Compute rendering ranges and items outside JSX
  const allItems = tree.getItems?.() ?? [];
  // AIDEV-NOTE: Detect whether any folder (excluding the synthetic section root) is expanded.
  // Keep this aligned with the rendered-item list to avoid enabling "Collapse All" for not-yet-materialized expansions.
  let hasExpandedFolder = false;
  // AIDEV-NOTE: Baseline diagnostic — disable custom virtualization, render all items
  const renderItems: Array<TreeItemInstanceApi<TreeNode>> = [];
  for (const it of allItems) {
    let id = '';
    try { id = String(it?.getId?.() ?? ''); } catch {}
    if (!id || id === String(rootId)) continue;
    renderItems.push(it);
    if (hasExpandedFolder) continue;
    try {
      if (it?.isFolder?.() && it?.isExpanded?.() === true) {
        hasExpandedFolder = true;
      }
    } catch {}
  }

  // AIDEV-NOTE: Toggle scrollbar gutter only when vertical scrollbar is present.
  // This ensures `scrollbar-gutter` is unset when no scrollbar is visible.
  // AIDEV-NOTE: Skip measurement/observers while the section is collapsed (no UX change; content is not visible).
  // useLayoutEffect ensures the attribute is updated before paint when opening.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = scrollerRef.current;
    if (!el) return;

    let raf = 0;
    const check = () => {
      try {
        const hasY = el.scrollHeight > (el.clientHeight + 1);
        if (hasY) el.setAttribute('data-has-scrollbar', 'true');
        else el.removeAttribute('data-has-scrollbar');
      } catch {}
    };

    check();

    const onResizeFrame = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(check);
    };

    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(onResizeFrame);
      ro.observe(el);
    } catch {}

    window.addEventListener('resize', onResizeFrame);

    return () => {
      try { ro?.disconnect(); } catch {}
      window.removeEventListener('resize', onResizeFrame);
      cancelAnimationFrame(raf);
    };
  }, [isOpen, allItems.length]);

  return (
    <section
      ref={sectionRef}
      className={styles['tree']}
      aria-label={label}
      data-open={isOpen ? 'true' : 'false'}
      data-row-focused={isTreeFocused ? 'true' : 'false'}
      onDoubleClickCapture={gestures.onDoubleClickCapture}
      onClickCapture={gestures.onClickCapture}
    >
      <SectionHeader
        label={label}
        isOpen={isOpen}
        onToggle={() => setIsOpen((v) => !v)}
        onCreateFolder={actions.handleCreateFolder}
        onCreateFile={actions.handleCreateFile}
        onCollapseAll={actions.handleCollapseAll}
        disableCollapseAll={!hasExpandedFolder}
      />
      <TreeBody
        tree={tree}
        label={label}
        scrollerRef={scrollerRef}
        isTreeFocused={isTreeFocused}
        onTreeFocus={markTreeFocused}
      >
        {renderItems.map((it) => {
          const itemId = String(it.getId?.() ?? '');
          const itemData = it.getItemData?.() as TreeNode | undefined;
          const mountId  = itemData?.mountId as UUIDv7 | undefined;
          const tabId    = mountId ? mountIdToTabIdMap.get(mountId) : undefined;
          const isActiveFromTab = isOnQueriesRoute && !!tabId && tabId === activeTabId;

          // AIDEV-NOTE: Extract selection state as primitive for memo comparison
          const itemProps = it.getProps?.();
          const ariaSelected = itemProps?.['aria-selected'];
          const isSelectedByTree = ariaSelected === true || ariaSelected === 'true';
          const rowIsTreeFocused = isSelectedByTree ? isTreeFocused : false;

          const draftFolderNodeId = draftFolder?.nodeId || null;
          const draftFileNodeId   = draftFile?.nodeId || null;
          const isDraftFolder     = draftFolderNodeId != null && itemId === String(draftFolderNodeId);
          const isDraftFile       = draftFileNodeId != null && itemId === String(draftFileNodeId);
          const isDraft           = isDraftFolder || isDraftFile;

          const editingName =
            isDraftFolder ? (draftFolder?.name ?? '') : isDraftFile ? (draftFile?.name ?? '') : undefined;
          const isEditingSubmitting =
            isDraftFolder ? !!draftFolder?.isSubmitting : isDraftFile ? !!draftFile?.isSubmitting : undefined;

          // AIDEV-NOTE: Only the draft row receives editing callbacks; this preserves Row memoization for all other rows.
          const onEditingNameChange = isDraft
            ? (next: string) => drafts.onEditingNameChange(itemId, next)
            : undefined;
          const onEditingCommit = isDraft
            ? (finalName: string) => drafts.onEditingCommit(itemId, finalName)
            : undefined;
          const onEditingCancel = isDraft
            ? () => drafts.onEditingCancel(itemId)
            : undefined;

          return (
            <Row
              key={itemId}
              item={it}
              indent={indent}
              onRename={actions.handleRename}
              isTopLevel={false}
              isTreeFocused={rowIsTreeFocused}
              onTreeFocusFromRow={markTreeFocused}
              isActiveFromTab={isActiveFromTab}
              tabId={tabId}
              isSelectedByTree={isSelectedByTree}
              isEditing={isDraft}
              editingName={editingName}
              isEditingSubmitting={isEditingSubmitting}
              onEditingNameChange={onEditingNameChange}
              onEditingCommit={onEditingCommit}
              onEditingCancel={onEditingCancel}
            />
          );
        })}
      </TreeBody>
    </section>
  );
}


export default QueriesTree;
