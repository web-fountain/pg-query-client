type Payload = {
  rows: unknown[];
  rowCount: number;
  fields?: string[];
  elapsedMs: number;
  error?: string;
};

export async function POST(req: Request) {
  const started = Date.now();
  try {
    const sql = await req.text();
    const trimmed = (sql || '').trim();
    if (!trimmed) {
      const elapsedMs = Date.now() - started;
      const res: Payload = { rows: [], rowCount: 0, elapsedMs, error: 'Empty SQL' };
      return new Response(JSON.stringify(res), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // AIDEV-NOTE: Stubbed execution. Replace with postgres.js client call later.
    // AIDEV-TODO: Integrate postgres.js and respect a short timeout + safe mode.
    const fakeRows = [{ notice: 'stubbed', echo: trimmed.slice(0, 2000) }];
    const elapsedMs = Date.now() - started;
    const payload: Payload = {
      rows: fakeRows,
      rowCount: fakeRows.length,
      fields: Object.keys(fakeRows[0] || []),
      elapsedMs
    };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    const elapsedMs = Date.now() - started;
    const payload: Payload = { rows: [], rowCount: 0, elapsedMs, error: message };
    return new Response(JSON.stringify(payload), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
