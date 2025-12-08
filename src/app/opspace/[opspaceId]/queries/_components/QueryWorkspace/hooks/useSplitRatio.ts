import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_RATIO,
  MAX_RATIO,
  MIN_RATIO,
  STORAGE_KEY_SPLIT
} from '@Constants';


function useSplitRatio() {
  const [ratio, setRatio] = useState<number>(DEFAULT_RATIO);
  const ratioRef = useRef<number>(ratio);

  useEffect(() => { ratioRef.current = ratio; }, [ratio]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_SPLIT);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const r = typeof parsed?.ratio === 'number' ? parsed.ratio : null;
      if (r !== null && !Number.isNaN(r)) {
        const clamped = Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));
        setRatio(clamped);
      }
    } catch {}
  }, []);

  const commit = useCallback((next: number) => {
    const clamped = Math.min(MAX_RATIO, Math.max(MIN_RATIO, next));
    setRatio(clamped);
    try { window.localStorage.setItem(STORAGE_KEY_SPLIT, JSON.stringify({ ratio: clamped })); } catch {}
  }, []);

  return { ratio, setRatio: commit, ratioRef } as const;
}


export { useSplitRatio };
