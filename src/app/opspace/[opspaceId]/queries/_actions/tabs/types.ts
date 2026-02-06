import type { Tab, Tabbar } from '@Types/tabs';


// AIDEV-NOTE: Backend API response shapes for tab server actions.
export type ListOpenTabsApiResponse =
  | { ok: false }
  | { ok: true; data: Tabbar };

export type OpenTabApiResponse =
  | { ok: false }
  | { ok: true; data: Tab };

export type SetTabDataSourceCredentialApiResponse =
  | { ok: false }
  | { ok: true; data: Tab };

export type ReorderTabs = {
  from: number;
  to: number;
};

export type ReorderTabsApiResponse =
  | { ok: false }
  | { ok: true; data: ReorderTabs };
