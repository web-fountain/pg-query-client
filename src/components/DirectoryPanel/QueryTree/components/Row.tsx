'use client';

import type { TreeNode }                                      from '@Redux/records/queryTree/types';
import type { UUIDv7 }                                        from '@Types/primitives';
import type { TreeItemApi, OnRename, OnDropMove }            from '../types';

import { memo, useCallback, useEffect, useMemo, useRef }      from 'react';
import { useRouter, useParams }                   from 'next/navigation';

import { useReduxDispatch, useReduxSelector }     from '@Redux/storeHooks';
import { setActiveTabThunk, openTabThunk }        from '@Redux/records/tabbar/thunks';
import { logClientJson }                          from '@Observability/client';
import Icon                                       from '@Components/Icons';

import styles                                     from './Row.module.css';


// AIDEV-NOTE: Presentational row; spreads item props once, renders icon and name.
type RowProps = {
  item                : TreeItemApi<TreeNode>;
  indent              : number;
  onRename            : OnRename;
  onDropMove          : OnDropMove;
  isTopLevel?         : boolean;
  isTreeFocused?      : boolean;
  isActiveFromTab?    : boolean;
  tabId?              : UUIDv7;
  isSelectedByTree?   : boolean;
  onTreeFocusFromRow? : () => void;
  isEditing?          : boolean;
  isEditingSubmitting?: boolean;
  editingName?        : string;
  onEditingNameChange?: (next: string) => void;
  onEditingCommit?    : (finalName: string) => void;
  onEditingCancel?    : () => void;
};

