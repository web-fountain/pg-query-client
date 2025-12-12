// AIDEV-NOTE: Centralized Next.js cache tag construction for QueryWorkspace actions.
// Keep these helpers stable so callers can cacheTag() and updateTag() consistently.

export function tabsOpenListTag(opspacePublicId: string): string {
  return `tabs-open:list:${opspacePublicId}`;
}

export function queriesListTag(opspacePublicId: string): string {
  return `queries:list:${opspacePublicId}`;
}

export function queryTreeInitialTag(opspacePublicId: string): string {
  return `tree:children:${opspacePublicId}:buildInitialQueryTree`;
}

export function unsavedQueryTreeInitialTag(opspacePublicId: string): string {
  return `tree:children:${opspacePublicId}:buildInitialUnsavedQueryTree`;
}

export function queryTreeChildrenTag(opspacePublicId: string): string {
  return `tree:children:${opspacePublicId}:queries`;
}
