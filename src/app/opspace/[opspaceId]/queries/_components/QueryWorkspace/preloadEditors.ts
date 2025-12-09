'use client';

let __workspaceEditorPreloadPromise: Promise<unknown> | null = null;


// AIDEV-NOTE: Centralized preloader for QueryWorkspace editor bundles. This
// warms SQLEditor and QueryResults so the first interaction on /queries/*
// does not pay the full dynamic import cost on the critical path.
export function preloadWorkspaceEditors(): Promise<void> {
  if (__workspaceEditorPreloadPromise) {
    return __workspaceEditorPreloadPromise.then(() => {});
  }

  try {
    __workspaceEditorPreloadPromise = Promise.all([
      import('../SQLEditor'),
      import('../QueryResults')
    ]).catch((err) => {
      console.warn('[Workspace] editor preload failed', err);
    });
  } catch (err) {
    console.warn('[Workspace] editor preload immediate error', err);
    __workspaceEditorPreloadPromise = Promise.resolve();
  }

  return __workspaceEditorPreloadPromise.then(() => {});
}
