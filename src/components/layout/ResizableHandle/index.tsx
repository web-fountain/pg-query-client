'use client';

import { useEffect, useRef, useState }  from 'react';
import { useMainLayout }      from '../MainLayoutProvider';
import styles                 from './styles.module.css';


type Props = { side: 'left' | 'right' };

function ResizableHandle({ side }: Props) {
  const {
    setLeftWidth, setRightWidth, resetWidths, leftCollapsed,
    rightCollapsed, expandLeft, expandRight, swapped
  } = useMainLayout();
  const ref = useRef<HTMLDivElement>(null);
  const [ariaMin, setAriaMin] = useState<number | undefined>(undefined);
  const [ariaMax, setAriaMax] = useState<number | undefined>(undefined);
  const [ariaNow, setAriaNow] = useState<number | undefined>(undefined);

  // AIDEV-NOTE: Determine which panel this handle actually controls based on swap state
  const effectiveSide = swapped
    ? (side === 'left' ? 'right' : 'left')
    : side;

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
        effectiveSide === 'left' ? '--main-layout-left-panel-width' : '--main-layout-right-panel-width'
      );
      const parsed = parseInt(raw);
      const cur = parsed;
      const min = parseInt(cs.getPropertyValue('--main-layout-panel-min-width'));
      const max = parseInt(cs.getPropertyValue('--main-layout-panel-max-width'));
      // AIDEV-NOTE: keep local ARIA state aligned with CSS vars on read
      setAriaMin(min);
      setAriaMax(max);
      setAriaNow(cur);
      return { cur, min, max };
    };

    const setWidth = (px: number) => {
      const { min, max } = getWidths();
      const clamped = Math.max(min, Math.min(max, px));
      if (effectiveSide === 'left') setLeftWidth(clamped);
      else setRightWidth(clamped);
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const { cur } = getWidths();
      startX = e.clientX;
      startWidth = cur;
      dragging = true;
      document.documentElement.style.cursor = 'col-resize';
      document.documentElement.style.userSelect = 'none';
      const supportsPointer = 'PointerEvent' in window;
      if (supportsPointer) {
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp as EventListener, { once: true });
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
          const next = effectiveSide === 'left' ? startWidth + pendingDelta : startWidth - pendingDelta;
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
          const next = effectiveSide === 'left' ? startWidth + pendingDelta : startWidth - pendingDelta;
          setWidth(next);
        });
      }
    };

    const onPointerUp = (e?: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('mousemove', onMouseMove);
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
      setAriaNow(effectiveSide === 'left' ? detail.lw : detail.rw);
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
      window.removeEventListener('mouseup', onMouseUp as EventListener);
      window.removeEventListener('keydown', onKeyCancel);
      window.removeEventListener('main-layout-widths', onWidthsEvent as EventListener);
    };
  }, [setLeftWidth, setRightWidth, effectiveSide, leftCollapsed, rightCollapsed, expandLeft, expandRight]);

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const allowed = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!allowed.includes(e.key)) return;
    const step = e.shiftKey ? 50 : 10;
    const cs = getComputedStyle(document.documentElement);
    const cur = parseInt(cs.getPropertyValue(
      effectiveSide === 'left' ? '--main-layout-left-panel-width' : '--main-layout-right-panel-width'
    ));
    const min = parseInt(cs.getPropertyValue('--main-layout-panel-min-width'));
    const max = parseInt(cs.getPropertyValue('--main-layout-panel-max-width'));

    let next = cur;
    if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else {
      const delta = (e.key === 'ArrowRight' ? (effectiveSide === 'left' ? +step : -step)
                                            : (effectiveSide === 'left' ? -step : +step));
      next = Math.max(min, Math.min(max, cur + delta));
    }
    if (effectiveSide === 'left') setLeftWidth(next);
    else setRightWidth(next);
    e.preventDefault();
  };

  // AIDEV-NOTE: Determine which collapse state and expand function to use based on effective side
  const isCollapsed = effectiveSide === 'left' ? leftCollapsed : rightCollapsed;
  const expandFunction = effectiveSide === 'left' ? expandLeft : expandRight;

  // AIDEV-NOTE: Reset only the specific panel this handle controls
  const resetThisPanel = () => {
    if (effectiveSide === 'left') {
      setLeftWidth(320); // Default left panel width
    } else {
      setRightWidth(360); // Default right panel width
    }
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
      aria-label={effectiveSide === 'left' ? 'Resize left panel' : 'Resize right panel'}
      onDoubleClick={() => {
        // AIDEV-NOTE: Double-click to expand collapsed panels or reset only this panel to default if already expanded.
        if (isCollapsed) {
          expandFunction();
        } else {
          resetThisPanel();
        }
      }}
    />
  );
}


export default ResizableHandle;
