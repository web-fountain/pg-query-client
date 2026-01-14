// AIDEV-NOTE: Centralized Next.js cache tag construction for DbConnections actions.
// Keep these helpers stable so callers can cacheTag() and updateTag() consistently.

export function dataSourcesListTag(opspacePublicId: string): string {
  return `data-sources:list:${opspacePublicId}`;
}
