'use client';

import { useEffect, useRef }  from 'react';
import { useMainLayout }      from '../MainLayoutProvider';
import styles                 from './styles.module.css';


type Props = { side: 'left' | 'right' };

function ResizableHandle({ side }: Props) {
  const { setLeftWidth, setRightWidth } = useMainLayout();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startWidth = 0;

    const getWidths = () => {
      const cs = getComputedStyle(document.documentElement);
      const cur = parseInt(cs.getPropertyValue(
        side === 'left' ? '--main-layout-left-panel-width' : '--main-layout-right-panel-width'
      ));
      const min = parseInt(cs.getPropertyValue('--main-layout-panel-min-width')) || 200;
      const max = parseInt(cs.getPropertyValue('--main-layout-panel-max-width')) || 600;
      return { cur, min, max };
    };

    const setWidth = (px: number) => {
      const { min, max } = getWidths();
      const clamped = Math.max(min, Math.min(max, px));
      if (side === 'left') setLeftWidth(clamped);
      else setRightWidth(clamped);
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const { cur } = getWidths();
      startX = e.clientX;
      startWidth = cur;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp, { once: true });
    };

    const onPointerMove = (e: PointerEvent) => {
      const delta = e.clientX - startX;
      const next = side === 'left' ? startWidth + delta : startWidth - delta;
      setWidth(next);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
    };

    el.addEventListener('pointerdown', onPointerDown);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [setLeftWidth, setRightWidth, side]);

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const step = e.shiftKey ? 50 : 10;
    const cs = getComputedStyle(document.documentElement);
    const cur = parseInt(cs.getPropertyValue(
      side === 'left' ? '--main-layout-left-panel-width' : '--main-layout-right-panel-width'
    ));
    const min = parseInt(cs.getPropertyValue('--main-layout-panel-min-width')) || 200;
    const max = parseInt(cs.getPropertyValue('--main-layout-panel-max-width')) || 600;
    const delta = (e.key === 'ArrowRight' ? (side === 'left' ? +step : -step)
                                          : (side === 'left' ? -step : +step));
    const next = Math.max(min, Math.min(max, cur + delta));
    if (side === 'left') setLeftWidth(next);
    else setRightWidth(next);
    e.preventDefault();
  };

  return (
    <div
      ref={ref}
      className={styles['handle']}
      role="separator"
      aria-orientation="vertical"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={side === 'left' ? 'Resize left panel' : 'Resize right panel'}
    />
  );
}


export default ResizableHandle;
