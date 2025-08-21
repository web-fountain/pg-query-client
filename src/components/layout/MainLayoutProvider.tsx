'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Side = 'left' | 'right';
type SideConfig = {
  width: number;
  collapsed: boolean;
  initialWidth: number;
  // AIDEV-TODO: Consider per-side min/max constraints in the future
  minWidth?: number;
  maxWidth?: number;
};

type LayoutState = {
  left: SideConfig;
  right: SideConfig;
  contentSwapped: boolean;
};

type LayoutCtx = {
  getConfig(side: Side)               : SideConfig;
  setSideWidth(side: Side, px: number): void;
  collapseSide(side: Side)            : void;
  expandSide(side: Side)              : void;
  toggleCollapseSide(side: Side)      : void;
  resetSide(side: Side)               : void;
  resetBothSides()                    : void;
  swapSides()                         : void;
  isContentSwapped()                  : boolean;
};

const STORAGE_KEY = 'pg-query-client-mainLayout.panels';

const LayoutContext = createContext<LayoutCtx | null>(null);

function clampToPanelLimits(px: number): number {
  const cs = getComputedStyle(document.documentElement);
  const minStr = cs.getPropertyValue('--main-layout-panel-min-width').trim();
  const maxStr = cs.getPropertyValue('--main-layout-panel-max-width').trim();
  const min = parseInt(minStr) || 170;
  const max = parseInt(maxStr) || 600;
  return Math.max(min, Math.min(max, px));
}

function applyCssWidths(leftWidth: number, rightWidth: number) {
  document.documentElement.style.setProperty('--main-layout-left-panel-width', `${leftWidth}px`);
  document.documentElement.style.setProperty('--main-layout-right-panel-width', `${rightWidth}px`);
  // AIDEV-NOTE: Broadcast widths so handles can update ARIA without DOM reads in render
  window.dispatchEvent(new CustomEvent('main-layout-widths', { detail: { lw: leftWidth, rw: rightWidth } }));
}

function MainLayoutProvider({ children }: { children: ReactNode }) {
  const defaults: LayoutState = useMemo(() => ({
    left:  { width: 300, collapsed: false, initialWidth: 300 },
    right: { width: 300, collapsed: false, initialWidth: 300 },
    contentSwapped: false
  }), []);

  // AIDEV-NOTE: Use deterministic SSR defaults. Load from storage after mount to avoid hydration mismatch.
  const [state, setState] = useState<LayoutState>(defaults);
  const [hydrated, setHydrated] = useState(false);

  // Apply initial CSS widths on mount (defaults are in layouts.css)
  useEffect(() => {
    applyCssWidths(state.left.width, state.right.width);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw);
      if (parsed && parsed.left && parsed.right) {
        setState(prev => ({
          left:  {
            width:        typeof parsed.left.width === 'number' ? parsed.left.width : prev.left.width,
            collapsed:    !!parsed.left.collapsed,
            initialWidth: prev.left.initialWidth
          },
          right: {
            width:        typeof parsed.right.width === 'number' ? parsed.right.width : prev.right.width,
            collapsed:    !!parsed.right.collapsed,
            initialWidth: prev.right.initialWidth
          },
          contentSwapped: !!parsed.contentSwapped
        }));
      }
      setHydrated(true);
    } catch {
      setHydrated(true);
    }
  }, []);

  // Persist whenever state changes (post-hydration only)
  useEffect(() => {
    if (!hydrated) return;
    const payload = {
      left: { width: state.left.width, collapsed: state.left.collapsed },
      right: { width: state.right.width, collapsed: state.right.collapsed },
      contentSwapped: state.contentSwapped
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [state, hydrated]);

  // Keep CSS vars in sync when widths change
  useEffect(() => {
    applyCssWidths(state.left.width, state.right.width);
  }, [state.left.width, state.right.width]);

  // AIDEV-NOTE: Stable callbacks to avoid tearing down resizer listeners mid-drag
  const getConfigCb = useCallback((side: Side) => state[side], [state]);

  const setSideWidthCb = useCallback((side: Side, px: number) => {
    const clamped = clampToPanelLimits(px);
    setState(prev => ({
      ...prev,
      [side]: {
        ...prev[side],
        width: clamped
      }
    }));
  }, []);

  const collapseSideCb = useCallback((side: Side) => {
    setState(prev => ({ ...prev, [side]: { ...prev[side], collapsed: true } }));
  }, []);

  const expandSideCb = useCallback((side: Side) => {
    setState(prev => ({ ...prev, [side]: { ...prev[side], collapsed: false } }));
  }, []);

  const toggleCollapseSideCb = useCallback((side: Side) => {
    setState(prev => ({ ...prev, [side]: { ...prev[side], collapsed: !prev[side].collapsed } }));
  }, []);

  const resetSideCb = useCallback((side: Side) => {
    setState(prev => ({ ...prev, [side]: { ...prev[side], width: prev[side].initialWidth } }));
  }, []);

  const resetBothSidesCb = useCallback(() => {
    setState(prev => ({
      ...prev,
      left: { ...prev.left, width: prev.left.initialWidth },
      right: { ...prev.right, width: prev.right.initialWidth }
    }));
  }, []);

  const swapSidesCb = useCallback(() => {
    setState(prev => ({
      left: { ...prev.right },
      right: { ...prev.left },
      contentSwapped: !prev.contentSwapped
    }));
  }, []);

  const isContentSwappedCb = useCallback(() => state.contentSwapped, [state]);

  const api: LayoutCtx = useMemo(() => ({
    getConfig: getConfigCb,
    setSideWidth: setSideWidthCb,
    collapseSide: collapseSideCb,
    expandSide: expandSideCb,
    toggleCollapseSide: toggleCollapseSideCb,
    resetSide: resetSideCb,
    resetBothSides: resetBothSidesCb,
    swapSides: swapSidesCb,
    isContentSwapped: isContentSwappedCb
  }), [
    getConfigCb,
    setSideWidthCb,
    collapseSideCb,
    expandSideCb,
    toggleCollapseSideCb,
    resetSideCb,
    resetBothSidesCb,
    swapSidesCb,
    isContentSwappedCb
  ]);

  return (
    <LayoutContext.Provider value={api}>
      {children}
    </LayoutContext.Provider>
  );
}

const useMainLayout = () => {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useMainLayout must be used inside MainLayoutProvider');
  return ctx;
};

export { useMainLayout };
export default MainLayoutProvider;
