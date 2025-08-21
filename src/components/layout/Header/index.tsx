'use client';

import { useMainLayout } from '../MainLayoutProvider';
import styles from './styles.module.css';


function Header() {
  const { getConfig, toggleCollapseSide, swapSides, resetBothSides, isContentSwapped } = useMainLayout();
  // AIDEV-NOTE: Direct side controls; no visual remap
  const left    = getConfig('left');
  const right   = getConfig('right');
  const swapped = isContentSwapped();

  return (
    <header className={styles['header']}>
      <div className={styles['title']}>PG Query Client</div>

      <div className={styles['controls']}>
        <button
          className={styles['button']}
          aria-pressed={left.collapsed}
          onClick={() => toggleCollapseSide('left')}
          title={left.collapsed ? 'Expand left panel' : 'Collapse left panel'}
        >
          {left.collapsed ? '⟨⟩' : '⟨|' }
        </button>

        <button
          className={styles['button']}
          aria-pressed={swapped}
          onClick={swapSides}
          title={swapped ? 'Unswap panels' : 'Swap left/right panels'}
        >
          ⇄
        </button>

        <button
          className={styles['button']}
          aria-pressed={right.collapsed}
          onClick={() => toggleCollapseSide('right')}
          title={right.collapsed ? 'Expand right panel' : 'Collapse right panel'}
        >
          {right.collapsed ? '⟨⟩' : '|⟩'}
        </button>

        <div className={styles['divider']} aria-hidden />

        <button
          className={styles['button']}
          onClick={resetBothSides}
          title="Reset panel widths"
        >
          ⤾
        </button>
      </div>
    </header>
  );
}


export default Header;
