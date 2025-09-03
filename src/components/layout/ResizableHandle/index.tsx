'use client';

import { useRef }  from 'react';

import { useOpSpaceLayout }                 from '../OpSpaceProvider';
import { useDragResize, useSeparatorAria }  from './hooks';
import { clamp }                            from './utils/math';
import { readMinMax, readCurrentWidth }     from './utils/cssVars';
import styles                               from './styles.module.css';


function ResizableHandle({ side }: { side: 'left' | 'right' }) {
  const { ariaMin, ariaMax, ariaNow, setAriaNow, controlledId } = useSeparatorAria(side);
  const layoutCtx = useOpSpaceLayout();
  const leftCfg   = layoutCtx.getConfig('left');
  const rightCfg  = layoutCtx.getConfig('right');
  const swapped   = layoutCtx.isContentSwapped();
  const actualDragOccurred  = useRef(false);
  const ref                 = useRef<HTMLDivElement>(null);

  const setSideWidth = (s: 'left' | 'right', px: number) => layoutCtx.setSideWidth(s, px);
  const expandSide   = (s: 'left' | 'right') => layoutCtx.expandSide(s);
  const collapseSide = (s: 'left' | 'right') => layoutCtx.collapseSide(s);

  // AIDEV-NOTE: Anchoring logic so drag direction matches visual layout when swapped
  // - Not swapped: left panel anchored on right edge; right panel anchored on left edge
  // - Swapped:     left panel anchored on left edge;  right panel anchored on right edge
  const anchoredOnRight = swapped ? (side === 'right') : (side === 'left');

  useDragResize({ ref, side, setSideWidth, expandSide, collapseSide, setAriaNow, controlledId, anchoredOnRight });

  const onKeyDown = (evt: React.KeyboardEvent<HTMLDivElement>) => {
    const allowed = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];

    if (!allowed.includes(evt.key)) return;

    const step = evt.shiftKey ? 50 : 10;
    const { min, max } = readMinMax();
    const cur = readCurrentWidth(side);

    let next = cur;
    if (evt.key === 'Home') next = min;
    else if (evt.key === 'End') next = max;
    else {
      // AIDEV-NOTE: Keyboard mirrors drag orientation using visual anchoring
      const delta = (evt.key === 'ArrowRight'
        ? (anchoredOnRight ? +step : -step)
        : (anchoredOnRight ? -step : +step)
      );
      next = clamp(cur + delta, min, max);
    }
    setSideWidth(side, next);
    evt.preventDefault();
  };

  const isCollapsed = (side === 'left' ? leftCfg : rightCfg).collapsed;

  // Reset to the initial width for this side
  const resetThisPanel = () => {
    const cfg = side === 'left' ? leftCfg : rightCfg;
    setSideWidth(side, cfg.initialWidth);
  };

  return (
    <div
      ref={ref}
      className={`
        ${styles['handle']}
        ${isCollapsed
          ? (side === 'left' ? styles['collapsed-left'] : styles['collapsed-right'])
          : ''
        }
      `}
      data-side={side}
      role="separator"
      aria-orientation="vertical"
      tabIndex={0}
      aria-valuemin={ariaMin}
      aria-valuemax={ariaMax}
      aria-valuenow={ariaNow}
      aria-label={side === 'left' ? 'Resize left panel' : 'Resize right panel'}
      aria-controls={controlledId}
      onDoubleClick={() => {
        // Don't reset if user was actually dragging
        if (actualDragOccurred.current) return;

        if (isCollapsed) {
          expandSide(side);
        } else {
          resetThisPanel();
        }
      }}
      onKeyDown={onKeyDown}
    />
  );
}


export default ResizableHandle;
