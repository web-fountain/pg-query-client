import { NextRequest }      from 'next/server';
import { ROOT_ID, getItem } from '@Lib/mockFS';


export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? ROOT_ID;
  try {
    const payload = getItem(id);
    return Response.json(payload);
  } catch (e: any) {
    return new Response(e?.message ?? "Not found", { status: 404 });
  }
}
