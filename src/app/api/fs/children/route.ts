import { NextRequest }              from 'next/server';
import { ROOT_ID, getChildrenIds }  from '@Lib/mockFS';


export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? ROOT_ID;
  try {
    const ids = getChildrenIds(id);
    return Response.json(ids);
  } catch (e: any) {
    return new Response(e?.message ?? "Not found", { status: 404 });
  }
}
