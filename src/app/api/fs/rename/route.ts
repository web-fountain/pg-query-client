import { NextRequest }  from 'next/server';
import { renameNode }   from '@Lib/mockFS';


export async function POST(req: NextRequest) {
  try {
    const { id, name } = await req.json();
    if (!id || !name) return new Response("Missing id or name", { status: 400 });
    const parentId = renameNode(id, name);
    return Response.json({ ok: true, parentId });
  } catch (e: any) {
    return new Response(e?.message ?? "Bad request", { status: 400 });
  }
}
