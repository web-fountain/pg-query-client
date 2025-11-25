// AIDEV-NOTE: Static, hard-coded tree for UI-only mock data.
// AIDEV-NOTE: We convert this once into the internal map structure (id-indexed).
export type Node = { id: string; kind: 'folder' | 'query'; name: string; parentId: string | null; level: number; tags: string[]; children: string[]; };
export type NodePayloadDb = { id: string; kind: 'folder' | 'query'; name: string; tags: string[]; level: number };

export const ROOT_ID = 'root';
const maxDepth = 4;
const store = new Map<string, Node>();

// AIDEV-NOTE: Maintainable nested JSON shape; easy to edit and extend.
type StaticTreeNode = {
  id: string;
  kind: 'folder' | 'query';
  name: string;
  tags?: string[];
  children?: StaticTreeNode[];
};

// AIDEV-NOTE: Edit this array to change seed data for top-level sections.
const STATIC_ROOTS: StaticTreeNode[] = [
  {
    id: 'queries',
    kind: 'folder',
    name: 'QUERIES',
    children: [
      {
        id: 'f_accounts',
        kind: 'folder',
        name: 'accounts',
        children: [
          { id: 'q_user_queries', kind: 'query', name: 'user-queries.sql' },
          { id: 'q_account_summary', kind: 'query', name: 'account-summary.sql' }
        ]
      },
      {
        id: 'f_orders',
        kind: 'folder',
        name: 'orders',
        children: [
          { id: 'q_monthly_revenue', kind: 'query', name: 'monthly-revenue.sql' }
        ]
      },
      { id: 'q_quick_stats', kind: 'query', name: 'quick-stats.sql' }
    ]
  },
  {
    id: 'databases',
    kind: 'folder',
    name: 'DATABASES',
    children: []
  },
  {
    id: 'services',
    kind: 'folder',
    name: 'SERVICES',
    children: []
  },
  {
    id: 'projects',
    kind: 'folder',
    name: 'PROJECTS',
    children: []
  }
];

// AIDEV-NOTE: One-time conversion of STATIC_ROOTS → id-indexed store.
function seedFromStaticTrees() {
  if (store.size) return;
  const visit = (node: StaticTreeNode, parentId: string | null, level: number) => {
    const tags = node.tags ?? [];
    const childrenIds: string[] = [];
    const entry: Node = { id: node.id, kind: node.kind, name: node.name, parentId, level, tags, children: childrenIds };
    store.set(entry.id, entry);
    if (node.kind === 'folder' && node.children && node.children.length) {
      for (const child of node.children) {
        childrenIds.push(child.id);
        visit(child, node.id, level + 1);
      }
    }
  };
  for (const root of STATIC_ROOTS) visit(root, null, 0);
}
seedFromStaticTrees();

// AIDEV-NOTE: Augment with randomized, deeper content up to depth 4 for load testing.
// Generates a predictable structure shape with random suffixes to avoid name collisions.
// AIDEV-TODO: Tweak counts if UI becomes sluggish without virtualization.
function augmentWithRandomData() {
  const queriesTop = store.get('queries');
  if (!queriesTop) return;

  const addFolder = (parent: Node, baseName: string): Node => {
    if (parent.level + 1 > maxDepth) return parent;
    const id = uid('f');
    const name = `${baseName}-${Math.random().toString(36).slice(2, 6)}`;
    const node: Node = { id, kind: 'folder', name, parentId: parent.id, level: parent.level + 1, tags: [], children: [] };
    store.set(id, node);
    parent.children.push(id);
    return node;
  };

  const addFile = (parent: Node, baseName: string): Node => {
    if (parent.level + 1 > maxDepth) return parent;
    const id = uid('q');
    const name = `${baseName}-${Math.random().toString(36).slice(2, 6)}.sql`;
    const node: Node = { id, kind: 'query', name, parentId: parent.id, level: parent.level + 1, tags: [], children: [] };
    store.set(id, node);
    parent.children.push(id);
    return node;
  };

  // Shape: 10 top-level folders (projects). Each project has files + 3 modules.
  // Each module has files + 2 features. Each feature has files + 1 detail folder with files.
  const numProjects = 10;
  for (let i = 0; i < numProjects; i++) {
    const project = addFolder(queriesTop, `project-${i + 1}`);
    // L1 files under project
    for (let f = 0; f < 4; f++) addFile(project, `report-${f + 1}`);
    // L2 modules
    for (let m = 0; m < 3; m++) {
      const module = addFolder(project, `module-${m + 1}`);
      for (let f = 0; f < 3; f++) addFile(module, `query-${f + 1}`);
      // L3 features
      for (let k = 0; k < 2; k++) {
        const feature = addFolder(module, `feature-${k + 1}`);
        for (let f = 0; f < 3; f++) addFile(feature, `metric-${f + 1}`);
        // L4 detail folder (leaf folder)
        const detail = addFolder(feature, 'detail');
        // L4 files under detail (no deeper children)
        for (let f = 0; f < 2; f++) addFile(detail, `calc-${f + 1}`);
      }
    }
  }
}
augmentWithRandomData();

function uid(prefix = 'n') { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }

