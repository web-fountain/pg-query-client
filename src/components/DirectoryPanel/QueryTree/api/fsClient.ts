'use client';

import type { TreeNode } from '@Redux/records/queryTree/types';


// AIDEV-NOTE: Typed fetch helper that throws on non-2xx with enriched context.
async function safeFetchJSON<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    let message = '';
    try { message = await response.text(); } catch {}
    const errorText = message || `Request failed (${response.status})`;
    throw new Error(errorText);
  }
  return response.json() as Promise<T>;
}

// AIDEV-NOTE: Queries
export async function getItem(id: string): Promise<TreeNode> {
  const url = `/api/fs/item?id=${encodeURIComponent(id)}`;
  return safeFetchJSON<TreeNode>(url, { cache: 'no-store' });
}
export type ChildWithData = { id: string; data: TreeNode };
export async function getChildrenWithData(id: string): Promise<ChildWithData[]> {
  const url = `/api/fs/children-with-data?id=${encodeURIComponent(id)}`;
  return safeFetchJSON<ChildWithData[]>(url, { cache: 'no-store' });
}

export async function getParentId(id: string): Promise<string | null> {
  const url = `/api/fs/parent?id=${encodeURIComponent(id)}`;
  const payload = await safeFetchJSON<{ parentId?: string | null }>(url, { cache: 'no-store' });
  return payload.parentId ?? null;
}

// AIDEV-NOTE: Mutations
export async function createFolder(parentId: string, name: string): Promise<{ ok: true; id: string }> {
  return safeFetchJSON<{ ok: true; id: string }>(
    '/api/fs/create-folder',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId, name })
    }
  );
}

export async function createQueryFile(parentId: string, name: string): Promise<{ ok: true; id: string }> {
  return safeFetchJSON<{ ok: true; id: string }>(
    '/api/fs/create-query',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId, name })
    }
  );
}

export async function renameItem(id: string, name: string): Promise<{ ok: true; parentId: string | null }> {
  return safeFetchJSON<{ ok: true; parentId: string | null }>(
    '/api/fs/rename',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name })
    }
  );
}

export async function moveItem(id: string, newParentId: string): Promise<{ ok: true; oldParentId?: string | null; newParentId?: string }> {
  return safeFetchJSON<{ ok: true; oldParentId?: string | null; newParentId?: string }>(
    '/api/fs/move',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, newParentId })
    }
  );
}

// AIDEV-QUESTION: If server errors include machine-readable codes, consider returning a discriminated union.
