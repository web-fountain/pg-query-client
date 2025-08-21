'use client';

import { useEffect, useRef, useState }  from 'react';
import { useOpSpaceLayout }             from '../OpSpaceProvider';
import styles                           from './styles.module.css';


type Props = { side: 'left' | 'right' };

function ResizableHandle({ side }: Props) {
  const { getConfig, setSideWidth, expandSide } = useOpSpaceLayout();
  const ref                                     = useRef<HTMLDivElement>(null);
  const [ariaMin, setAriaMin] = useState<number | undefined>(undefined);
  const [ariaMax, setAriaMax] = useState<number | undefined>(undefined);
  const [ariaNow, setAriaNow] = useState<number | undefined>(undefined);
  const actualDragOccurred = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startWidth = 0;
    let dragging = false;
    let frameRequested = false;
    let pendingDelta = 0;
    let lastWidth = 0;
    let hasMoved = false;  // AIDEV-NOTE: Track if real movement occurred

    const getWidths = () => {
      const cs = getComputedStyle(document.documentElement);
      const raw = cs.getPropertyValue(
        side === 'left' ? '--op-space-layout-left-panel-width' : '--op-space-layout-right-panel-width'
      );
      const parsed = parseInt(raw);
      const cur = isNaN(parsed) ? 300 : parsed;
      const minRaw = cs.getPropertyValue('--op-space-layout-panel-min-width');
      const maxRaw = cs.getPropertyValue('--op-space-layout-panel-max-width');
      const min = parseInt(minRaw) || 170;
      const max = parseInt(maxRaw) || 600;
      // AIDEV-NOTE: keep local ARIA state aligned with CSS vars on read
      setAriaMin(min);
      setAriaMax(max);
      setAriaNow(cur);
      return { cur, min, max };
    };

    // Replace the setCssWidth function to always use fresh limits
    const setCssWidth = (px: number) => {
      // AIDEV-NOTE: Always read fresh CSS values to avoid stale cache after swaps
      const cs = getComputedStyle(document.documentElement);
      const minStr = cs.getPropertyValue('--op-space-layout-panel-min-width').trim();
      const maxStr = cs.getPropertyValue('--op-space-layout-panel-max-width').trim();
      const freshMin = parseInt(minStr) || 170;
      const freshMax = parseInt(maxStr) || 600;

      const clamped = Math.max(freshMin, Math.min(freshMax, px));
      lastWidth = clamped;
      const widthVar = side === 'left' ? '--op-space-layout-left-panel-width' : '--op-space-layout-right-panel-width';
      document.documentElement.style.setProperty(widthVar, `${clamped}px`);
      setAriaNow(clamped);
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const { cur } = getWidths();
      startX = e.clientX;
      startWidth = cur;
      dragging = true;
      hasMoved = false;  // AIDEV-NOTE: Reset movement flag
      actualDragOccurred.current = false;

      try {
        // AIDEV-NOTE: Capture pointer to ensure consistent move events during drag
        el.setPointerCapture(e.pointerId);
      } catch {}
      // AIDEV-NOTE: Disable grid transition during active drag for responsiveness
      document.documentElement.setAttribute('data-op-space-layout-dragging', 'true');
      document.documentElement.style.cursor = 'col-resize';
      document.documentElement.style.userSelect = 'none';
      const supportsPointer = 'PointerEvent' in window;
      if (supportsPointer) {
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp as EventListener, { once: true });
        window.addEventListener('pointercancel', onPointerUp as EventListener, { once: true });
      } else {
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp as EventListener, { once: true });
      }
      window.addEventListener('keydown', onKeyCancel);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      pendingDelta = e.clientX - startX;

      // AIDEV-NOTE: Only start writing widths after 5px movement threshold
      if (!hasMoved && Math.abs(pendingDelta) < 5) {
        return;  // Don't write any widths yet
      }

      hasMoved = true;
      actualDragOccurred.current = true;

      if (!frameRequested) {
        frameRequested = true;
        requestAnimationFrame(() => {
          frameRequested = false;
          const next = side === 'left' ? startWidth + pendingDelta : startWidth - pendingDelta;
          setCssWidth(next);
        });
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      pendingDelta = e.clientX - startX;
      if (!frameRequested) {
        frameRequested = true;
        requestAnimationFrame(() => {
          frameRequested = false;
          const next = side === 'left' ? startWidth + pendingDelta : startWidth - pendingDelta;
          setCssWidth(next);
        });
      }
    };

    const onPointerUp = (e?: PointerEvent) => {
      if (e) {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {}
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('pointercancel', onPointerUp as EventListener);
      window.removeEventListener('keydown', onKeyCancel);
      dragging = false;
      document.documentElement.removeAttribute('data-op-space-layout-dragging');
      document.documentElement.style.cursor = '';
      document.documentElement.style.userSelect = '';
      // AIDEV-NOTE: Only commit width if actual movement occurred
      if (hasMoved && lastWidth > 0) {
        setSideWidth(side, lastWidth);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyCancel);
      dragging = false;
      document.documentElement.removeAttribute('data-op-space-layout-dragging');
      document.documentElement.style.cursor = '';
      document.documentElement.style.userSelect = '';
      if (lastWidth > 0) {
        setSideWidth(side, lastWidth);
      }
    };

    const onKeyCancel = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // AIDEV-NOTE: Escape cancels in-progress drag and restores start width.
      if (!dragging) return;
      setCssWidth(startWidth);
      onPointerUp();
    };

    // Initialize ARIA values on mount
    getWidths();

    el.addEventListener('pointerdown', onPointerDown);
    // AIDEV-NOTE: listen for provider width updates to keep ARIA in sync (e.g., reset button)
    const onWidthsEvent = (evt: Event) => {
      const detail = (evt as CustomEvent<{ lw: number; rw: number }>).detail;
      if (!detail) return;
      setAriaNow(side === 'left' ? detail.lw : detail.rw);
      const { min, max } = getWidths();
      setAriaMin(min);
      setAriaMax(max);
    };
    window.addEventListener('op-space-layout-widths', onWidthsEvent as EventListener);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('pointerup', onPointerUp as EventListener);
      window.removeEventListener('pointercancel', onPointerUp as EventListener);
      window.removeEventListener('mouseup', onMouseUp as EventListener);
      window.removeEventListener('keydown', onKeyCancel);
      window.removeEventListener('op-space-layout-widths', onWidthsEvent as EventListener);
    };
  }, [setSideWidth, side]);

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const allowed = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!allowed.includes(e.key)) return;
    const step = e.shiftKey ? 50 : 10;
    const cs = getComputedStyle(document.documentElement);
    const cur = parseInt(cs.getPropertyValue(
      side === 'left' ? '--op-space-layout-left-panel-width' : '--op-space-layout-right-panel-width'
    ));
    const min = parseInt(cs.getPropertyValue('--op-space-layout-panel-min-width'));
    const max = parseInt(cs.getPropertyValue('--op-space-layout-panel-max-width'));

    let next = cur;
    if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else {
      const delta = (e.key === 'ArrowRight' ? (side === 'left' ? +step : -step)
                                            : (side === 'left' ? -step : +step));
      next = Math.max(min, Math.min(max, cur + delta));
    }
    setSideWidth(side, next);
    e.preventDefault();
  };

  // AIDEV-NOTE: Handles own a fixed side; expand that side if currently collapsed
  const isCollapsed = getConfig(side).collapsed;

  // AIDEV-NOTE: Reset only the specific panel this handle controls
  const resetThisPanel = () => {
    // Reset to the initial width for this side
    const cfg = getConfig(side);
    setSideWidth(side, cfg.initialWidth);
  };

  return (
    <div
      ref={ref}
      className={`${styles['handle']} ${
        isCollapsed ? (side === 'left' ? styles['collapsed-left'] : styles['collapsed-right']) : ''
      }`}
      role="separator"
      aria-orientation="vertical"
      tabIndex={0}
      onKeyDown={onKeyDown}
      /* AIDEV-NOTE: a11y state reflects current width and limits */
      aria-valuemin={ariaMin}
      aria-valuemax={ariaMax}
      aria-valuenow={ariaNow}
      aria-label={side === 'left' ? 'Resize left panel' : 'Resize right panel'}
      onDoubleClick={() => {
        // Don't reset if user was actually dragging
        if (actualDragOccurred.current) return;

        if (isCollapsed) {
          expandSide(side);
        } else {
          resetThisPanel();
        }
      }}
    />
  );
}


export default ResizableHandle;
