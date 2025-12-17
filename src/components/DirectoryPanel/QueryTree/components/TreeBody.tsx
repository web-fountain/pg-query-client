'use client';

import type { ReactNode } from 'react';
import type { TreeApi }   from '../types';
import styles             from '../styles.module.css';


type Props = {
  tree          : TreeApi<unknown>;
  label         : string;
  scrollerRef   : React.RefObject<HTMLDivElement | null>;
  isTreeFocused : boolean;
  onTreeFocus   : () => void;
  children      : ReactNode;
};

function TreeBody({ tree, label, scrollerRef, isTreeFocused, onTreeFocus, children }: Props) {
  // AIDEV-NOTE: Apply getContainerProps to the scroll host so the library observes scroll/size and binds roles/handlers.
  const rawContainerProps = tree.getContainerProps?.(`${label} Tree`) ?? {};
  const {
    style     : containerStyle,
    className : containerClassName,
    onFocus   : containerOnFocus,
    onBlur    : containerOnBlur,
    ref       : containerRef,
    ...containerAriaAndHandlers
  } = (rawContainerProps as any);

  const scrollerBridgeRef = (el: HTMLDivElement | null) => {
    scrollerRef.current = el;
    try {
      const r = containerRef;
      if (typeof r === 'function') r(el);
      else if (r && 'current' in r) (r as any).current = el;
    } catch {}
  };

  const mergedScrollerClass = `${(containerClassName ?? '')} ${styles['scroller']} ${styles['list']}`.trim();

  const handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    try { containerOnFocus?.(e as any); } catch {}
    try {
      if ((e.currentTarget as HTMLElement).matches('[data-scrollable]')) {
        onTreeFocus();
      }
    } catch {}
  };

  // AIDEV-NOTE: We no longer reset isTreeFocused on blur; instead we use a document
  // mousedown listener to detect clicks outside the section.
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    try { containerOnBlur?.(e as any); } catch {}
  };

  return (
    <div className={styles['content']}>
      <div
        {...containerAriaAndHandlers}
        ref={scrollerBridgeRef}
        className={mergedScrollerClass}
        style={containerStyle}
        data-scrollable
        data-focused={isTreeFocused ? 'true' : 'false'}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        {children}
      </div>
    </div>
  );
}


export default TreeBody;
