'use client';

import styles                               from './styles.module.css';
import Icon                                 from '../../Icons';
import { useOpSpaceLayout }                 from '../OpSpaceProvider';


function Titlebar() {
  const layout   = useOpSpaceLayout();
  const left     = layout.getConfig('left');
  const right    = layout.getConfig('right');
  const swapped  = layout.isContentSwapped();

  return (
    <header className={styles['titlebar']}>
      <div className={styles['title']}>PG Query Client</div>

      <div className={styles['controls']}>
        <button
          className={styles['button']}
          aria-pressed={left.collapsed}
          aria-label={left.collapsed ? 'Expand left panel' : 'Collapse left panel'}
          onClick={() => layout.toggleCollapseSide('left')}
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
          onClick={() => layout.swapSides()}
          title={swapped ? 'Unswap panels' : 'Swap left/right panels'}
        >
          <Icon name="arrows-left-right" aria-hidden="true" />
        </button>

        <button
          className={styles['button']}
          aria-pressed={right.collapsed}
          aria-label={right.collapsed ? 'Expand right panel' : 'Collapse right panel'}
          onClick={() => layout.toggleCollapseSide('right')}
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
