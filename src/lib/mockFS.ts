export type Node = { id: string; kind: "folder" | "query"; name: string; parentId: string | null; level: number; tags: string[]; children: string[]; };
export type NodePayloadDb = { id: string; kind: "folder" | "query"; name: string; tags: string[]; level: number };

const maxDepth = 4;
export const ROOT_ID = "root"; // invisible root for the tree; not shown as a folder

const store = new Map<string, Node>();

function uid(prefix = "n") { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }

function ensureInit() {
  if (store.size) return;
  // Invisible root (level 0). The UI header "QUERIES" is not a node.
  store.set(ROOT_ID, { id: ROOT_ID, kind: "folder", name: "ROOT", parentId: null, level: 0, tags: [], children: [] });

  const createFolder = (parentId: string, name: string) => {
    const parent = store.get(parentId)!;
    const id = uid("f");
    const node: Node = { id, kind: "folder", name, parentId, level: parent.level + 1, tags: [], children: [] };
    store.set(id, node); parent.children.push(id); return id;
  };
  const createFile = (parentId: string, name: string) => {
    const parent = store.get(parentId)!;
    const id = uid("q");
    const node: Node = { id, kind: "query", name, parentId, level: parent.level + 1, tags: [], children: [] };
    store.set(id, node); parent.children.push(id); return id;
  };

  // Seed example content (accounts, orders, etc.)
  const accounts = createFolder(ROOT_ID, "accounts");
  createFile(accounts, "user-queries.sql");
  createFile(accounts, "account-summary.sql");
  const orders = createFolder(ROOT_ID, "orders");
  createFile(orders, "monthly-revenue.sql");
  createFile(ROOT_ID, "quick-stats.sql");
}

export function getItem(id: string): NodePayloadDb {
  ensureInit();
  const node = store.get(id); if (!node) throw new Error("Item not found");
  return { id: node.id, kind: node.kind, name: node.name, tags: node.tags, level: node.level };
}
export function getChildrenIds(id: string): string[] {
  ensureInit();
  const node = store.get(id); if (!node) return [];
  return [...node.children];
}
export function getParentId(id: string): string | null {
  ensureInit();
  const node = store.get(id); if (!node) throw new Error("Item not found");
  return node.parentId;
}

export function createFolder(parentId: string, name: string) {
  ensureInit();
  const parent = store.get(parentId); if (!parent) throw new Error("Parent not found");
  if (parent.level + 1 > maxDepth) throw new Error(`Max depth ${maxDepth} exceeded`);
  if (parent.kind !== "folder") throw new Error("Cannot create under a file");
  if (store.get(parentId)!.children.some((cid) => store.get(cid)!.name.toLowerCase() === name.toLowerCase())) throw new Error("Name already exists in this folder");
  const id = uid("f"); const node: Node = { id, kind: "folder", name, parentId, level: parent.level + 1, tags: [], children: [] };
  store.set(id, node); parent.children.push(id); return id;
}
export function createQuery(parentId: string, name: string) {
  ensureInit();
  const parent = store.get(parentId); if (!parent) throw new Error("Parent not found");
  if (parent.level + 1 > maxDepth) throw new Error(`Max depth ${maxDepth} exceeded`);
  if (parent.kind !== "folder") throw new Error("Cannot create under a file");
  if (store.get(parentId)!.children.some((cid) => store.get(cid)!.name.toLowerCase() === name.toLowerCase())) throw new Error("Name already exists in this folder");
  const id = uid("q"); const node: Node = { id, kind: "query", name, parentId, level: parent.level + 1, tags: [], children: [] };
  store.set(id, node); parent.children.push(id); return id;
}

function isDescendant(ancestorId: string, childId: string): boolean {
  let cur = store.get(childId); while (cur && cur.parentId) { if (cur.parentId === ancestorId) return true; cur = store.get(cur.parentId) as Node | undefined; } return false;
}
function subtreeHeight(id: string): number { const node = store.get(id)!; if (!node.children.length) return 1; let max = 1; for (const cid of node.children) { const h = 1 + subtreeHeight(cid); if (h > max) max = h; } return max; }
function applyLevelDelta(id: string, delta: number) { const node = store.get(id)!; node.level += delta; for (const cid of node.children) applyLevelDelta(cid, delta); }

export function moveNode(id: string, newParentId: string) {
  ensureInit();
  const node = store.get(id); const newParent = store.get(newParentId);
  if (!node || !newParent) throw new Error("Not found");
  if (newParent.kind !== "folder") throw new Error("Cannot move under a file");
  if (id === newParentId) throw new Error("Cannot move into itself");
  if (isDescendant(id, newParentId)) throw new Error("Cannot move into its own descendant");
  if (newParent.children.some((cid) => store.get(cid)!.name.toLowerCase() === node.name.toLowerCase())) throw new Error("A sibling with the same name exists in the destination");
  const height = subtreeHeight(id); const futureDeepest = newParent.level + 1 + (height - 1); if (futureDeepest > maxDepth) throw new Error(`Max depth ${maxDepth} would be exceeded`);
  if (node.parentId) { const oldParent = store.get(node.parentId)!; oldParent.children = oldParent.children.filter((cid) => cid !== id); }
  newParent.children.push(id); const oldLevel = node.level; node.parentId = newParentId; const delta = (newParent.level + 1) - oldLevel; applyLevelDelta(id, delta);
}

export function renameNode(id: string, name: string) {
  ensureInit();
  const node = store.get(id); if (!node) throw new Error("Item not found");
  const parent = node.parentId ? store.get(node.parentId)! : null;
  if (parent) { if (parent.children.some((cid) => cid !== id && store.get(cid)!.name.toLowerCase() === name.toLowerCase())) throw new Error("A sibling with the same name already exists"); }
  node.name = name; return node.parentId;
}
