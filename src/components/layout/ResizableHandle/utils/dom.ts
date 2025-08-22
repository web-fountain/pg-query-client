import {
  SELECTOR_PANEL_LAYOUT,
  SELECTOR_LEFT_SIDE,
  SELECTOR_RIGHT_SIDE,
  PanelSide
} from './constants';


// AIDEV-NOTE: DOM helpers (read-only)
const getPanelLayoutElFromHandle = (ele: HTMLElement | null) => ele?.closest(SELECTOR_PANEL_LAYOUT) as HTMLElement | null;

const getSideContainerElFromHandle = (ele: HTMLElement | null, side: PanelSide) => {
  const layout = getPanelLayoutElFromHandle(ele);
  if (!layout) return null;
  const selector = side === 'left' ? SELECTOR_LEFT_SIDE : SELECTOR_RIGHT_SIDE;
  return layout.querySelector(selector) as HTMLElement | null;
};

const getPanelRectFromHandle = (ele: HTMLElement | null, side: PanelSide) => {
  const sideEl = getSideContainerElFromHandle(ele, side);
  return sideEl ? sideEl.getBoundingClientRect() : null;
};

const isPanelCollapsedFromHandle = (ele: HTMLElement | null, side: PanelSide) => {
  const layout = getPanelLayoutElFromHandle(ele);
  if (!layout) return false;
  return side === 'left' ? layout.hasAttribute('data-left-collapsed') : layout.hasAttribute('data-right-collapsed');
};


export { getPanelLayoutElFromHandle, getSideContainerElFromHandle, getPanelRectFromHandle, isPanelCollapsedFromHandle };
