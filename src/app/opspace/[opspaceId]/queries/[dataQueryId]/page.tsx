import { notFound } from 'next/navigation';
import { isUUIDv7 } from '@Utils/generateId';
import QueryWorkspace from '../_components/QueryWorkspace';


async function Page({ params }: { params: Promise<{ dataQueryId: string }> }) {
  const { dataQueryId } = await params;

  if (!isUUIDv7(dataQueryId)) return notFound();

  return <QueryWorkspace />;
}


export default Page;
