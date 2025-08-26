import { useEffect, useMemo, useRef } from 'react';


// AIDEV-NOTE: Returns a stable debounced function; latest fn is called; cleans up on unmount
type Debounced<T extends (...args: any[]) => void> = ((...args: Parameters<T>) => void) & {
  cancel: () => void;
  flush: (...args: Parameters<T>) => void;
};

function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay: number) {
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; }, [fn]);

  const timerRef = useRef<number | null>(null);

  const debounced = useMemo<Debounced<T>>(() => {
    const wrapped: Debounced<T> = ((...args: Parameters<T>) => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        fnRef.current(...args);
      }, delay);
    }) as unknown as Debounced<T>;

    wrapped.cancel = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    wrapped.flush = (...args: Parameters<T>) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      fnRef.current(...args);
    };
    return wrapped;
  }, [delay]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  return debounced;
}

// AIDEV-NOTE: Returns a debounced value that updates after delay
function useDebouncedValue<T>(value: T, delay: number): T {
  const stateRef = useRef(value);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      stateRef.current = value;
    }, delay);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [value, delay]);

  // read-through value (note: not state; use only where reads are on interaction)
  return stateRef.current;
}


export { useDebouncedCallback, useDebouncedValue };
