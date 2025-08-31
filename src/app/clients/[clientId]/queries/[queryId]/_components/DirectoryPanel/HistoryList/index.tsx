'use client';

import { memo } from 'react';

import Icon     from '@Components/Icons';
import styles   from './styles.module.css';

// AIDEV-NOTE: Minimal history list stub. Future: wire to execution records/selectors.

type HistoryItem = {
  id: string;
  title: string;
  timestamp: string;
};

const HistoryList = memo(function HistoryList() {
  // AIDEV-TODO: Replace with real data from store/selectors when available.
  const items: HistoryItem[] = [];

  if (!items.length) {
    return (
      <div className={styles['empty']}>
        <Icon name="inbox" aria-hidden="true" />
        <p className={styles['empty-text']}>Executed queries will appear here</p>
      </div>
    );
  }

  return (
    <ul className={styles['list']}>
      {items.map((it) => (
        <li key={it.id} className={styles['row']}>
          <span className={styles['title']} title={it.title}>{it.title}</span>
          <time className={styles['time']} dateTime={it.timestamp}>{it.timestamp}</time>
        </li>
      ))}
    </ul>
  );
});


export default HistoryList;
