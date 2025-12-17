'use client';

import { useEffect, useEffectEvent, useRef } from 'react';


type Args = {
  sectionRef                : React.RefObject<HTMLElement | null>;
  selectTreeItem            : (nodeId: string) => void;
  clearSelectionToRoot      : () => void;
  scrollSelectedRowIntoView : () => void;
  createRootFileDraft       : () => void;
  draftFolderRef            : React.RefObject<{ nodeId?: string } | null>;
  draftFileRef              : React.RefObject<{ nodeId?: string } | null>;
};

type Result = {
  onClickCapture        : (e: React.MouseEvent<HTMLElement>) => void;
  onDoubleClickCapture  : (e: React.MouseEvent<HTMLElement>) => void;
};

function useQueryTreeBackgroundGestures({
  sectionRef,
  selectTreeItem,
  clearSelectionToRoot,
  scrollSelectedRowIntoView,
  createRootFileDraft,
  draftFolderRef,
  draftFileRef
}: Args): Result {
  const clickTimeoutRef             = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      try {
        if (clickTimeoutRef.current != null) {
          window.clearTimeout(clickTimeoutRef.current);
        }
      } catch {}
    };
  }, []);

  const onClickCapture = useEffectEvent((e: React.MouseEvent<HTMLElement>) => {
    // AIDEV-NOTE: Background click within the section clears selection.
    // Ignore row clicks and toolbar clicks.
    const section = sectionRef.current;
    if (!section) return;

    const target = e.target as Element | null;
    if (!target || section !== target) return;

    // Clear any pending click
    if (clickTimeoutRef.current !== null) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    // Delay the click action
    clickTimeoutRef.current = window.setTimeout(() => {
      clearSelectionToRoot();
      clickTimeoutRef.current = null;
    }, 150);
  });

  const onDoubleClickCapture = useEffectEvent((e: React.MouseEvent<HTMLElement>) => {
    // AIDEV-NOTE: Background dblclick within the section creates a new *file* draft at the root
    // after the last folder boundary (folder-first sort).
    // Ignore row dblclicks and toolbar dblclicks.

    // Cancel pending single-click
    if (clickTimeoutRef.current !== null) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    const section = sectionRef.current;
    if (!section) return;

    const target = e.target as Element | null;
    if (!target || section !== target) return;

    try {
      e.preventDefault();
      e.stopPropagation();
    } catch {}

    // If the dblclick's first click causes a blur that cancels a draft, defer creation
    // to the next tick so we see the updated draft refs.
    window.setTimeout(() => {
      const existingFolderDraft = draftFolderRef.current as any;
      const existingFileDraft = draftFileRef.current as any;

      const folderId = String(existingFolderDraft?.nodeId ?? '');
      if (folderId) {
        selectTreeItem(folderId);
        return;
      }

      const fileId = String(existingFileDraft?.nodeId ?? '');
      if (fileId) {
        selectTreeItem(fileId);
        scrollSelectedRowIntoView();
        return;
      }

      createRootFileDraft();
    }, 0);
  });

  return { onClickCapture, onDoubleClickCapture };
}


export { useQueryTreeBackgroundGestures };
