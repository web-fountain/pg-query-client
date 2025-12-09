'use client';

import { preloadEditors }           from '@/app/opspace/[opspaceId]/_components/preloadEditors';
import { preloadWorkspaceEditors }  from '../queries/_components/QueryWorkspace/preloadEditors';


// AIDEV-NOTE: Fire-and-forget preloader for all editor-related bundles used in
// the opspace: ChatPanel editors and QueryWorkspace's SQLEditor/QueryResults.
// This is designed to be called once per opspace hydration (or on high-intent
// events like hovering the "Open your OpSpace" link).
export function preloadAllEditors(): void {
  try {
    void preloadEditors();
  } catch {
    // no-op
  }

  try {
    void preloadWorkspaceEditors();
  } catch {
    // no-op
  }
}
