'use client';

import type { TreeNode }                          from '@Redux/records/queryTree/types';
import type { TreeItemApi, OnRename, OnDropMove } from '../types';

import { useRouter, useParams }                   from 'next/navigation';
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
};

function Row({ item, indent, onRename, onDropMove, isTopLevel: isTopLevelProp, isTreeFocused }: RowProps) {
  const level     = (item.getItemMeta().level ?? 0) as number;
  const isFolder  = item.isFolder();
  const router    = useRouter();
  const params    = useParams<{ opspaceId: string; dataQueryId?: string }>();
  const opspaceId = params?.opspaceId as string | undefined;

  // AIDEV-NOTE: Merge className/style from library props to preserve its internal state classes
  const itemProps = item.getProps();
  // AIDEV-NOTE: Baseline diagnostic — keep library-provided style so headless-tree owns layout.
  const id        = item.getId();
  const isTopLevel = !!isTopLevelProp;
  const ariaSelected = (itemProps as any)?.['aria-selected'] ?? (itemProps as any)?.['ariaSelected'];
  const isSelected = ariaSelected === true || ariaSelected === 'true';
  const mergedClassName = [
    (itemProps as any)?.className,
    styles['row'],
    // AIDEV-NOTE: Top-level folders have no active/selected styling
    (!isTopLevel && isSelected) ? (isTreeFocused ? styles['row-selected-focused'] : styles['row-selected-blurred']) : undefined,
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
    if (isFolder) return;

    const mountId = ((item as any)?.getItemData?.()?.mountId) as string;

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
      title="Right-click to rename. Drag items to move."
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
