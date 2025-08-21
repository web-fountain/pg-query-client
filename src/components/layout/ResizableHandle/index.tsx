'use client';

import { useEffect, useRef, useState }  from 'react';
import { useMainLayout }      from '../MainLayoutProvider';
import styles                 from './styles.module.css';


type Props = { side: 'left' | 'right' };

function ResizableHandle({ side }: Props) {
  const { getConfig, setSideWidth, expandSide } = useMainLayout();
  const ref                                     = useRef<HTMLDivElement>(null);
  const [ariaMin, setAriaMin] = useState<number | undefined>(undefined);
  const [ariaMax, setAriaMax] = useState<number | undefined>(undefined);
  const [ariaNow, setAriaNow] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startWidth = 0;
    let dragging = false;
    let frameRequested = false;
    let pendingDelta = 0;

    const getWidths = () => {
      const cs = getComputedStyle(document.documentElement);
      const raw = cs.getPropertyValue(
        side === 'left' ? '--main-layout-left-panel-width' : '--main-layout-right-panel-width'
      );
      const parsed = parseInt(raw);
      const cur = isNaN(parsed) ? 300 : parsed;
      const minRaw = cs.getPropertyValue('--main-layout-panel-min-width');
      const maxRaw = cs.getPropertyValue('--main-layout-panel-max-width');
      const min = parseInt(minRaw) || 170;
      const max = parseInt(maxRaw) || 600;
      // AIDEV-NOTE: keep local ARIA state aligned with CSS vars on read
      setAriaMin(min);
      setAriaMax(max);
      setAriaNow(cur);
      return { cur, min, max };
    };

    const setWidth = (px: number) => {
      const { min, max } = getWidths();
      const clamped = Math.max(min, Math.min(max, px));
      setSideWidth(side, clamped);
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const { cur } = getWidths();
      startX = e.clientX;
      startWidth = cur;
      dragging = true;

      try {
        // AIDEV-NOTE: Capture pointer to ensure consistent move events during drag
        el.setPointerCapture(e.pointerId);
      } catch {}
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
      if (!frameRequested) {
        frameRequested = true;
        requestAnimationFrame(() => {
          frameRequested = false;
          const next = side === 'left' ? startWidth + pendingDelta : startWidth - pendingDelta;
          setWidth(next);
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
          setWidth(next);
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
      document.documentElement.style.cursor = '';
      document.documentElement.style.userSelect = '';
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyCancel);
      dragging = false;
      document.documentElement.style.cursor = '';
      document.documentElement.style.userSelect = '';
    };

    const onKeyCancel = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // AIDEV-NOTE: Escape cancels in-progress drag and restores start width.
      if (!dragging) return;
      setWidth(startWidth);
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
    window.addEventListener('main-layout-widths', onWidthsEvent as EventListener);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('pointerup', onPointerUp as EventListener);
      window.removeEventListener('pointercancel', onPointerUp as EventListener);
      window.removeEventListener('mouseup', onMouseUp as EventListener);
      window.removeEventListener('keydown', onKeyCancel);
      window.removeEventListener('main-layout-widths', onWidthsEvent as EventListener);
    };
  }, [setSideWidth, side]);

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const allowed = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!allowed.includes(e.key)) return;
    const step = e.shiftKey ? 50 : 10;
    const cs = getComputedStyle(document.documentElement);
    const cur = parseInt(cs.getPropertyValue(
      side === 'left' ? '--main-layout-left-panel-width' : '--main-layout-right-panel-width'
    ));
    const min = parseInt(cs.getPropertyValue('--main-layout-panel-min-width'));
    const max = parseInt(cs.getPropertyValue('--main-layout-panel-max-width'));

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
      className={styles['handle']}
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
        // AIDEV-NOTE: Double-click to expand collapsed panels or reset only this panel to default if already expanded.
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
