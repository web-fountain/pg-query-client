## dataQuery diffs and save payloads

Goal: send to the backend only the minimal fields that must be updated in the database.

---

## Normalized entity adapters (track changes at write time)

High-level idea
- Record the exact fields that changed as reducers handle actions (e.g., `updateDataQueryName`).
- At save time, emit a minimal `{ update: { dataQueryId, ...changedFields } }` payload with no full-object diff required.

### Step-by-step

1) Extend state to track changes per `dataQueryId`

```ts
// AIDEV-NOTE: Proposed additive state kept alongside current/persisted.
// This can live in the same slice as today.
type DataQueryChanges = {
  [dataQueryId: string]: Partial<{
    name: string;
    queryText: string;
    outputType: string;
    outputSchema: Record<string, any>;
    isAttached: boolean;
  }>
};

type DataQueryRecord = {
  [dataQueryId: string]: {
    current: DataQuery;
    persisted: DataQuery;
    unsaved: Partial<SaveDataQuery>; // remains for compatibility
    isUnsaved: boolean;
    isInvalid: boolean;
  }
} & {
  changesById?: DataQueryChanges; // new
};
```

2) Record changes in reducers as writes happen

```ts
// Inside dataQuery reducer cases like updateDataQueryName/Text/OutputSchema:
const markChanged = (
  state: DataQueryRecord,
  dataQueryId: string,
  changes: Partial<DataQuery>
) => {
  if (!state.changesById) state.changesById = {};
  const prev = state.changesById[dataQueryId] || {};

  // Only keep keys that exist in SaveDataQuery.update contract
  const allowed = ['name', 'queryText', 'outputType', 'outputSchema', 'isAttached'] as const;
  const next: any = { ...prev };
  for (const k of allowed) {
    if (k in changes) next[k] = (changes as any)[k];
  }

  state.changesById[dataQueryId] = next;
  state[dataQueryId].isUnsaved = true;
  state[dataQueryId].unsaved = { update: { dataQueryId, ...next } };
};

// Example in updateDataQueryName handler
// dataQuery.current = { ...dataQuery.current, name }
markChanged(state, dataQueryId, { name });

// Example in updateDataQueryOutputSchema handler
// Ensure schema is a plain object; replace when changed
markChanged(state, dataQueryId, { outputSchema });
```

3) Reset changes on successful save

```ts
// After a successful save response:
state[dataQueryId].persisted = state[dataQueryId].current;
state[dataQueryId].isUnsaved = false;
state[dataQueryId].unsaved = {};
if (state.changesById) delete state.changesById[dataQueryId];
```

4) Selector for minimal save payload

```ts
// Returns { isUnsaved, unsavedRecords } using the recorded changes
const selectUnsavedDataQuery = (state: RootState, dataQueryId: string) => {
  const rec = state.dataQueryRecords[dataQueryId];
  if (!rec) return { isUnsaved: false };
  const changes = state.dataQueryRecords.changesById?.[dataQueryId];
  if (!changes || Object.keys(changes).length === 0) return { isUnsaved: false };
  return {
    isUnsaved: true,
    unsavedRecords: {
      update: { dataQueryId, ...changes }
    }
  } as Partial<SaveDataQuery>;
};
```

5) Component consumption
- No change to how components dispatch edits (`updateDataQueryName`, etc.).
- If you show an “Unsaved” indicator, continue to read `isUnsaved`.
- When user clicks Save: call a selector like `selectUnsavedDataQuery` and send the returned `update` to the backend.

### Component and server action changes

HandleSaveQuery (QueryActions)
- Minimal/no code change. Continue to read `unsaved.update` from Redux and pass it to the server.
- Ensure you only call save when `unsaved.update` exists.

```ts
// Assume saveDataQuery (server action) exists in this example
const handleSaveQuery = useCallback(async () => {
  if (!dataQuery) return;
  if (!unsaved || !unsaved.update) return;
  const response = await saveDataQuery({ routeId, ...unsaved.update });
  if (response.success) {
    dispatch(updateDataQueryIsUnsaved({ dataQueryId: dataQuery.dataQueryId }));
  }
}, [dataQuery, routeId, unsaved]);
```

```ts
// type used only server-side.
type SaveDataQueryRequest = {
  routeId: string;
} & {
  dataQueryId: string;
  name?: string;
  queryText?: string | null;
  outputType?: string;
  outputSchema?: Record<string, any>;
  isAttached?: boolean;
};
```
