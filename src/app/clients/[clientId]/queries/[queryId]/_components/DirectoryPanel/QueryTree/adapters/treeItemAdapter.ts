import { NodePayload, TreeItemApi } from '../types';

// AIDEV-NOTE: Adapter functions that translate NodePayload and item API into the
// shapes expected by Headless Tree configuration points. These are pure functions.

export function getItemName(item: TreeItemApi<NodePayload>): string {
  const data = item.getItemData();
  return (data && data.name) ? data.name : item.getId();
}

export function isItemFolder(item: TreeItemApi<NodePayload>): boolean {
  return item.getItemData()?.kind === 'folder';
}

export function createLoadingItemData(): NodePayload {
  return { id: 'loading', kind: 'folder', name: 'Loading…' } as NodePayload;
}
