import {
  SELECTOR_LAYOUT_ROOT,
  SELECTOR_SIDE_ATTR,
  PanelSide
} from './constants';


// AIDEV-NOTE: DOM helpers (read-only)
const getPanelLayoutElFromHandle = (ele: HTMLElement | null) => ele?.closest(SELECTOR_LAYOUT_ROOT) as HTMLElement | null;

const getSideContainerElFromHandle = (ele: HTMLElement | null, side: PanelSide) => {
  const layout = getPanelLayoutElFromHandle(ele);
  if (!layout) return null;
  const selector = `[${SELECTOR_SIDE_ATTR}="${side}"]`;
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