export function getItem(id: string): NodePayloadDb {
  const node = store.get(id); if (!node) throw new Error('Item not found');
  const payload = { id: node.id, kind: node.kind, name: node.name, tags: node.tags, level: node.level };
  return payload;
}
export function getChildrenIds(id: string): string[] {
  const node = store.get(id); if (!node) return [];
  // AIDEV-NOTE: Always sort children: folders first, then by name (case-sensitive localeCompare).
  const ids = [...node.children].sort((a, b) => {
    const na = store.get(a)!;
    const nb = store.get(b)!;
    if (na.kind !== nb.kind) return na.kind === 'folder' ? -1 : 1;
    return na.name.localeCompare(nb.name);
  });
  return ids;
}
export function getChildrenWithData(id: string): { id: string; data: NodePayloadDb }[] {
  const node = store.get(id); if (!node) return [];
  // AIDEV-NOTE: Always sort children: folders first, then by name.
  const ordered = [...node.children].sort((a, b) => {
    const na = store.get(a)!;
    const nb = store.get(b)!;
    if (na.kind !== nb.kind) return na.kind === 'folder' ? -1 : 1;
    return na.name.localeCompare(nb.name);
  });
  const rows = ordered.map((cid) => {
    const c = store.get(cid)!;
    return { id: c.id, data: { id: c.id, kind: c.kind, name: c.name, tags: c.tags, level: c.level } };
  });
  return rows;
}
export function getParentId(id: string): string | null {
  const node = store.get(id); if (!node) throw new Error('Item not found');
  const parentId = node.parentId;
  return parentId;
}

export function createFolder(parentId: string, name: string) {
  const parent = store.get(parentId); if (!parent) throw new Error('Parent not found');
  if (parent.level + 1 > maxDepth) throw new Error(`Max depth ${maxDepth} exceeded`);
  if (parent.kind !== 'folder') throw new Error('Cannot create under a file');
  if (parent.children.some((cid) => store.get(cid)!.name.toLowerCase() === name.toLowerCase())) throw new Error('Name already exists in this folder');
  const id = uid('f'); const node: Node = { id, kind: 'folder', name, parentId, level: parent.level + 1, tags: [], children: [] };
  store.set(id, node); parent.children.push(id); return id;
}
export function createQuery(parentId: string, name: string) {
  const parent = store.get(parentId); if (!parent) throw new Error('Parent not found');
  if (parent.level + 1 > maxDepth) throw new Error(`Max depth ${maxDepth} exceeded`);
  if (parent.kind !== 'folder') throw new Error('Cannot create under a file');
  if (parent.children.some((cid) => store.get(cid)!.name.toLowerCase() === name.toLowerCase())) throw new Error('Name already exists in this folder');
  const id = uid('q'); const node: Node = { id, kind: 'query', name, parentId, level: parent.level + 1, tags: [], children: [] };
  store.set(id, node); parent.children.push(id); return id;
}

function isDescendant(ancestorId: string, childId: string): boolean {
  let cur = store.get(childId);
  while (cur && cur.parentId) {
    if (cur.parentId === ancestorId) return true;
    cur = store.get(cur.parentId) as Node | undefined;
  }
  return false;
}
function subtreeHeight(id: string): number {
  const node = store.get(id)!;
  if (!node.children.length) return 1;
  let max = 1;
  for (const cid of node.children) {
    const h = 1 + subtreeHeight(cid);
    if (h > max) max = h;
  }
  return max;
}
function applyLevelDelta(id: string, delta: number) {
  const node = store.get(id)!;
  node.level += delta;
  for (const cid of node.children) applyLevelDelta(cid, delta);
}

export function moveNode(id: string, newParentId: string) {
  const node = store.get(id); const newParent = store.get(newParentId);
  if (!node || !newParent) throw new Error('Not found');
  if (newParent.kind !== 'folder') throw new Error('Cannot move under a file');
  if (id === newParentId) throw new Error('Cannot move into itself');
  if (isDescendant(id, newParentId)) throw new Error('Cannot move into its own descendant');
  if (newParent.children.some((cid) => store.get(cid)!.name.toLowerCase() === node.name.toLowerCase())) throw new Error('A sibling with the same name exists in the destination');
  // AIDEV-NOTE: Block cross-section moves (cannot move across different top-level roots)
  const rootOf = (x: string): string => {
    let cur = store.get(x);
    if (!cur) return x;
    while (cur && cur.parentId) {
      const next = store.get(cur.parentId);
      if (!next) break;
      cur = next;
    }
    return cur?.id ?? x;
  };
  if (rootOf(id) !== rootOf(newParentId)) throw new Error('Cannot move across sections');
  const height = subtreeHeight(id);
  const futureDeepest = newParent.level + 1 + (height - 1);
  if (futureDeepest > maxDepth) throw new Error(`Max depth ${maxDepth} would be exceeded`);
  if (node.parentId) {
    const oldParent = store.get(node.parentId)!;
    oldParent.children = oldParent.children.filter((cid) => cid !== id);
  }
  newParent.children.push(id);
  const oldLevel = node.level;
  node.parentId = newParentId;
  const delta = (newParent.level + 1) - oldLevel;
  applyLevelDelta(id, delta);
}

export function renameNode(id: string, name: string) {
  const node = store.get(id); if (!node) throw new Error('Item not found');
  const parent = node.parentId ? store.get(node.parentId)! : null;
  if (parent) {
    if (parent.children.some((cid) => cid !== id && store.get(cid)!.name.toLowerCase() === name.toLowerCase())) throw new Error('A sibling with the same name already exists');
  }
  node.name = name; return node.parentId;
}
