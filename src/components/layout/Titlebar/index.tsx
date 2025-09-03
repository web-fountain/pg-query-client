'use client';

import styles                               from './styles.module.css';
import Icon                                 from '../../Icons';
import { useOpSpaceLayout }                 from '../OpSpaceProvider';


function Titlebar() {
  const layout   = useOpSpaceLayout();
  const left     = layout.getConfig('left');
  const right    = layout.getConfig('right');
  const swapped  = layout.isContentSwapped();

  // AIDEV-NOTE: When swapped, visual left is logical right (and vice versa).
  // Map controls to visual sides so the buttons always operate the visible panel.
  const visualLeft  = swapped ? right : left;
  const visualRight = swapped ? left : right;
  const leftButtonControlsSide  = swapped ? 'right' : 'left' as const;
  const rightButtonControlsSide = swapped ? 'left' : 'right' as const;

  return (
    <header className={styles['titlebar']}>
      <div className={styles['title']}>PG Query Client</div>

      <div className={styles['controls']}>
        <button
          className={styles['button']}
          aria-pressed={visualLeft.collapsed}
          aria-label={visualLeft.collapsed ? 'Expand left panel' : 'Collapse left panel'}
          onClick={() => layout.toggleCollapseSide(leftButtonControlsSide)}
          title={visualLeft.collapsed ? 'Expand left panel' : 'Collapse left panel'}
        >
          <Icon
            name={visualLeft.collapsed ? 'panel-layout-left' : 'panel-layout-left-solid'}
            aria-hidden="true"
          />
        </button>

        <button
          className={styles['button']}
          aria-pressed={swapped}
          aria-label={swapped ? 'Unswap panels' : 'Swap left/right panels'}
          onClick={() => layout.swapSides()}
          title={swapped ? 'Unswap panels' : 'Swap left/right panels'}
        >
          <Icon name="arrows-left-right" aria-hidden="true" />
        </button>

        <button
          className={styles['button']}
          aria-pressed={visualRight.collapsed}
          aria-label={visualRight.collapsed ? 'Expand right panel' : 'Collapse right panel'}
          onClick={() => layout.toggleCollapseSide(rightButtonControlsSide)}
          title={visualRight.collapsed ? 'Expand right panel' : 'Collapse right panel'}
        >
          <Icon
            name={visualRight.collapsed ? 'panel-layout-right' : 'panel-layout-right-solid'}
            aria-hidden="true"
          />
        </button>
      </div>
    </header>
  );
}


export default Titlebar;
