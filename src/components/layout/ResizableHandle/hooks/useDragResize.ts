import type { PanelSide }       from '../utils/constants';

import { useEffect }            from 'react';
import { clamp }                from '../utils/math';
import {
  MOVE_THRESHOLD,
  DEFAULT_COLLAPSED,
  DEFAULT_SNAP
}                               from '../utils/constants';
import {
  VAR_LEFT_WIDTH,
  VAR_RIGHT_WIDTH
}                               from '../utils/constants';
import {
  getPanelRectFromHandle,
  isPanelCollapsedFromHandle,
  getSideContainerElFromHandle
}                               from '../utils/dom';
import {
  readMinMax,
  readCurrentWidth,
  readThresholds,
  readCollapsedWidth
}                               from '../utils/cssVars';


type Args = {
  ref           : React.RefObject<HTMLDivElement | null>;
  side          : PanelSide;
  setSideWidth  : (side: PanelSide, px: number) => void;
  expandSide    : (side: PanelSide) => void;
  collapseSide  : (side: PanelSide) => void;
  setAriaNow    : (v: number) => void;
  controlledId  : string;
};

// AIDEV-NOTE: Drag/resize logic extracted into a hook; no setState in hot paths
function useDragResize({ ref, side, setSideWidth, expandSide, collapseSide, setAriaNow, controlledId }: Args) {
  useEffect(() => {
    if (!ref.current) return;

    const el              = ref.current;
    const supportsPointer = 'PointerEvent' in window;

    let startX                          = 0;
    let startWidth                      = 0;
    let dragging                        = false;
    let frameRequested                  = false;
    let lastWidth                       = 0;
    let hasMoved                        = false;
    let pointerIsDown                   = false;
    let pressOffset                     = 0;
    let activePointerId: number | null  = null;

    // AIDEV-NOTE: Snap state tracking for drag-to-open/close behavior
    let collapsedAtStart = false;

    // AIDEV-NOTE: Per-drag session values (captured at pointerdown)
    let { min: sessionMin, max: sessionMax }  = readMinMax();
    let sessionThresholds                     = readThresholds();
    let sessionCollapsedWidth                 = readCollapsedWidth();

    const isPanelCollapsed  = () => isPanelCollapsedFromHandle(el, side);
    const getPanelRect      = () => getPanelRectFromHandle(el, side);

    // AIDEV-NOTE: Ensure the controlled panel has a stable id for a11y
    const sideElForA11y = getSideContainerElFromHandle(el, side);
    if (sideElForA11y && !sideElForA11y.id) {
      sideElForA11y.id = controlledId;
    }

    const setCssWidth = (px: number) => {
      const clamped   = clamp(px, sessionMin, sessionMax);
      const widthVar  = side === 'left' ? VAR_LEFT_WIDTH : VAR_RIGHT_WIDTH;
      lastWidth       = clamped;

      document.documentElement.style.setProperty(widthVar, `${clamped}px`);
      ref.current?.setAttribute('aria-valuenow', String(clamped));
    };

    // AIDEV-NOTE: Listener helpers (pointer-only with mouse fallback)
    const addPointerDocListeners = () => {
      document.addEventListener('pointermove', onPointerMove  as EventListener, { capture: true });
      document.addEventListener('pointerup'  , onPointerUp    as EventListener, { once: true, capture: true });
      document.addEventListener('keydown'    , onKeyCancel    as EventListener);
    };
    const removePointerDocListeners = () => {
      document.removeEventListener('pointermove', onPointerMove as EventListener);
      document.removeEventListener('pointerup'  , onPointerUp   as EventListener);
      document.removeEventListener('keydown'    , onKeyCancel   as EventListener);
    };
    const addMouseDocListeners = () => {
      document.addEventListener('mousemove', onMouseMove  as EventListener, { capture: true });
      document.addEventListener('mouseup'  , onMouseUp    as EventListener, { once: true, capture: true });
      document.addEventListener('keydown'  , onKeyCancel  as EventListener);
    };
    const removeMouseDocListeners = () => {
      document.removeEventListener('mousemove', onMouseMove as EventListener);
      document.removeEventListener('mouseup'  , onMouseUp   as EventListener);
      document.removeEventListener('keydown'  , onKeyCancel as EventListener);
    };
    const addDocListeners     = () => (supportsPointer ? addPointerDocListeners() : addMouseDocListeners());
    const removeDocListeners  = () => (supportsPointer ? removePointerDocListeners() : removeMouseDocListeners());

    const finishDrag = () => {
      pointerIsDown = false;

      if (activePointerId !== null) {
        try {
          ref.current?.releasePointerCapture(activePointerId);
        } catch {}
      }

      removeDocListeners();
      dragging = false;
      document.documentElement.style.cursor     = '';
      document.documentElement.style.userSelect = '';
      document.documentElement.removeAttribute('data-op-space-layout-dragging');

      const finalCollapsed = isPanelCollapsed();
      if (hasMoved && lastWidth > 0 && !finalCollapsed) {
        setSideWidth(side, lastWidth);
        setAriaNow(lastWidth);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();

      const cur     = readCurrentWidth(side);
      const mm      = readMinMax();

      startX        = e.clientX;
      startWidth    = cur;
      sessionMin    = mm.min;
      sessionMax    = mm.max;
      dragging      = true;
      pointerIsDown = true;
      hasMoved      = false;

      collapsedAtStart      = isPanelCollapsed();
      sessionThresholds     = readThresholds();
      sessionCollapsedWidth = readCollapsedWidth();

      try {
        el.setPointerCapture(e.pointerId);
        activePointerId = e.pointerId;
      } catch {}

      const rect = getPanelRect();
      pressOffset = rect
        ? side === 'left' ? (e.clientX - rect.right) : (rect.left - e.clientX)
        : 0;

      document.documentElement.setAttribute('data-op-space-layout-dragging', 'true');
      document.documentElement.style.cursor = 'col-resize';
      document.documentElement.style.userSelect = 'none';

      addDocListeners();
      el.addEventListener('lostpointercapture', onLostPointerCapture  as EventListener);
      el.addEventListener('pointercancel'     , onPointerCancel       as EventListener);
    };

    const onMouseDown = (evt: MouseEvent) => {
      if (supportsPointer) return;

      evt.preventDefault();

      const cur = readCurrentWidth(side);
      const mm  = readMinMax();

      startX        = evt.clientX;
      startWidth    = cur;
      sessionMin    = mm.min;
      sessionMax    = mm.max;
      dragging      = true;
      pointerIsDown = true;
      hasMoved      = false;

      collapsedAtStart      = isPanelCollapsed();
      sessionThresholds     = readThresholds();
      sessionCollapsedWidth = readCollapsedWidth();

      const rect = getPanelRect();
      pressOffset = rect
        ? side === 'left' ? (evt.clientX - rect.right) : (rect.left - evt.clientX)
        : 0;

      document.documentElement.style.cursor     = 'col-resize';
      document.documentElement.style.userSelect = 'none';
      document.documentElement.setAttribute('data-op-space-layout-dragging', 'true');

      addDocListeners();
    };

    const handleMove = (clientX: number) => {
      if (!dragging) return;
      if (!hasMoved && Math.abs(clientX - startX) < MOVE_THRESHOLD) return;

      const rect                = getPanelRect();
      if (!rect) return;

      hasMoved = true;

      const min                 = sessionMin;
      const thresholds          = sessionThresholds;
      const closeAbsWidth       = Math.max(0, thresholds.close ?? DEFAULT_SNAP);
      const currentlyCollapsed  = isPanelCollapsed();

      const widthCandidate = side === 'left'
        ? (clientX - rect.left - pressOffset)
        : (rect.right - clientX - pressOffset);

      if (currentlyCollapsed) {
        const collapsedWidth    = sessionCollapsedWidth ?? DEFAULT_COLLAPSED;
        const requiredDistance  = Math.max(0, thresholds.open - collapsedWidth);
        const distanceFromEdge  = side === 'left'
          ? (clientX - rect.right - pressOffset)
          : (rect.left - clientX - pressOffset);

        const willOpen = distanceFromEdge >= requiredDistance;
        if (!willOpen) return;

        lastWidth = min;
        expandSide(side);
        setCssWidth(lastWidth);
      }

      const roundedWidth = Math.round(widthCandidate);
      if (roundedWidth <= closeAbsWidth) {
        collapseSide(side);
        return;
      }
      if (roundedWidth < min) return;

      if (!frameRequested) {
        frameRequested = true;
        requestAnimationFrame(() => {
          frameRequested = false;
          setCssWidth(roundedWidth);
          lastWidth = roundedWidth;
        });
      }
    };

    const onPointerMove = (evt: PointerEvent) => {
      handleMove(evt.clientX);
    };

    const onMouseMove = (evt: MouseEvent) => {
      if (activePointerId !== null) return;
      handleMove(evt.clientX);
    };

    const onPointerUp = () => finishDrag();
    const onMouseUp = () => finishDrag();

    const onPointerCancel = (evt: PointerEvent) => {
      finishDrag();
    };

    const onLostPointerCapture = (evt: PointerEvent) => {
      if (pointerIsDown && ref.current) {
        try {
          ref.current.setPointerCapture(evt.pointerId);
          activePointerId = evt.pointerId;
        } catch {}
      }
    };

    const onKeyCancel = (evt: KeyboardEvent) => {
      if (evt.key !== 'Escape') return;
      if (!dragging) return;

      const currentlyCollapsed = isPanelCollapsed();
      if (collapsedAtStart && !currentlyCollapsed) {
        collapseSide(side);
      } else if (!collapsedAtStart && currentlyCollapsed) {
        expandSide(side);
        const cur = readCurrentWidth(side);
        setCssWidth(cur);
      } else if (!collapsedAtStart && !currentlyCollapsed) {
        setCssWidth(startWidth);
      }

      finishDrag();
    };

    if (supportsPointer) {
      el.addEventListener('pointerdown' , onPointerDown as EventListener);
    } else {
      el.addEventListener('mousedown'   , onMouseDown   as EventListener);
    }

    return () => {
      if (supportsPointer) {
        el.removeEventListener('pointerdown', onPointerDown as EventListener);
      } else {
        el.removeEventListener('mousedown'  , onMouseDown   as EventListener);
      }
      removeDocListeners();
      el.removeEventListener('lostpointercapture' , onLostPointerCapture  as EventListener);
      el.removeEventListener('pointercancel'      , onPointerCancel       as EventListener);
    };
  }, [ref, side, setSideWidth, expandSide, collapseSide, setAriaNow, controlledId]);
}


export { useDragResize };
