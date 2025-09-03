import { NextRequest }                  from 'next/server';
import { ROOT_ID, getChildrenWithData } from '@Lib/mockFS';


export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? ROOT_ID;
  try {
    const payload = getChildrenWithData(id);
    return Response.json(payload);
  } catch (e: any) {
    return new Response(e?.message ?? 'Not found', { status: 404 });
  }
}
