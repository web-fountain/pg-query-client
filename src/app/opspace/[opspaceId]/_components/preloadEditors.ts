'use client';

import { logClientJson } from '@Observability/client';

// AIDEV-NOTE: Centralized preloader for editor-related bundles.
// AIDEV-NOTE: Uses requestIdleCallback (when available) to defer work until the browser is idle.

let __preloadPromise: Promise<void> | null = null;
let __editorsReady = false;
let __preloadFailed = false;

export function preloadEditors(): Promise<void> {
  if (__editorsReady) {
    return Promise.resolve();
  }

  if (__preloadFailed) {
    __preloadPromise = null;
    __preloadFailed = false;
  }

  if (__preloadPromise) {
    return __preloadPromise;
  }

  __preloadPromise = new Promise<void>((resolve) => {
    const doPreload = () => {
      // AIDEV-NOTE: Preloading ChatPanel's MessageComposer and CodeMirror bundles.
      Promise.all([
        import(
          /* webpackPrefetch: true */
          '../../../../components/ChatPanel/MessageComposer'
        ),
        import(
          /* webpackPrefetch: true */
          '@uiw/react-codemirror'
        )
      ])
        .then(() => {
          __editorsReady = true;
          logClientJson('info', () => ({
            event: 'editorPreload',
            scope: 'chatPanel',
            phase: 'success'
          }));
          resolve();
        })
        .catch((err) => {
          __preloadFailed = true;
          logClientJson('warn', () => ({
            event: 'editorPreload',
            scope: 'chatPanel',
            phase: 'failed',
            errorMessage: err instanceof Error ? err.message : String(err)
          }));
          resolve();
        });
    };

    if (typeof requestIdleCallback === 'function') {
      // AIDEV-NOTE: Use idle time for non-critical preloading, with a timeout to avoid starvation.
      requestIdleCallback(doPreload, { timeout: 2000 });
    } else {
      // AIDEV-NOTE: Fallback to a short delay to yield to more critical work.
      setTimeout(doPreload, 100);
    }
  });

  return __preloadPromise;
}
