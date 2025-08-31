'use client';

import { useMemo, useEffect, useState } from 'react';
import { useTree }                      from '@headless-tree/react';
import {
  asyncDataLoaderFeature,
  selectionFeature,
  hotkeysCoreFeature
}                                       from '@headless-tree/core';

import Icon                             from '@Components/Icons';
import styles                           from './styles.module.css';

// AIDEV-NOTE: Minimal node payload used by the async data loader.
export type NodePayload = {
  id: string;
  kind: 'folder' | 'query';
  name: string;
  tags?: string[];
  level?: number;
};

async function fetchItem(id: string): Promise<NodePayload> {
  const res = await fetch(`/api/fs/item?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load item');
  return res.json();
}

async function fetchChildrenIds(id: string): Promise<string[]> {
  const res = await fetch(`/api/fs/children?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load children');
  return res.json();
}

async function fetchParentId(id: string): Promise<string | null> {
  const res = await fetch(`/api/fs/parent?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const j = await res.json();
  return j.parentId ?? null;
}

type RowProps = {
  item: any;
  data: NodePayload;
  indent: number;
  onRename: (id: string) => void;
  onDropMove: (dragId: string, dropTargetId: string, isTargetFolder: boolean) => void;
};

function Row({ item, data, indent, onRename, onDropMove }: RowProps) {
  const level = item.getItemMeta().level as number;
  if (!data) return null as any;
  const isFolder = data.kind === 'folder';
  const expanded = !!item.getItemMeta()?.expanded;
  const id = item.getId();

  // AIDEV-NOTE: DnD rules — dropping on files means move beside it (into its parent).
  return (
    <div
      key={id}
      {...item.getProps()}
      className={styles['row']}
      style={{ paddingLeft: level * indent }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        const dragId = e.dataTransfer.getData('text/plain');
        if (!dragId || dragId === id) return;
        onDropMove(dragId, id, isFolder);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onRename(id);
      }}
      title="Right-click to rename. Drag items to move."
    >
      <button
        type="button"
        aria-label={expanded ? 'Collapse' : 'Expand'}
        onClick={(e) => {
          e.stopPropagation();
          expanded ? item.collapse() : item.expand();
        }}
        className={styles['toggle']}
        tabIndex={-1}
      >
        {isFolder ? (
          expanded ? <Icon name="chevron-down" aria-hidden="true" /> : <Icon name="chevron-right" aria-hidden="true" />
        ) : (
          <span className={styles['spacer']} />
        )}
      </button>

      <span className={styles['type-icon']} aria-hidden="true">
        {isFolder ? (
          expanded ? <Icon name="folder-open" /> : <Icon name="folder" />
        ) : (
          <Icon name="file-lines" />
        )}
      </span>

      <span className={styles['name']}>{data.name}</span>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRename(id);
        }}
        className={styles['action']}
        aria-label="Rename"
        title="Rename"
      >
        <Icon name="ellipsis-horizontal" aria-hidden="true" />
      </button>
    </div>
  );
}

function QueryTree({ rootId, indent = 16 }: { rootId: string; indent?: number }) {
  // AIDEV-NOTE: Local cache avoids triggering async loads during render in getItemName/isItemFolder.
  // AIDEV-NOTE: nodeCache decouples Headless Tree's render pass from async IO
  // so we never call setState during render (which caused regressions earlier).
  const [nodeCache, setNodeCache] = useState<Record<string, NodePayload>>({});
  // AIDEV-NOTE: Tree instance with async data loader. Selection and hotkeys are enabled for accessibility.
  // AIDEV-NOTE: Headless Tree instance. We rely on container/item props for a11y & hotkeys.
  const tree = useTree<NodePayload>({
    rootItemId: rootId,
    indent,
    getItemName: (item) => nodeCache[item.getId()]?.name ?? '',
    isItemFolder: (item) => (nodeCache[item.getId()]?.kind === 'folder'),
    dataLoader: {
      getItem: async (id) => await fetchItem(id),
      getChildren: async (id) => await fetchChildrenIds(id)
    },
    features: [asyncDataLoaderFeature, selectionFeature, hotkeysCoreFeature]
  });

  const targetFolderId = useMemo(() => rootId, [rootId]);

  // AIDEV-NOTE: Ensure root children are loaded on mount so the invisible root shows its first-level rows.
  // AIDEV-NOTE: Bootstrap root: prefetch children + hydrate cache, then ask tree to load ids.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ids = await fetchChildrenIds(rootId);
        if (!mounted) return;
        const items = await Promise.all(ids.map((id) => fetchItem(id).catch(() => null)));
        const map: Record<string, NodePayload> = {};
        for (const it of items) if (it) map[it.id] = it;
        if (mounted) setNodeCache(map);
      } catch {}
      tree.loadChildrenIds(rootId);
    })();
    return () => { mounted = false; };
  }, [tree, rootId]);

  // AIDEV-NOTE: Toolbar actions target the current folder (root for now) and refresh only that parent.
  async function handleCreateFolder() {
    const res = await fetch('/api/fs/create-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: targetFolderId, name: 'New Folder' })
    });
    if (res.ok) tree.loadChildrenIds(targetFolderId);
    else if (typeof window !== 'undefined') {
      const msg = await res.text();
      window.alert(msg || 'Create folder failed');
    }
  }

  // AIDEV-NOTE: Ensure any visible items have data in nodeCache (e.g., after expanding a folder).
  // AIDEV-NOTE: As folders expand, prefetch any newly visible items into cache.
  const visibleIds = (function collectIds() {
    try { return (tree.getItems() as any[]).map((it: any) => it.getId()); } catch { return []; }
  })();
  useEffect(() => {
    let mounted = true;
    const missing = visibleIds.filter((id) => !nodeCache[id]);
    if (!missing.length) return;
    (async () => {
      const items = await Promise.all(missing.map((id) => fetchItem(id).catch(() => null)));
      if (!mounted) return;
      setNodeCache((prev) => {
        const next = { ...prev } as Record<string, NodePayload>;
        for (const it of items) if (it) next[it.id] = it as NodePayload;
        return next;
      });
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds.join('|')]);

  async function handleCreateFile() {
    const res = await fetch('/api/fs/create-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: targetFolderId, name: 'new-query.sql' })
    });
    if (res.ok) tree.loadChildrenIds(targetFolderId);
    else if (typeof window !== 'undefined') {
      const msg = await res.text();
      window.alert(msg || 'Create file failed');
    }
  }

  // AIDEV-NOTE: For now, actions target the invisible root (level 0). Disable New Folder if cap reached.
  const maxDepth = 4;
  const targetLevel = 0; // root
  const disableNewFolder = targetLevel + 1 > maxDepth - 0; // would create level 1, cap is 4

  return (
    <section className={styles['tree']} aria-label="Queries">
      <header className={styles['toolbar']}>
        <button
          type="button"
          className={styles['tool']}
          onClick={handleCreateFolder}
          title="New Folder"
          disabled={disableNewFolder}
        >
          <Icon name="folder" aria-hidden="true" />
          <span>New Folder</span>
        </button>
        <button type="button" className={styles['tool']} onClick={handleCreateFile} title="New File">
          <Icon name="file-plus" aria-hidden="true" />
          <span>New File</span>
        </button>
      </header>

      <div {...tree.getContainerProps('Queries Tree')} className={styles['list']}>
        {tree.getItems().map((item: any) => {
          const id = item.getId();
          const data = nodeCache[id];
          if (!data) return null;
          return (
            <Row
              key={id}
              item={item}
              data={data}
              indent={indent}
            onRename={async (id) => {
              const current = item.getItemName();
              const next = typeof window !== 'undefined' ? window.prompt('Rename to:', current) : null;
              if (!next || next === current) return;
              const res = await fetch('/api/fs/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name: next })
              });
              if (res.ok) {
                const { parentId } = await res.json();
                if (parentId) tree.loadChildrenIds(parentId);
              } else {
                const msg = await res.text();
                if (typeof window !== 'undefined') window.alert(msg || 'Rename failed');
              }
            }}
            onDropMove={async (dragId, dropTargetId, isTargetFolder) => {
              let parentId: string | null = null;
              if (isTargetFolder) parentId = dropTargetId;
              else parentId = await fetchParentId(dropTargetId);
              if (!parentId) return;
              const res = await fetch('/api/fs/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: dragId, newParentId: parentId })
              });
              if (res.ok) {
                const { oldParentId, newParentId } = await res.json();
                if (oldParentId) tree.loadChildrenIds(oldParentId);
                if (newParentId) tree.loadChildrenIds(newParentId);
              } else {
                const msg = await res.text();
                if (typeof window !== 'undefined') window.alert(msg || 'Move failed');
              }
            }}
            />
          );
        })}
      </div>
    </section>
  );
}


export default QueryTree;
