'use client';

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';


type Result = {
  sectionRef        : React.RefObject<HTMLElement | null>;
  isTreeFocused     : boolean;
  setIsTreeFocused  : (v: boolean | ((prev: boolean) => boolean)) => void;
  markTreeFocused   : () => void;
};

function useQueryTreeFocus(): Result {
  // AIDEV-NOTE: Ref for the section element, used to detect clicks outside the tree.
  const sectionRef = useRef<HTMLElement | null>(null);

  // AIDEV-NOTE: Track whether the user has selected a row in this tree section.
  // This state drives toolbar visibility when the mouse leaves but the user hasn't
  // clicked outside the tree section yet.
  const [isTreeFocused, setIsTreeFocused] = useState<boolean>(false);

  // AIDEV-NOTE: Stable callback to avoid breaking Row memo
  const markTreeFocused = useCallback(() => setIsTreeFocused(true), []);

  // AIDEV-NOTE: Listen for mousedown outside the tree section to clear the focused state.
  // This is more robust than blur events which can fire unexpectedly during navigation.
  const handleMouseDown = useEffectEvent((e: MouseEvent) => {
    const section = sectionRef.current;
    if (!section) return;

    const target = e.target as Node | null;
    if (!target) return;

    // Check if click is outside the tree section
    if (!section.contains(target)) {
      setIsTreeFocused(false);
    }
  });

  useEffect(() => {
    document.addEventListener('mousedown', handleMouseDown, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, [handleMouseDown]);

  return { sectionRef, isTreeFocused, setIsTreeFocused, markTreeFocused };
}


export { useQueryTreeFocus };
