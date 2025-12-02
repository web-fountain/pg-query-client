'use client';

import type { UUIDv7 } from '@Types/primitives';

import {
  useMemo, useTransition, useEffectEvent
}                       from 'react';
import { useRouter }    from 'next/navigation';

import {
  useReduxDispatch,
  useReduxSelector
}                       from '@Redux/storeHooks';
import {
  focusTabIndex     as focusTabIndexAction,
  selectActiveTabId,
  selectFocusedTabIndex,
  selectTabEntities,
  selectTabIds,
  setActiveTab
}                       from '@Redux/records/tabbar';
import {
  closeTabThunk,
  reorderTabsThunk,
  setActiveTabThunk
}                       from '@Redux/records/tabbar/thunks';
import {
  selectDataQueries
}                       from '@Redux/records/dataQuery';
import { createNewUnsavedDataQueryThunk } from '@Redux/records/dataQuery/thunks';
import { selectNextUntitledName }        from '@Redux/records/unsavedQueryTree';
import { generateUUIDv7 }                from '@Utils/generateId';

import { useOpSpaceRoute } from '../../../_providers/OpSpaceRouteProvider';

import TabBarPresenter    from './TabBarPresenter';


export type Tab = { dataQueryId: UUIDv7; tabId: UUIDv7; name: string };

// AIDEV-NOTE: TabBar container – Redux/router-aware smart component that owns
// all tab-strip behavior (activation, keyboard, add/close, DnD commit) and
// delegates pure rendering to TabBarPresenter.
function TabBar() {
  const { opspaceId, dataQueryId: initialActiveId } = useOpSpaceRoute();

  const router   = useRouter();
  const dispatch = useReduxDispatch();

  const [isPendingTabTransition, startTabTransition] = useTransition();

  const tabIds            = useReduxSelector(selectTabIds) as UUIDv7[];
  const tabEntities       = useReduxSelector(selectTabEntities);
  const activeTabId       = useReduxSelector(selectActiveTabId);
  const focusedTabIndex   = useReduxSelector(selectFocusedTabIndex);
  const dataQueryRecords  = useReduxSelector(selectDataQueries);
  const nextUntitledName  = useReduxSelector(selectNextUntitledName);

  const tabs = useMemo<Tab[]>(() => {
    return tabIds.map((t) => {
      const tab = tabEntities[t];
      const dataQueryId = tab?.mountId;
      const rec = dataQueryId ? dataQueryRecords?.[dataQueryId] : undefined;
      const name = (rec?.current?.name as string) || (rec?.persisted?.name as string) || 'Untitled';
      return { dataQueryId: (dataQueryId || t) as UUIDv7, tabId: t, name };
    });
  }, [tabIds, tabEntities, dataQueryRecords]);

  const handleTabClick = useEffectEvent((tab: Tab) => {
    const { dataQueryId, tabId } = tab;

    const currentUrlDataQueryId = initialActiveId;

    // AIDEV-NOTE: Only sync backend + navigate when the tab's mountId (dataQueryId)
    // differs from the current URL dataQueryId. Pointer-down already keeps
    // local Redux activeTabId in sync for simple highlight.
    const willChangeQuery = dataQueryId !== currentUrlDataQueryId;
    if (!willChangeQuery) return;

    dispatch(setActiveTabThunk(tabId));

    requestAnimationFrame(() => {
      router.replace(`/opspace/${opspaceId}/queries/${dataQueryId}`);
    });
  });

  const handleTabPointerDown = useEffectEvent((tab: Tab) => {
    const { tabId } = tab;
    if (tabId === (activeTabId || null)) return;
    dispatch(setActiveTab({ tabId }));
  });

  const handleTablistKeyDown = useEffectEvent((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (tabIds.length === 0) return;
    const key = e.key;

    if (key === 'ArrowRight') {
      e.preventDefault();
      dispatch(focusTabIndexAction({ index: (focusedTabIndex || 0) + 1 }));
    } else if (key === 'ArrowLeft') {
      e.preventDefault();
      dispatch(focusTabIndexAction({ index: (focusedTabIndex || 0) - 1 }));
    } else if (key === 'Home') {
      e.preventDefault();
      dispatch(focusTabIndexAction({ index: 0 }));
    } else if (key === 'End') {
      e.preventDefault();
      dispatch(focusTabIndexAction({ index: tabIds.length - 1 }));
    } else if (key === 'Enter' || key === ' ') {
      e.preventDefault();

      // Use the focused index to find the corresponding Tab, then reuse
      // the same path as mouse click (handleTabClick).
      const count = tabs.length;
      if (!count) return;

      const rawIndex = focusedTabIndex ?? 0;
      const clampedIndex = (((rawIndex || 0) % count) + count) % count;
      const tab = tabs[clampedIndex];
      if (!tab) return;

      handleTabClick(tab);
    }
  });

  const handleAddTab = useEffectEvent(() => {
    if (isPendingTabTransition) return;

    const dataQueryId = generateUUIDv7();

    dispatch(createNewUnsavedDataQueryThunk({ dataQueryId, name: nextUntitledName }));

    startTabTransition(() => {
      router.replace(`/opspace/${opspaceId}/queries/${dataQueryId}`);
    });
  });

  const handleTabClose = useEffectEvent(async (tabId: UUIDv7) => {
    if (isPendingTabTransition) return;

    try {
      const navigateToDataQueryId = await dispatch(closeTabThunk(tabId)).unwrap();

      startTabTransition(() => {
        if (navigateToDataQueryId) {
          router.replace(`/opspace/${opspaceId}/queries/${navigateToDataQueryId}`);
        } else {
          router.replace(`/opspace/${opspaceId}`);
        }
      });
    } catch (error) {
      console.error('handleTabClose: failed to close tab', { tabId, error });
    }
  });

  const handleReorderTabs = useEffectEvent((nextTabIds: UUIDv7[]) => {
    // AIDEV-NOTE: TabBar DnD commits ordering here; Tabbar reducer remains single
    // source of truth and server is kept in sync via reorderTabsThunk.
    dispatch(reorderTabsThunk(nextTabIds));
  });

  return (
    <TabBarPresenter
      tabs={tabs}
      activeTabId={(activeTabId || '') as string}
      focusedTabIndex={focusedTabIndex ?? 0}
      onTabClick={handleTabClick}
      onPointerDown={handleTabPointerDown}
      onKeyDown={handleTablistKeyDown}
      onAddTab={handleAddTab}
      onCloseTab={handleTabClose}
      onReorderTabs={handleReorderTabs}
    />
  );
}


export default TabBar;
