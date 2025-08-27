// AIDEV-NOTE: Constants shared across ResizableHandle modules

export const VAR_LEFT_WIDTH         = '--op-space-layout-left-panel-width';
export const VAR_RIGHT_WIDTH        = '--op-space-layout-right-panel-width';
export const VAR_MIN                = '--op-space-layout-panel-min-width';
export const VAR_MAX                = '--op-space-layout-panel-max-width';
export const VAR_SNAP_OPEN          = '--op-space-layout-snap-open-threshold';
export const VAR_SNAP_CLOSE         = '--op-space-layout-snap-close-threshold';
export const VAR_COLLAPSED          = '--op-space-layout-panel-collapsed-width';

export const SELECTOR_LAYOUT_ROOT   = '[data-op-space-layout="root"]';
export const SELECTOR_SIDE_ATTR     = 'data-op-space-layout-side';

export const DEFAULT_MIN            = 170;
export const DEFAULT_MAX            = 600;
export const DEFAULT_COLLAPSED      = 48;
export const DEFAULT_SNAP           = 113;
export const MOVE_THRESHOLD         = 5;

export type PanelSide               = 'left' | 'right';
