'use client';

import { useEffect, useRef } from 'react';


type Props = {
  containerRef        : React.RefObject<HTMLElement | null>;
  getRatio            : () => number;
  onChangeImmediate   : (ratio: number) => void;
  onCommit            : (ratio: number) => void;
  minRatio?           : number;
  maxRatio?           : number;
  defaultRatio?       : number;
  className?          : string;
  ariaLabel?          : string;
};

function VerticalHandle({
  containerRef,
  getRatio,
  onChangeImmediate,
  onCommit,
  minRatio = 0.2,
  maxRatio = 0.9,
  defaultRatio = 0.5,
  className,
  ariaLabel = 'Resize editor and results panels'
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handle = ref.current;
    const root = containerRef.current as HTMLElement | null;
    if (!handle || !root) return;

    const supportsPointer = 'PointerEvent' in window;

    let startY = 0;
    let startRatio = getRatio();
    let containerHeight = 1;
    let frame = 0;
    let nextRatio: number | undefined;
    let activePointerId: number | null = null;
    let dragging = false;

    const clamp = (v: number) => Math.min(maxRatio, Math.max(minRatio, v));

    const finishDrag = () => {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener('pointermove', onPointerMove as EventListener, { capture: true } as any);
      document.removeEventListener('pointerup', onPointerUp as EventListener, { capture: true } as any);
      document.removeEventListener('pointercancel', onPointerCancel as EventListener, { capture: true } as any);
      document.removeEventListener('mousemove', onMouseMove as EventListener, { capture: true } as any);
      document.removeEventListener('mouseup', onMouseUp as EventListener, { capture: true } as any);
      document.removeEventListener('keydown', onKeyCancel as EventListener);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.documentElement.style.cursor = '';
      document.documentElement.style.userSelect = '';
      if (typeof nextRatio === 'number') onCommit(nextRatio);
      nextRatio = undefined;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (activePointerId !== null) {
        try { handle.releasePointerCapture(activePointerId); } catch {}
        activePointerId = null;
      }
    };

    const applyImmediate = (r: number) => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => onChangeImmediate(r));
    };

    const handleMove = (clientY: number) => {
      const dy = clientY - startY;
      const next = clamp(startRatio + dy / containerHeight);
      nextRatio = next;
      applyImmediate(next);
    };

    const onPointerMove = (evt: PointerEvent) => {
      if (!dragging) return;
      if (activePointerId !== null && evt.pointerId !== activePointerId) return;
      handleMove(evt.clientY);
    };
    const onMouseMove = (evt: MouseEvent) => {
      if (!dragging) return;
      if (activePointerId !== null) return;
      handleMove(evt.clientY);
    };
    const onPointerUp = () => finishDrag();
    const onMouseUp = () => finishDrag();
    const onPointerCancel = () => finishDrag();
    const onKeyCancel = (evt: KeyboardEvent) => { if (evt.key === 'Escape') finishDrag(); };
    const onWindowBlur = () => finishDrag();
    const onVisibilityChange = () => { if (document.hidden) finishDrag(); };

    const onPointerDown = (evt: PointerEvent) => {
      evt.preventDefault();
      const bounds = root.getBoundingClientRect();
      if (evt.clientY < bounds.top || evt.clientY > bounds.bottom) return;
      if (dragging) return;
      startY = evt.clientY;
      startRatio = getRatio();
      containerHeight = bounds.height || 1;
      dragging = true;
      activePointerId = evt.pointerId;
      document.documentElement.style.cursor = 'row-resize';
      document.documentElement.style.userSelect = 'none';
      try { handle.setPointerCapture(evt.pointerId); } catch {}
      document.addEventListener('pointermove', onPointerMove as EventListener, { capture: true });
      document.addEventListener('pointerup', onPointerUp as EventListener, { capture: true, once: true });
      document.addEventListener('pointercancel', onPointerCancel as EventListener, { capture: true, once: true });
      document.addEventListener('keydown', onKeyCancel as EventListener);
      window.addEventListener('blur', onWindowBlur);
      document.addEventListener('visibilitychange', onVisibilityChange);
    };

    const onMouseDown = (evt: MouseEvent) => {
      if (supportsPointer) return;
      evt.preventDefault();
      const bounds = root.getBoundingClientRect();
      if (evt.clientY < bounds.top || evt.clientY > bounds.bottom) return;
      if (dragging) return;
      startY = evt.clientY;
      startRatio = getRatio();
      containerHeight = bounds.height || 1;
      dragging = true;
      document.documentElement.style.cursor = 'row-resize';
      document.documentElement.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove as EventListener, { capture: true });
      document.addEventListener('mouseup', onMouseUp as EventListener, { capture: true, once: true });
      document.addEventListener('keydown', onKeyCancel as EventListener);
      window.addEventListener('blur', onWindowBlur);
      document.addEventListener('visibilitychange', onVisibilityChange);
    };

    if (supportsPointer) handle.addEventListener('pointerdown', onPointerDown as EventListener);
    else handle.addEventListener('mousedown', onMouseDown as EventListener);

    const onDblClick = () => {
      const cur = getRatio();
      if (Math.abs(cur - defaultRatio) < 0.0001) return;
      applyImmediate(defaultRatio);
      onCommit(defaultRatio);
    };
    handle.addEventListener('dblclick', onDblClick);

    return () => {
      if (dragging) finishDrag();
      if (supportsPointer) handle.removeEventListener('pointerdown', onPointerDown as EventListener);
      else handle.removeEventListener('mousedown', onMouseDown as EventListener);
      handle.removeEventListener('dblclick', onDblClick);
      document.removeEventListener('pointermove', onPointerMove as EventListener, { capture: true } as any);
      document.removeEventListener('pointerup', onPointerUp as EventListener, { capture: true } as any);
      document.removeEventListener('pointercancel', onPointerCancel as EventListener, { capture: true } as any);
      document.removeEventListener('mousemove', onMouseMove as EventListener, { capture: true } as any);
      document.removeEventListener('mouseup', onMouseUp as EventListener, { capture: true } as any);
      document.removeEventListener('keydown', onKeyCancel as EventListener);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [containerRef, getRatio, onChangeImmediate, onCommit, minRatio, maxRatio, defaultRatio]);

  const ratio = getRatio();
  const ariaMin = Math.round((minRatio || 0) * 100);
  const ariaMax = Math.round((maxRatio || 1) * 100);
  const ariaNow = Math.round(ratio * 100);

  return (
    <div
      ref={ref}
      className={className}
      role="separator"
      aria-orientation="horizontal"
      aria-valuemin={ariaMin}
      aria-valuemax={ariaMax}
      aria-valuenow={ariaNow}
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={(e) => {
        const key = e.key;
        let next: number | null = null;
        if (key === 'ArrowUp') { e.preventDefault(); next = Math.min(maxRatio, Math.max(minRatio, ratio + 0.02)); }
        else if (key === 'ArrowDown') { e.preventDefault(); next = Math.min(maxRatio, Math.max(minRatio, ratio - 0.02)); }
        else if (key === 'Home') { e.preventDefault(); next = minRatio; }
        else if (key === 'End') { e.preventDefault(); next = maxRatio; }
        if (next !== null && Math.abs(next - ratio) > 0.0001) {
          onChangeImmediate(next);
          onCommit(next);
        }
      }}
    />
  );
}


export default VerticalHandle;
