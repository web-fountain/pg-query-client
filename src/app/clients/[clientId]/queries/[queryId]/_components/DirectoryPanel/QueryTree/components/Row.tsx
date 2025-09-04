'use client';

import type { TreeItemApi, NodePayload, OnRename, OnDropMove } from '../types';

import Icon               from '@Components/Icons';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import styles             from './Row.module.css';


// AIDEV-NOTE: Presentational row; spreads item props once, renders icon and name.
type RowProps = {
  item        : TreeItemApi<NodePayload>;
  indent      : number;
  onRename    : OnRename;
  onDropMove  : OnDropMove;
  onPreToggle?: (id: string) => void;
  isTopLevel?: boolean;
};

function Row({ item, indent, onRename, onDropMove, onPreToggle, isTopLevel: isTopLevelProp }: RowProps) {
  const level     = (item.getItemMeta().level ?? 0) as number;
  const isFolder  = item.isFolder();
  const TOP_LEVEL_IDS = new Set(['queries', 'servers', 'projects_top', 'databases']);
  // AIDEV-NOTE: Merge className/style from library props to preserve its internal state classes
  const itemProps = item.getProps();
  const id        = item.getId();
  const isTopLevel = isTopLevelProp ?? TOP_LEVEL_IDS.has(id);
  const mergedClassName = [
    (itemProps as any)?.className,
    styles['row'],
    isTopLevel ? styles['row-top-level'] : undefined
  ].filter(Boolean).join(' ');
  const mergedStyle = {
    ...(itemProps as any)?.style,
    paddingLeft: level > 0 ? level * indent : 'var(--space-4)'
  } as React.CSSProperties;
  const onClickFromLib = (itemProps as any)?.onClick as (e: React.MouseEvent) => void | undefined;
  // AIDEV-NOTE: Chain library click with fallback toggle. Anchoring handled centrally in QueryTree.
  const handleRowClick = (e: React.MouseEvent) => {
    try { onPreToggle?.(item.getId?.()); } catch {}

    const wasExpanded = item.isExpanded();
    try { onClickFromLib?.(e); } catch {}
    // Defer check to allow library state to settle
    setTimeout(() => {
      const nowExpanded = item.isExpanded();
      if (isFolder && wasExpanded === nowExpanded) {
        try { nowExpanded ? item.collapse() : item.expand(); } catch {}
      }
    }, 0);
  };
  const expanded  = item.isExpanded();
  const dnd       = useDragAndDrop(id, isFolder, onDropMove);

  return (
    <div
      key={id}
      {...itemProps}
      className={mergedClassName}
      style={mergedStyle}
      aria-label={isTopLevel ? item.getItemName() : undefined}
      onClick={handleRowClick}
      draggable
      onDragStart={(e) => {
        document.dispatchEvent(new CustomEvent('qt-drag-start'));
        dnd.onDragStart(e);
      }}
      onDragOver={dnd.onDragOver}
      onDrop={(e) => {
        dnd.onDrop(e);
        document.dispatchEvent(new CustomEvent('qt-drag-end'));
      }}
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