function Row({
  item,
  indent,
  onRename,
  onDropMove,
  isTopLevel = false,
  isTreeFocused,
  isActiveFromTab = false,
  tabId,
  isSelectedByTree = false,
  onTreeFocusFromRow,
  isEditing,
  isEditingSubmitting,
  editingName,
  onEditingNameChange,
  onEditingCommit,
  onEditingCancel
}: RowProps) {
  const router    = useRouter();
  const params    = useParams<{ opspaceId: string; dataQueryId?: string }>();
  const opspaceId = params?.opspaceId as string | undefined;
  const dispatch  = useReduxDispatch();

  // Extract stable data from item
  const itemData  = item?.getItemData?.() as TreeNode | undefined;
  const nodeId    = item.getId() as UUIDv7;
  const mountId   = itemData?.mountId as UUIDv7;
  const isFolder  = item.isFolder();
  const level     = (item.getItemMeta().level ?? 0) as number;
  const itemProps = item.getProps();
  const expanded  = item.isExpanded();

  // AIDEV-NOTE: Direct Redux subscription for label - source of truth.
  // This ensures immediate UI update when Redux changes, independent of headless-tree cache.
  // Using inline selector avoids createSelector overhead and directly reads the label.
  const label = useReduxSelector(
    (state) => state.queryTree.nodes[nodeId]?.label
  );
  const itemName = label ?? item.getItemName();

  const isActive  = isSelectedByTree;

  // AIDEV-NOTE: Focused vs. blurred semantics:
  // - Folders: focused when selected AND the tree section reports focus.
  // - Files  : focused when selected AND their tab is the active tab.
  const useFocusedStyle = !isTopLevel && isActive && (isFolder ? !!isTreeFocused : isActiveFromTab);
  const useBlurredStyle = !isTopLevel && isActive && !useFocusedStyle;

  const mergedClassName = useMemo(() =>
    [
      itemProps?.className,
      styles['row'],
      useFocusedStyle && styles['row-selected-focused'],
      useBlurredStyle && styles['row-selected-blurred'],
      isTopLevel && styles['row-top-level']
    ].filter(Boolean).join(' '),
    [itemProps?.className, useFocusedStyle, useBlurredStyle, isTopLevel]
  );

  // AIDEV-NOTE: Indentation scheme: level 0 => indent; each deeper level adds 8px.
  const pad = indent + Math.max(0, level) * 8;
  const finalStyle: React.CSSProperties = { ...itemProps?.style, paddingLeft: `${pad}px` };

  // AIDEV-NOTE: Row click handler — activate or open the corresponding tab for file nodes.
  const handleRowClick = useCallback(async (e: React.MouseEvent) => {
    itemProps?.onClick?.(e);
    onTreeFocusFromRow?.();

    if (isFolder) return;

    if (isActiveFromTab) {
      // AIDEV-NOTE: When the corresponding tab is already active but may be off-screen
      // in the TabBar, bring it back into view without re-triggering navigation.
      if (tabId) {
        try {
          const btn = document.getElementById(`tab-${tabId}`) as HTMLButtonElement | null;
          btn?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
        } catch {}
      }
      return;
    }

    // If tab exists, just activate it and navigate to the saved query.
    if (tabId) {
      await dispatch(setActiveTabThunk(tabId));
      if (mountId && opspaceId) {
        try {
          requestAnimationFrame(() => {
            router.replace(`/opspace/${opspaceId}/queries/${mountId}`);
          });
        } catch {}
      }
      return;
    }

    // No existing tab — open a new one for this saved query
    if (!mountId) {
      logClientJson('error', () => ({
        event   : 'queryTree',
        phase   : 'open-tab-missing-mount-id',
        nodeId  : nodeId
      }));
      return;
    }

    try {
      const newTabId = await dispatch(openTabThunk(mountId)).unwrap();
      if (newTabId && opspaceId) {
        try {
          requestAnimationFrame(() => {
            router.replace(`/opspace/${opspaceId}/queries/${mountId}`);
          });
        } catch {}
      }
    } catch (error) {
      logClientJson('error', () => ({
        event         : 'queryTree',
        phase         : 'open-tab-failed',
        mountId       : mountId,
        errorMessage  : error instanceof Error ? error.message : String(error)
      }));
    }
  }, [itemProps, onTreeFocusFromRow, isFolder, isActiveFromTab, tabId, dispatch, mountId, opspaceId, router]);

  // AIDEV-NOTE: Memoize context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onRename(nodeId);
  }, [onRename, nodeId]);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isEditing) return;
    const el = inputRef.current;
    if (!el) return;

    // AIDEV-NOTE: Focus after paint to avoid headless-tree roving focus stealing focus
    // during the same commit. This makes the input reliably focusable after "New Folder".
    let raf = 0;
    raf = requestAnimationFrame(() => {
      try {
        el.focus();
        el.select();
      } catch {}
    });

    return () => {
      try { cancelAnimationFrame(raf); } catch {}
    };
  }, [isEditing]);

  let nameContent: React.ReactNode;

  if (isEditing && onEditingNameChange && onEditingCommit && onEditingCancel) {
    // AIDEV-NOTE: Inline folder creation UX:
    // - Empty input + Escape or blur => cancel draft (no folder created).
    // - Non-empty input + Enter or blur => commit name and proceed with creation.
    nameContent = (
      <input
        ref={inputRef}
        className={styles['name-input']}
        value={editingName ?? ''}
        autoFocus
        disabled={!!isEditingSubmitting}
        onChange={(e) => onEditingNameChange(e.target.value)}
        onKeyDown={(e) => {
          if (isEditingSubmitting) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            const trimmed = (editingName ?? '').trim();
            if (trimmed) onEditingCommit(trimmed);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            const trimmed = (editingName ?? '').trim();
            if (!trimmed) {
              onEditingCancel();
            }
          }
        }}
        onBlur={() => {
          if (isEditingSubmitting) return;
          const trimmed = (editingName ?? '').trim();
          if (trimmed) {
            onEditingCommit(trimmed);
          } else {
            onEditingCancel();
          }
        }}
      />
    );
  } else {
    nameContent = (
      <span className={styles['name']}>{itemName}</span>
    );
  }

  return (
    <div
      {...(itemProps as any)}
      className={mergedClassName}
      data-row="true"
      style={finalStyle}
      aria-label={isTopLevel ? itemName : undefined}
      onClick={handleRowClick}
      onContextMenu={handleContextMenu}
    >
      {isFolder ? (
        <button
          type="button"
          className={`${styles['type-icon']} ${styles['type-icon-button']}`}
          tabIndex={-1}
          draggable={false}
          aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
          onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onMouseDown={(e) => { e.stopPropagation(); }}
          onClick={(e) => {
            e.stopPropagation();
            expanded ? item.collapse() : item.expand();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              expanded ? item.collapse() : item.expand();
            }
          }}
        >
          {isTopLevel ? (
            expanded ? <Icon name="chevron-down" /> : <Icon name="chevron-right" />
          ) : (
            expanded ? <Icon name="folder-open" /> : <Icon name="folder" />
          )}
        </button>
      ) : (
        <span className={styles['type-icon']} aria-hidden="true">
          <Icon name="file-lines" />
        </span>
      )}
      {nameContent}
    </div>
  );
}


export default memo(Row);
