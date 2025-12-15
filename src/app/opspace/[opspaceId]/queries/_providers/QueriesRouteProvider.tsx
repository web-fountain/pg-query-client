'use client';

import type { ReactNode }                     from 'react';
import type { Base64Url22, UUIDv7 }           from '@Types/primitives';

import {
  createContext, useContext, useEffect,
  useEffectEvent, useRef, useState
}                                             from 'react';
import { usePathname, useRouter }             from 'next/navigation';

import { useReduxDispatch, useReduxSelector } from '@Redux/storeHooks';
import {
  selectActiveTabId,
  selectDataQueryIdForTabId,
  selectLastActiveUnsavedTabId,
  selectTabIdByMountIdMap
}                                             from '@Redux/records/tabbar';
import { setActiveTabThunk }                  from '@Redux/records/tabbar/thunks';
import { selectUnsavedQueryTree }             from '@Redux/records/unsavedQueryTree';


type RouteMode = 'saved' | 'new';

type QueriesRouteContextValue = {
  opspaceId  : Base64Url22;
  routeMode  : RouteMode;
  dataQueryId: UUIDv7 | null;  // saved id or active unsaved mountId
  navigateToSaved: (dataQueryId: UUIDv7) => void;
  navigateToNew  : () => void;
};

type HistoryStateShape = {
  OPSPACE_ROUTE?: {
    opspaceId  : Base64Url22;
    routeMode  : RouteMode;
    dataQueryId?: UUIDv7;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

const QueriesRouteCtx = createContext<QueriesRouteContextValue | null>(null);

function QueriesRouteProvider({ opspaceId, children }: { opspaceId: Base64Url22; children: ReactNode }) {
  const pathname  = usePathname() || '';
  const router    = useRouter();
  const dispatch  = useReduxDispatch();
  const hasAlignedInitialRef = useRef(false);

  const routeMode: RouteMode = pathname.endsWith('/new') ? 'new' : 'saved';

  const activeTabId               = useReduxSelector(selectActiveTabId);
  const activeDataQueryIdFromTabs = useReduxSelector(selectDataQueryIdForTabId, (activeTabId || null) as UUIDv7 | null);
  const lastActiveUnsavedTabId    = useReduxSelector(selectLastActiveUnsavedTabId);
  const tabIdByMountIdMap         = useReduxSelector(selectTabIdByMountIdMap);
  const unsavedQueryTree          = useReduxSelector(selectUnsavedQueryTree);

  // Derive dataQueryId:
  // - saved: from URL or active tab
  // - new  : from the last active unsaved tab (via tab → mountId)
  const [dataQueryId, setDataQueryId] = useState<UUIDv7 | null>(null);

  useEffect(() => {
    if (routeMode === 'saved') {
      // from URL: /opspace/{id}/queries/{dataQueryId}
      const segments = pathname.split('/').filter(Boolean);
      const idx = segments.indexOf('queries') + 1;
      const slug = idx > 0 && idx < segments.length ? segments[idx] : null;
      if (slug && slug !== 'new') {
        setDataQueryId(slug as UUIDv7);
      } else if (activeDataQueryIdFromTabs) {
        setDataQueryId(activeDataQueryIdFromTabs as UUIDv7);
      }
    } else {
      // new route: derive from active unsaved tab (via Redux field)
      if (activeDataQueryIdFromTabs) {
        setDataQueryId(activeDataQueryIdFromTabs as UUIDv7);
      } else {
        setDataQueryId(null);
      }
    }
  }, [routeMode, pathname, activeDataQueryIdFromTabs]);

  const buildSavedUrl = (id: UUIDv7) =>
    `/opspace/${opspaceId}/queries/${id}`;
  const buildNewUrl = () =>
    `/opspace/${opspaceId}/queries/new`;

  const navigateToSaved = useEffectEvent((id: UUIDv7) => {
    const url = buildSavedUrl(id);
    // AIDEV-NOTE: Let Next.js own the actual navigation/history entry creation.
    // We attach OPSPACE_ROUTE metadata in a separate effect via replaceState,
    // which merges with Next's internal history state without fighting it.
    router.push(url as any);
  });

  const navigateToNew = useEffectEvent(() => {
    const url = buildNewUrl();
    if (!pathname.endsWith('/new')) {
      router.replace(url as any);
    }
  });

  // AIDEV-NOTE: Initial alignment – on first load, align Redux active tab to URL
  // or lastActiveUnsavedTabId. For saved routes, the URL's dataQueryId is the
  // source of truth; if the currently active tab does not map to that id (e.g.,
  // stale bootstrap state from cached tabs-open:list), we realign Redux so the
  // correct tab is active.
  //
  // We intentionally wait until we have both:
  //   1) dataQueryId parsed from the URL, and
  //   2) a corresponding tabIdForRoute in tabIdByMountIdMap.
  // Only then do we mark alignment complete. This avoids freezing alignment in
  // an incomplete state during hydration/concurrent rendering.
  useEffect(() => {
    if (hasAlignedInitialRef.current) return;

    if (routeMode === 'saved') {
      // Wait until we know the URL id.
      if (!dataQueryId) return;

      const tabIdForRoute = tabIdByMountIdMap.get(dataQueryId);

      // Wait until we can see a tab for that id (entities may still be hydrating).
      if (!tabIdForRoute) return;

      const activeMountId = activeDataQueryIdFromTabs;

      // If already aligned, mark complete and exit.
      if (activeMountId === dataQueryId) {
        hasAlignedInitialRef.current = true;
        return;
      }

      // Realign Redux to match the URL.
      void dispatch(setActiveTabThunk(tabIdForRoute));
      hasAlignedInitialRef.current = true;
      return;
    }

    // routeMode === 'new' – prefer lastActiveUnsavedTabId from backend/Redux
    if (routeMode === 'new') {
      if (lastActiveUnsavedTabId) {
        void dispatch(setActiveTabThunk(lastActiveUnsavedTabId));
      }
      hasAlignedInitialRef.current = true;
    }
  }, [routeMode, dataQueryId, activeDataQueryIdFromTabs, lastActiveUnsavedTabId, tabIdByMountIdMap, dispatch]);

  // Back/forward support
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as HistoryStateShape | null;
      const route = state?.OPSPACE_ROUTE;
      if (!route) return;

      if (route.routeMode === 'saved' && route.dataQueryId) {
        const tabId = tabIdByMountIdMap.get(route.dataQueryId);
        if (tabId) {
          void dispatch(setActiveTabThunk(tabId));
        }
      } else if (route.routeMode === 'new' && lastActiveUnsavedTabId) {
        void dispatch(setActiveTabThunk(lastActiveUnsavedTabId));
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [dispatch, lastActiveUnsavedTabId, tabIdByMountIdMap]);

  // Annotate initial history entry
  useEffect(() => {
    try {
      const prev = (window.history.state || {}) as HistoryStateShape;
      const state: HistoryStateShape = {
        ...prev,
        OPSPACE_ROUTE: {
          opspaceId,
          routeMode,
          ...(routeMode === 'saved' && dataQueryId ? { dataQueryId } : {}),
        },
      };
      window.history.replaceState(state, '', pathname);
    } catch {}
  }, [opspaceId, routeMode, dataQueryId, pathname]);

  return (
    <QueriesRouteCtx.Provider
      value={{
        opspaceId,
        routeMode,
        dataQueryId,
        navigateToSaved,
        navigateToNew,
      }}
    >
      {children}
    </QueriesRouteCtx.Provider>
  );
}

function useQueriesRoute(): QueriesRouteContextValue {
  const ctx = useContext(QueriesRouteCtx);
  if (!ctx) throw new Error('useQueriesRoute must be used within QueriesRouteProvider');
  return ctx;
}


export { QueriesRouteProvider, useQueriesRoute };
