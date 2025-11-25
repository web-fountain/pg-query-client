import { useLayoutEffect, useRef } from 'react';


// AIDEV-NOTE: useEvent returns a stable function whose inner logic always sees latest handler
function useEvent<T extends (...args: any[]) => any>(handler: T): T {
  const handlerRef = useRef<T>(handler);
  useLayoutEffect(() => { handlerRef.current = handler; });
  const stableRef = useRef<T | null>(null);
  if (!stableRef.current) {
    stableRef.current = ((...args: Parameters<T>) => handlerRef.current!(...args)) as T;
  }
  return stableRef.current as T;
}


export { useEvent };
