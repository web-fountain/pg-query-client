import {
  VAR_LEFT_WIDTH,
  VAR_RIGHT_WIDTH,
  VAR_MIN,
  VAR_MAX,
  VAR_SNAP_OPEN,
  VAR_SNAP_CLOSE,
  VAR_COLLAPSED,
  DEFAULT_MIN,
  DEFAULT_MAX,
  DEFAULT_SNAP,
  DEFAULT_COLLAPSED,
  PanelSide
} from './constants';

// AIDEV-NOTE: Pure CSS var helpers (DOM reads only)
const parseCssVarInt = (name: string, fallback: number) => {
  const cs = getComputedStyle(document.documentElement);
  const raw = cs.getPropertyValue(name).trim();
  const parsed = parseInt(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const readMinMax = () => ({
  min: parseCssVarInt(VAR_MIN, DEFAULT_MIN),
  max: parseCssVarInt(VAR_MAX, DEFAULT_MAX)
});

const readCurrentWidth = (side: PanelSide) => {
  const name = side === 'left' ? VAR_LEFT_WIDTH : VAR_RIGHT_WIDTH;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const parsed = parseInt(raw);
  return Number.isNaN(parsed) ? 300 : parsed;
};

const readThresholds = () => ({
  open: parseCssVarInt(VAR_SNAP_OPEN, DEFAULT_SNAP),
  close: parseCssVarInt(VAR_SNAP_CLOSE, DEFAULT_SNAP)
});

const readCollapsedWidth = () => parseCssVarInt(VAR_COLLAPSED, DEFAULT_COLLAPSED);


export { readMinMax, readCurrentWidth, readThresholds, readCollapsedWidth };
