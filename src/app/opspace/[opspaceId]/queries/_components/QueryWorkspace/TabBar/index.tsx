'use client';

import type { UUIDv7 }                        from '@Types/primitives';

import {
  useMemo, useTransition, useEffectEvent,
  useRef
}                                             from 'react';
import { useRouter }                          from 'next/navigation';

import { useReduxDispatch, useReduxSelector } from '@Redux/storeHooks';
import {
  focusTabIndex     as focusTabIndexAction,
  selectActiveTabId,
  selectFocusedTabIndex,
  selectTabEntities,
  selectTabIds,
  setActiveTab
}                                             from '@Redux/records/tabbar';
import { closeTabThunk, reorderTabsThunk }    from '@Redux/records/tabbar/thunks';
import { selectDataQueries }                  from '@Redux/records/dataQuery';
import { createNewUnsavedDataQueryThunk }     from '@Redux/records/dataQuery/thunks';
import {
  selectNextUntitledName,
  selectUnsavedQueryTree
}                                             from '@Redux/records/unsavedQueryTree';
import { generateUUIDv7 }                     from '@Utils/generateId';
import { logClientJson }                      from '@Observability/client';

import { useQueriesRoute }                    from '../../../_providers/QueriesRouteProvider';

import { useActivateTab }                     from '../hooks/useActivateTab';
import TabBarPresenter                        from './TabBarPresenter';


export type Tab = { tabId: UUIDv7; name: string };

// AIDEV-NOTE: Redux/router-aware TabBar container. Owns tab-strip behavior and delegates rendering to TabBarPresenter.
function TabBar() {
  const { opspaceId, routeMode, navigateToNew }  = useQueriesRoute();
  const router                        = useRouter();
  const [, startTabTransition]        = useTransition();
  const tabIds                        = useReduxSelector(selectTabIds) as UUIDv7[];
  const tabEntities                   = useReduxSelector(selectTabEntities);
  const activeTabId                   = useReduxSelector(selectActiveTabId) as UUIDv7 | null;
  const focusedTabIndex               = useReduxSelector(selectFocusedTabIndex) as number | null;
  const dataQueryRecords              = useReduxSelector(selectDataQueries);
  const unsavedQueryTree              = useReduxSelector(selectUnsavedQueryTree);
  const nextUntitledName              = useReduxSelector(selectNextUntitledName) as string;
  const dispatch                      = useReduxDispatch();

  const activateTab                   = useActivateTab();
  // pointerdown optimistically sets active tab in Redux; click runs the thunk (backend + routing).
  // Track which tabId was switched to via pointerdown so we can treat "click active tab" as a no-op unless it was just activated.
  const pendingPointerActivateRef     = useRef<UUIDv7 | null>(null);
  // Guard against double fire for add/close while their thunks are in flight.
  const closingTabIdRef               = useRef<UUIDv7 | null>(null);
  const isAddingRef                   = useRef(false);

  const tabs = useMemo<Tab[]>(() => {
    return tabIds.map((tabId) => {
      const tab         = tabEntities[tabId];
      const mountId     = tab?.mountId;
      const rec         = mountId ? dataQueryRecords?.[mountId] : undefined;
      const name        = (rec?.current?.name as string) || (rec?.persisted?.name as string) || 'Untitled';
      return {
        tabId,
        name
      };
    });
  }, [tabIds, tabEntities, dataQueryRecords]);

  const handleTabClick = useEffectEvent((tab: Tab) => {
    const { tabId } = tab;

    const pendingId = pendingPointerActivateRef.current;
    pendingPointerActivateRef.current = null;

    // AIDEV-NOTE: No-op clicks on the active tab, unless pointerdown just switched to it
    // (so we still run the thunk + routing). However, if the route is out-of-sync with
    // the tab type (e.g. unsaved tab active while on /queries/{id}), we must realign.
    if (tabId === activeTabId && pendingId !== tabId) {
      let isUnsavedTab = false;
      try {
        const node = (unsavedQueryTree.nodes as any)?.[String(tabId)];
        isUnsavedTab = !!node && node.kind === 'file';
      } catch {}

      const shouldRealign =
        (isUnsavedTab && routeMode !== 'new')
        || (!isUnsavedTab && routeMode !== 'saved');

      if (!shouldRealign) {
        return;
      }
    }

    activateTab(tabId);
  });

  const handleTabPointerDown = useEffectEvent((tab: Tab) => {
    const { tabId } = tab;

    if (tabId === (activeTabId || null)) {
      pendingPointerActivateRef.current = null;
      return;
    }

    pendingPointerActivateRef.current = tabId;
    try {
      dispatch(setActiveTab({ tabId }));
    } catch (error) {
      logClientJson('error', () => ({
        event         : 'tabbar',
        phase         : 'pointerdown-set-active-tab-failed',
        tabId         : tabId,
        activeTabId   : activeTabId,
        errorMessage  : error instanceof Error ? error.message : String(error)
      }));
    }
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

      const count = tabs.length;
      if (!count) return;

      const rawIndex = focusedTabIndex ?? 0;
      const clampedIndex = (((rawIndex || 0) % count) + count) % count;
      const tab = tabs[clampedIndex];
      if (!tab) return;

      handleTabClick(tab);
    }
  });

  const handleAddTab = useEffectEvent(async () => {
    if (isAddingRef.current) return;

    isAddingRef.current = true;

    const dataQueryId = generateUUIDv7();

    try {
      await dispatch(createNewUnsavedDataQueryThunk({ dataQueryId, name: nextUntitledName }));

      startTabTransition(() => {
        navigateToNew();
      });
    } catch (error) {
      logClientJson('error', () => ({
        event         : 'tabbar',
        phase         : 'add-tab-failed',
        dataQueryId   : dataQueryId,
        errorMessage  : error instanceof Error ? error.message : String(error)
      }));
    } finally {
      isAddingRef.current = false;
    }
  });

  const handleTabClose = useEffectEvent(async (tabId: UUIDv7) => {
    if (closingTabIdRef.current === tabId) return;

    closingTabIdRef.current = tabId;

    try {
      const result = await dispatch(closeTabThunk(tabId)).unwrap();

      startTabTransition(() => {
        if (!result.hasRemainingTabs) {
          router.replace(`/opspace/${opspaceId}`);
        } else if (result.nextTabIsUnsaved) {
          navigateToNew();
        } else if (result.nextDataQueryId) {
          router.replace(`/opspace/${opspaceId}/queries/${result.nextDataQueryId}`);
        }
      });
    } catch (error) {
      logClientJson('error', () => ({
        event         : 'tabbar',
        phase         : 'close-tab-failed',
        tabId         : tabId,
        errorMessage  : error instanceof Error ? error.message : String(error)
      }));
    } finally {
      if (closingTabIdRef.current === tabId) {
        closingTabIdRef.current = null;
      }
    }
  });

  const handleReorderTabs = useEffectEvent((nextTabIds: UUIDv7[]) => {
    // AIDEV-NOTE: DnD emits the full order; commit it to Redux and sync the backend.
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
