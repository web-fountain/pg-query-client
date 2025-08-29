import { NextRequest }            from 'next/server';
import { moveNode, getParentId }  from '@Lib/mockFS';


export async function POST(req: NextRequest) {
  try {
    const { id, newParentId } = await req.json();
    if (!id || !newParentId) return new Response("Missing id or newParentId", { status: 400 });
    const oldParentId = getParentId(id);
    moveNode(id, newParentId);
    return Response.json({ ok: true, oldParentId, newParentId });
  } catch (e: any) {
    return new Response(e?.message ?? "Bad request", { status: 400 });
  }
}
