'use client';

import { useRef }  from 'react';

import { useOpSpaceLayout }                 from '../OpSpaceProvider';
import { useDragResize, useSeparatorAria }  from './hooks';
import { clamp }                            from './utils/math';
import styles                               from './styles.module.css';


function ResizableHandle({ side }: { side: 'left' | 'right' }) {
  const layoutCtx = useOpSpaceLayout();
  const leftCfg  = layoutCtx.getConfig('left');
  const rightCfg = layoutCtx.getConfig('right');
  const { ariaMin, ariaMax, ariaNow, setAriaNow, controlledId } = useSeparatorAria(side);
  const actualDragOccurred  = useRef(false);
  const ref                 = useRef<HTMLDivElement>(null);

  const setSideWidth = (s: 'left' | 'right', px: number) => layoutCtx.setSideWidth(s, px);
  const expandSide   = (s: 'left' | 'right') => layoutCtx.expandSide(s);
  const collapseSide = (s: 'left' | 'right') => layoutCtx.collapseSide(s);

  useDragResize({ ref, side, setSideWidth, expandSide, collapseSide, setAriaNow, controlledId });

  const onKeyDown = (evt: React.KeyboardEvent<HTMLDivElement>) => {
    const allowed = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];

    if (!allowed.includes(evt.key)) return;

    const step = evt.shiftKey ? 50 : 10;
    const cs = getComputedStyle(document.documentElement);
    const cur = parseInt(cs.getPropertyValue(
      side === 'left' ? '--op-space-layout-left-panel-width' : '--op-space-layout-right-panel-width'
    ));
    const min = parseInt(cs.getPropertyValue('--op-space-layout-panel-min-width'));
    const max = parseInt(cs.getPropertyValue('--op-space-layout-panel-max-width'));

    let next = cur;
    if (evt.key === 'Home') next = min;
    else if (evt.key === 'End') next = max;
    else {
      const delta = (evt.key === 'ArrowRight'
        ? (side === 'left' ? +step : -step)
        : (side === 'left' ? -step : +step)
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
