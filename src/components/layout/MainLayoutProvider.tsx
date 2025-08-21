'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';


type LayoutCtx = {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  swapped: boolean;

  setLeftCollapsed(v: boolean): void;
  setRightCollapsed(v: boolean): void;
  setSwapped(v: boolean): void;

  // convenient toggles
  toggleLeft(): void;
  toggleRight(): void;
  toggleSwap(): void;

  // width controls
  setLeftWidth(px: number): void;
  setRightWidth(px: number): void;
  resetWidths(): void;

  // expand collapsed panels
  expandLeft(): void;
  expandRight(): void;
};

const LayoutContext = createContext<LayoutCtx | null>(null);

function MainLayoutProvider({ children }: { children: ReactNode }) {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [swapped, setSwapped] = useState(false);

  // restore from localStorage
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('pg-query-client-mainLayout.panels') || '{}');
    setLeftCollapsed(!!saved.lc);
    setRightCollapsed(!!saved.rc);
    setSwapped(!!saved.sw);

    if (saved.lw) document.documentElement.style.setProperty('--main-layout-left-panel-width', `${saved.lw}px`);
    if (saved.rw) document.documentElement.style.setProperty('--main-layout-right-panel-width', `${saved.rw}px`);

    // Set defaults if unset
    const cs = getComputedStyle(document.documentElement);
    if (!cs.getPropertyValue('--main-layout-left-panel-width').trim())
      document.documentElement.style.setProperty('--main-layout-left-panel-width', '320px');
    if (!cs.getPropertyValue('--main-layout-right-panel-width').trim())
      document.documentElement.style.setProperty('--main-layout-right-panel-width', '360px');
    if (!cs.getPropertyValue('--main-layout-panel-min-width').trim())
      document.documentElement.style.setProperty('--main-layout-panel-min-width', '200px');
    if (!cs.getPropertyValue('--main-layout-panel-max-width').trim())
      document.documentElement.style.setProperty('--main-layout-panel-max-width', '600px');
    if (!cs.getPropertyValue('--main-layout-resizer-width').trim())
      document.documentElement.style.setProperty('--main-layout-resizer-width', '8px');
  }, []);

  // persist to localStorage
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const lw = parseInt(cs.getPropertyValue('--main-layout-left-panel-width'));
    const rw = parseInt(cs.getPropertyValue('--main-layout-right-panel-width'));
    localStorage.setItem('pg-query-client-mainLayout.panels', JSON.stringify({
      lc: leftCollapsed, rc: rightCollapsed, sw: swapped, lw, rw
    }));
  }, [leftCollapsed, rightCollapsed, swapped]);

  // AIDEV-NOTE: Persist widths immediately on change to survive reloads between interactions
  const persist = (lwOverride?: number, rwOverride?: number) => {
    const cs = getComputedStyle(document.documentElement);
    const lw = lwOverride ?? parseInt(cs.getPropertyValue('--main-layout-left-panel-width'));
    const rw = rwOverride ?? parseInt(cs.getPropertyValue('--main-layout-right-panel-width'));
    localStorage.setItem('pg-query-client-mainLayout.panels', JSON.stringify({
      lc: leftCollapsed, rc: rightCollapsed, sw: swapped, lw, rw
    }));
    // AIDEV-NOTE: Broadcast widths so handles can update ARIA without DOM reads in render
    window.dispatchEvent(new CustomEvent('main-layout-widths', { detail: { lw, rw } }));
  };

  const setLeftWidth  = (px: number) => {
    document.documentElement.style.setProperty('--main-layout-left-panel-width', `${px}px`);
    persist(px, undefined);
  };
  const setRightWidth = (px: number) => {
    document.documentElement.style.setProperty('--main-layout-right-panel-width', `${px}px`);
    persist(undefined, px);
  };

  const resetWidths = () => {
    setLeftWidth(320);
    setRightWidth(360);
  };

  const toggleLeft  = () => setLeftCollapsed(v => !v);
  const toggleRight = () => setRightCollapsed(v => !v);
  const toggleSwap  = () => setSwapped(v => !v);

  const expandLeft  = () => setLeftCollapsed(false);
  const expandRight = () => setRightCollapsed(false);

  return (
    <LayoutContext.Provider value={{
      leftCollapsed, rightCollapsed, swapped,
      setLeftCollapsed, setRightCollapsed, setSwapped,
      toggleLeft, toggleRight, toggleSwap,
      setLeftWidth, setRightWidth, resetWidths,
      expandLeft, expandRight
    }}>
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
