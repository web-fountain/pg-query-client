'use client';

import { useMainLayout } from '../MainLayoutProvider';
import styles from './styles.module.css';


function Header() {
  const {
    leftCollapsed, rightCollapsed, swapped,
    toggleLeft, toggleRight, toggleSwap, resetWidths
  } = useMainLayout();

  return (
    <header className={styles['header']}>
      <div className={styles['title']}>PG Query Client</div>

      <div className={styles['controls']}>
        <button
          className={styles['button']}
          aria-pressed={leftCollapsed}
          onClick={toggleLeft}
          title={leftCollapsed ? 'Expand left panel' : 'Collapse left panel'}
        >
          {leftCollapsed ? '⟨⟩' : '⟨|' }
        </button>

        <button
          className={styles['button']}
          aria-pressed={swapped}
          onClick={toggleSwap}
          title={swapped ? 'Unswap panels' : 'Swap left/right panels'}
        >
          ⇄
        </button>

        <button
          className={styles['button']}
          aria-pressed={rightCollapsed}
          onClick={toggleRight}
          title={rightCollapsed ? 'Expand right panel' : 'Collapse right panel'}
        >
          {rightCollapsed ? '⟨⟩' : '|⟩'}
        </button>

        <div className={styles['divider']} aria-hidden />

        <button
          className={styles['button']}
          onClick={resetWidths}
          title="Reset panel widths"
        >
          ⤾
        </button>
      </div>
    </header>
  );
}


export default Header;
