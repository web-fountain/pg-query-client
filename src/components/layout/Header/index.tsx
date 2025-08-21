'use client';

import { useMainLayout } from '../MainLayoutProvider';
import styles from './styles.module.css';


function Header() {
  const {
    leftCollapsed, rightCollapsed, swapped,
    toggleLeft, toggleRight, toggleSwap, resetWidths
  } = useMainLayout();

  // AIDEV-NOTE: When swapped, the visual left side shows the right panel and vice versa
  // So we need to adjust button states and actions to match the visual layout
  const visualLeftCollapsed = swapped ? rightCollapsed : leftCollapsed;
  const visualRightCollapsed = swapped ? leftCollapsed : rightCollapsed;
  const visualToggleLeft = swapped ? toggleRight : toggleLeft;
  const visualToggleRight = swapped ? toggleLeft : toggleRight;

  return (
    <header className={styles['header']}>
      <div className={styles['title']}>PG Query Client</div>

      <div className={styles['controls']}>
        <button
          className={styles['button']}
          aria-pressed={visualLeftCollapsed}
          onClick={visualToggleLeft}
          title={visualLeftCollapsed ? 'Expand left panel' : 'Collapse left panel'}
        >
          {visualLeftCollapsed ? '⟨⟩' : '⟨|' }
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
          aria-pressed={visualRightCollapsed}
          onClick={visualToggleRight}
          title={visualRightCollapsed ? 'Expand right panel' : 'Collapse right panel'}
        >
          {visualRightCollapsed ? '⟨⟩' : '|⟩'}
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
