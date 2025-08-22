'use client';

import { useOpSpaceLayout }  from '../OpSpaceProvider';
import styles             from './styles.module.css';
import Icon               from '../../Icons';


function Titlebar() {
  const { getConfig, toggleCollapseSide, swapSides, isContentSwapped } = useOpSpaceLayout();
  // AIDEV-NOTE: Direct side controls; no visual remap
  const left    = getConfig('left');
  const right   = getConfig('right');
  const swapped = isContentSwapped();

  return (
    <header className={styles['titlebar']}>
      <div className={styles['title']}>PG Query Client</div>

      <div className={styles['controls']}>
        <button
          className={styles['button']}
          aria-pressed={left.collapsed}
          aria-label={left.collapsed ? 'Expand left panel' : 'Collapse left panel'}
          onClick={() => toggleCollapseSide('left')}
          title={left.collapsed ? 'Expand left panel' : 'Collapse left panel'}
        >
          <Icon
            name={left.collapsed ? 'panel-layout-left' : 'panel-layout-left-solid'}
            aria-hidden="true"
          />
        </button>

        <button
          className={styles['button']}
          aria-pressed={swapped}
          aria-label={swapped ? 'Unswap panels' : 'Swap left/right panels'}
          onClick={swapSides}
          title={swapped ? 'Unswap panels' : 'Swap left/right panels'}
        >
          <Icon name="arrows-left-right" aria-hidden="true" />
        </button>

        <button
          className={styles['button']}
          aria-pressed={right.collapsed}
          aria-label={right.collapsed ? 'Expand right panel' : 'Collapse right panel'}
          onClick={() => toggleCollapseSide('right')}
          title={right.collapsed ? 'Expand right panel' : 'Collapse right panel'}
        >
          <Icon
            name={right.collapsed ? 'panel-layout-right' : 'panel-layout-right-solid'}
            aria-hidden="true"
          />
        </button>
      </div>
    </header>
  );
}


export default Titlebar;
