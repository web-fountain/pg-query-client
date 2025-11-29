'use client';

import type { TreeNode }                          from '@Redux/records/queryTree/types';
import type { UUIDv7 }                            from '@Types/primitives';
import type { TreeItemApi, OnRename, OnDropMove } from '../types';

import { memo }                                   from 'react';
import { useRouter, useParams }                   from 'next/navigation';
import { useReduxDispatch, useReduxSelector }     from '@Redux/storeHooks';
import { selectTabIdByMountId, selectActiveTabId } from '@Redux/records/tabbar';
import { setActiveTabThunk }                      from '@Redux/records/tabbar/thunks';
import Icon                                       from '@Components/Icons';
import styles                                     from './Row.module.css';


// AIDEV-NOTE: Presentational row; spreads item props once, renders icon and name.
type RowProps = {
  item        : TreeItemApi<TreeNode>;
  indent      : number;
  onRename    : OnRename;
  onDropMove  : OnDropMove;
  isTopLevel?: boolean;
  isTreeFocused?: boolean;
  onTreeFocusFromRow?: () => void;
};

function Row({ item, indent, onRename, onDropMove, isTopLevel: isTopLevelProp, isTreeFocused, onTreeFocusFromRow }: RowProps) {
  const level     = (item.getItemMeta().level ?? 0) as number;
  const isFolder  = item.isFolder();
  const router    = useRouter();
  const params    = useParams<{ opspaceId: string; dataQueryId?: string }>();
  const opspaceId = params?.opspaceId as string | undefined;
  const dispatch  = useReduxDispatch();

  // AIDEV-NOTE: Get mountId at top level for selector usage
  const itemData  = item?.getItemData?.() as TreeNode | undefined;
  const mountId   = itemData?.mountId as UUIDv7;
  const tabId     = useReduxSelector(selectTabIdByMountId, mountId) as UUIDv7;
  const activeTabId = useReduxSelector(selectActiveTabId) as UUIDv7 | null;

  // AIDEV-NOTE: Merge className/style from library props to preserve its internal state classes
  const id                = item.getId();
  const itemProps         = item.getProps();
  const isTopLevel        = !!isTopLevelProp;
  const ariaSelected      = (itemProps as any)?.['aria-selected'] ?? (itemProps as any)?.['ariaSelected'];
  const isSelectedByTree  = ariaSelected === true || ariaSelected === 'true';
  const isActive          = isSelectedByTree;

  // AIDEV-NOTE: For file nodes, "focused" means:
  //   - this row is the tree's selected item, and
  //   - its tab is the globally active tab (activeTabId).
  // When another tab becomes active, the row remains selected but is shown
  // with the dimmed (blurred) style instead.
  const isFileActiveFromTab =
    !isFolder && !!tabId && !!activeTabId && tabId === activeTabId;

  // AIDEV-NOTE: Focused vs. blurred semantics:
  // - Folders: focused when selected AND the tree section reports focus.
  // - Files  : focused when selected AND their tab is the active tab.
  //   In both cases, a selected row that does not meet the focused criteria
  //   is rendered with the dimmed style instead.
  const useFocusedStyle =
    !isTopLevel &&
    isActive &&
    (isFolder ? !!isTreeFocused : isFileActiveFromTab);

  const useBlurredStyle =
    !isTopLevel &&
    isActive &&
    !useFocusedStyle;

  const mergedClassName = [
    (itemProps as any)?.className,
    styles['row'],
    useFocusedStyle ? styles['row-selected-focused'] : undefined,
    useBlurredStyle ? styles['row-selected-blurred'] : undefined,
    isTopLevel ? styles['row-top-level'] : undefined
  ].filter(Boolean).join(' ');
  const mergedStyle = (itemProps as any)?.style as React.CSSProperties | undefined;
  // AIDEV-NOTE: Indentation scheme: level 0 => indent; each deeper level adds 8px.
  const finalStyle: React.CSSProperties | undefined = (() => {
    const baseIndent = indent;
    const perLevel = 8;
    const pad = baseIndent + Math.max(0, level) * perLevel;
    return { ...(mergedStyle || {}), paddingLeft: `${pad}px` };
  })();

  // AIDEV-NOTE: Row click selects/focuses; for files with a valid mountId, navigate to open the query tab.
  const handleRowClick = (e: React.MouseEvent) => {
    try {
      itemProps?.onClick?.(e);
    } catch {}

    // Explicitly mark this tree section as focused when the user interacts
    // with a row, in case DOM focus did not change in a way that our
    // container onFocus/onBlur handlers can detect.
    try {
      onTreeFocusFromRow?.();
    } catch {}

    if (isFolder) return;

    // If this row's tab is already the active tab, avoid redundant dispatch + navigation.
    const isAlreadyActiveFileRow = !isFolder && !!tabId && !!activeTabId && tabId === activeTabId;
    if (isAlreadyActiveFileRow) return;

    dispatch(setActiveTabThunk(tabId));

    // AIDEV-NOTE: Defer one frame so selected styling paints before route remount.
    try {
      requestAnimationFrame(() => {
        router.replace(`/opspace/${opspaceId}/queries/${mountId}`);
      });
    } catch {}
  };

  const expanded  = item.isExpanded();

  return (
    <div
      key={id}
      {...(itemProps as any)}
      className={mergedClassName}
      data-row="true"
      style={finalStyle}
      aria-label={isTopLevel ? item.getItemName() : undefined}
      onClick={handleRowClick}
      /* AIDEV-NOTE: DnD handled by headless-tree dragAndDropFeature; no row-level HTML5 DnD. */
      onContextMenu={(e) => {
        e.preventDefault();
        onRename(id);
      }}
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

      <span className={styles['name']}>{item.getItemName()}</span>
    </div>
  );
}


export default Row;
