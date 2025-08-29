import { NextRequest } from 'next/server';
import { getParentId } from '@Lib/mockFS';


export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id"); if (!id) return new Response("Missing id", { status: 400 });
  try { const parentId = getParentId(id); return Response.json({ parentId }); } catch (e: any) { return new Response(e?.message ?? "Not found", { status: 404 }); }
}
