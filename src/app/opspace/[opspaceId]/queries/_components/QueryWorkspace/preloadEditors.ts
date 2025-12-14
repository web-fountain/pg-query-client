'use client';

import { logClientJson } from '@Observability/client';

let __workspaceEditorPreloadPromise: Promise<void> | null = null;
let __workspaceEditorsReady = false;
let __workspacePreloadFailed = false;

// AIDEV-NOTE: Centralized preloader for QueryWorkspace editor bundles. This
// warms SQLEditor and QueryResults so the first interaction on /queries/*
// does not pay the full dynamic import cost on the critical path.
// AIDEV-NOTE: Uses requestIdleCallback (when available) to defer work until the browser is idle.
export function preloadWorkspaceEditors(): Promise<void> {
  if (__workspaceEditorsReady) {
    return Promise.resolve();
  }

  if (__workspacePreloadFailed) {
    __workspaceEditorPreloadPromise = null;
    __workspacePreloadFailed = false;
  }

  if (__workspaceEditorPreloadPromise) {
    return __workspaceEditorPreloadPromise;
  }

  __workspaceEditorPreloadPromise = new Promise<void>((resolve) => {
    const doPreload = () => {
      // AIDEV-NOTE: Preloading SQLEditor and QueryResults bundles for QueryWorkspace.
      Promise.all([
        import(
          /* webpackPrefetch: true */
          '../SQLEditor'
        ),
        import(
          /* webpackPrefetch: true */
          '../QueryResults'
        )
      ])
        .then(() => {
          __workspaceEditorsReady = true;
          logClientJson('info', () => ({
            event: 'editorPreload',
            scope: 'queryWorkspace',
            phase: 'success'
          }));
          resolve();
        })
        .catch((err) => {
          __workspacePreloadFailed = true;
          logClientJson('warn', () => ({
            event: 'editorPreload',
            scope: 'queryWorkspace',
            phase: 'failed',
            errorMessage: err instanceof Error ? err.message : String(err)
          }));
          resolve();
        });
    };

    if (typeof requestIdleCallback === 'function') {
      // AIDEV-NOTE: Use idle time for non-critical QueryWorkspace preloading, with a timeout to avoid starvation.
      requestIdleCallback(doPreload, { timeout: 2000 });
    } else {
      // AIDEV-NOTE: Fallback to a short delay to yield to more critical work.
      setTimeout(doPreload, 100);
    }
  });

  return __workspaceEditorPreloadPromise;
}
