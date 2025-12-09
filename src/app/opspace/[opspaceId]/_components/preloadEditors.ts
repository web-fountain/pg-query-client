// AIDEV-NOTE: Centralized preloader for editor-related bundles.
let __preloadPromise: Promise<unknown> | null = null;
let __editorsReady = false;

export function preloadEditors(): Promise<void> {
  if (__editorsReady) return Promise.resolve();
  if (__preloadPromise) return __preloadPromise.then(() => {});
  try {
    // preloading editors bundles
    __preloadPromise = Promise.all([
      import('../../../../components/ChatPanel/MessageComposer'),
      import('@uiw/react-codemirror')
    ]).then(() => {
      __editorsReady = true;
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[ChatPanel] editor preload failed', err);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[ChatPanel] editor preload immediate error', err);
    __preloadPromise = Promise.resolve();
  }
  return __preloadPromise.then(() => {});
}

export function areEditorsReady(): boolean {
  return __editorsReady;
}
