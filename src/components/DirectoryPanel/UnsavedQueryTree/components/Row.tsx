'use client';

import type { TreeNode }                          from '@Redux/records/queryTree/types';
import type { TreeItemApi, OnRename, OnDropMove } from '../types';
import type { UUIDv7 }                            from '@Types/primitives';

import { memo }                                   from 'react';
import { useRouter, useParams }                   from 'next/navigation';
import { useReduxDispatch }                       from '@Redux/storeHooks';
import { setActiveTabThunk, closeTabThunk }       from '@Redux/records/tabbar/thunks';
import Icon                                       from '@Components/Icons';
import styles                                     from './Row.module.css';


// AIDEV-NOTE: Presentational row; spreads item props once, renders icon and name.
type RowProps = {
  item            : TreeItemApi<TreeNode>;
  indent          : number;
  onRename        : OnRename;
  onDropMove      : OnDropMove;
  isTopLevel?     : boolean;
  isTreeFocused?  : boolean;
  isActiveFromTab?: boolean;
};

function Row({ item, indent, onRename, onDropMove, isTopLevel: isTopLevelProp, isTreeFocused, isActiveFromTab }: RowProps) {
  const level     = (item.getItemMeta().level ?? 0) as number;
  const isFolder  = item.isFolder();
  const router    = useRouter();
  const params    = useParams<{ opspaceId: string; dataQueryId?: string }>();
  const opspaceId = params?.opspaceId as string | undefined;
  const dispatch  = useReduxDispatch();

  // AIDEV-NOTE: Merge className/style from library props to preserve its internal state classes
  const itemProps = item.getProps();
  const id        = item.getId();
  const isTopLevel = !!isTopLevelProp;
  const ariaSelected = (itemProps as any)?.['aria-selected'] ?? (itemProps as any)?.['ariaSelected'];
  const isSelectedByTree = ariaSelected === true || ariaSelected === 'true';
  const isActive = isFolder ? isSelectedByTree : !!isActiveFromTab;
  const mergedClassName = [
    (itemProps as any)?.className,
    styles['row'],
    // AIDEV-NOTE: Top-level folders have no active/selected styling
    (!isTopLevel && isActive) ? (isTreeFocused ? styles['row-selected-focused'] : styles['row-selected-blurred']) : undefined,
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

  // AIDEV-NOTE: Row click selects/focuses; for files with a valid mountId, sync tabbar and navigate to open the query tab.
  const handleRowClick = (e: React.MouseEvent) => {
    try {
      itemProps?.onClick?.(e);
    } catch {}
    if (isFolder) return;

    // AIDEV-NOTE: When this row already reflects the focused tab, avoid redundant tab activation + navigation.
    if (isActiveFromTab) return;

    const { mountId, nodeId } = item?.getItemData?.() as TreeNode;

    dispatch(setActiveTabThunk(nodeId));

    // AIDEV-NOTE: Defer one frame so selected styling paints before route remount.
    try {
      requestAnimationFrame(() => {
        router.replace(`/opspace/${opspaceId}/queries/${mountId}`);
      });
    } catch {}
  };

  const handleCloseQuery = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    const data = item?.getItemData?.() as TreeNode | undefined;
    if (!data) {
      return;
    }

    const tabId = data.nodeId as UUIDv7;

    try {
      const navigateToTabId = await dispatch(closeTabThunk(tabId)).unwrap();

      requestAnimationFrame(() => {
        if (navigateToTabId) {
          router.replace(`/opspace/${opspaceId}/queries/${navigateToTabId}`);
        } else if (opspaceId) {
          router.replace(`/opspace/${opspaceId}`);
        }
      });
    } catch (error) {
      console.error('handleCloseQuery: failed to close unsaved query tab', { tabId, error });
    }
  };

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
        <span
          className={styles['type-icon']}
          aria-hidden="true"
        >
          <Icon name="folder-open" />
        </span>
      ) : (
        <span className={styles['type-icon']}>
          <span className={styles['type-icon-default']} aria-hidden="true">
            <Icon name="file-lines" />
          </span>
          <button
            type="button"
            className={styles['type-icon-button']}
            onClick={handleCloseQuery}
            aria-label="Close unsaved query"
          >
            <span aria-hidden="true">
              <Icon name="x" />
            </span>
          </button>
        </span>
      )}

      <span className={styles['name']}>{item.getItemName()}</span>
    </div>
  );
}


export default memo(Row);
