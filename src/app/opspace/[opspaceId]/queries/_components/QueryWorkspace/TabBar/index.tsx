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
import { selectNextUntitledName }             from '@Redux/records/unsavedQueryTree';
import { generateUUIDv7 }                     from '@Utils/generateId';

import { useOpSpaceRoute }                    from '../../../_providers/OpSpaceRouteProvider';

import { useActivateTab }                     from '../hooks/useActivateTab';
import TabBarPresenter                        from './TabBarPresenter';


export type Tab = { dataQueryId: UUIDv7; tabId: UUIDv7; name: string };

// AIDEV-NOTE: Redux/router-aware TabBar container. Owns tab-strip behavior and delegates rendering to TabBarPresenter.
function TabBar() {
  const { opspaceId, navigateToNew } = useOpSpaceRoute();

  const router   = useRouter();
  const dispatch = useReduxDispatch();

  const [, startTabTransition] = useTransition();

  const tabIds            = useReduxSelector(selectTabIds) as UUIDv7[];
  const tabEntities       = useReduxSelector(selectTabEntities);
  const activeTabId       = useReduxSelector(selectActiveTabId);
  const focusedTabIndex   = useReduxSelector(selectFocusedTabIndex);
  const dataQueryRecords  = useReduxSelector(selectDataQueries);
  const nextUntitledName  = useReduxSelector(selectNextUntitledName);

  const activateTab       = useActivateTab();

  // AIDEV-NOTE: pointerdown optimistically sets active tab in Redux; click runs the thunk (backend + routing).
  // Track which tabId was switched to via pointerdown so we can treat "click active tab" as a no-op unless it was just activated.
  const pendingPointerActivateRef = useRef<UUIDv7 | null>(null);
  // AIDEV-NOTE: Guard against double fire for add/close while their thunks are in flight.
  const closingTabIdRef           = useRef<UUIDv7 | null>(null);
  const isAddingRef               = useRef(false);

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

    const pendingId = pendingPointerActivateRef.current;
    pendingPointerActivateRef.current = null;

    // AIDEV-NOTE: No-op clicks on the active tab, unless pointerdown just switched to it (so we still run the thunk + routing).
    if (tabId === activeTabId && pendingId !== tabId) {
      return;
    }

    activateTab({ tabId, dataQueryId });
  });

  const handleTabPointerDown = useEffectEvent((tab: Tab) => {
    const { tabId } = tab;

    if (tabId === (activeTabId || null)) {
      pendingPointerActivateRef.current = null;
      return;
    }

    pendingPointerActivateRef.current = tabId;
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
      console.error('handleAddTab: failed to create new unsaved tab', { dataQueryId, error });
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
      console.error('handleTabClose: failed to close tab', { tabId, error });
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
