import { NextRequest } from 'next/server';
import { createQuery } from '@Lib/mockFS';


export async function POST(req: NextRequest) {
  try {
    const { parentId, name } = await req.json();
    if (!parentId || !name) return new Response("Missing parentId or name", { status: 400 });
    const id = createQuery(parentId, name);
    return Response.json({ ok: true, id });
  } catch (e: any) {
    return new Response(e?.message ?? "Bad request", { status: 400 });
  }
}
