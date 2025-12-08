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


type RouteMode = 'saved' | 'new';

type OpSpaceRouteContextValue = {
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

const OpSpaceRouteCtx = createContext<OpSpaceRouteContextValue | null>(null);

function OpSpaceRouteProvider({ opspaceId, children }: { opspaceId: Base64Url22; children: ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const dispatch  = useReduxDispatch();
  const hasAlignedInitialRef = useRef(false);

  const routeMode: RouteMode = pathname.endsWith('/new') ? 'new' : 'saved';

  const activeTabId               = useReduxSelector(selectActiveTabId);
  const activeDataQueryIdFromTabs = useReduxSelector(selectDataQueryIdForTabId, (activeTabId || null) as UUIDv7 | null);
  const lastActiveUnsavedTabId    = useReduxSelector(selectLastActiveUnsavedTabId);
  const tabIdByMountIdMap         = useReduxSelector(selectTabIdByMountIdMap);

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
    const prev = (window.history.state || {}) as HistoryStateShape;
    const state: HistoryStateShape = {
      ...prev,
      OPSPACE_ROUTE: { opspaceId, routeMode: 'saved', dataQueryId: id },
    };
    window.history.pushState(state, '', url);
    router.replace(url);
  });

  const navigateToNew = useEffectEvent(() => {
    const url = buildNewUrl();
    const prev = (window.history.state || {}) as HistoryStateShape;
    const state: HistoryStateShape = {
      ...prev,
      OPSPACE_ROUTE: { opspaceId, routeMode: 'new' },
    };
    window.history.replaceState(state, '', url);
    if (!pathname.endsWith('/new')) {
      router.replace(url);
    }
  });

  // Initial alignment: on first load, align Redux active tab to URL or lastActiveUnsavedTabId
  useEffect(() => {
    if (hasAlignedInitialRef.current) return;

    if (routeMode === 'saved') {
      // If URL encodes a saved query and we don't have an active tab yet, align it
      if (dataQueryId && !activeTabId) {
        const tabId = tabIdByMountIdMap.get(dataQueryId);
        if (tabId) {
          void dispatch(setActiveTabThunk(tabId));
        }
      }
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
  }, [routeMode, dataQueryId, activeTabId, lastActiveUnsavedTabId, dispatch]);

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
    <OpSpaceRouteCtx.Provider
      value={{
        opspaceId,
        routeMode,
        dataQueryId,
        navigateToSaved,
        navigateToNew,
      }}
    >
      {children}
    </OpSpaceRouteCtx.Provider>
  );
}

function useOpSpaceRoute(): OpSpaceRouteContextValue {
  const ctx = useContext(OpSpaceRouteCtx);
  if (!ctx) throw new Error('useOpSpaceRoute must be used within OpSpaceRouteProvider');
  return ctx;
}


export { OpSpaceRouteProvider, useOpSpaceRoute };
