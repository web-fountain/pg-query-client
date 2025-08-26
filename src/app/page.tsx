'use server';

function Page() {
  const DEFAULT_CLIENT_ID = '964b7ade-5057-4ef5-8bb8-24358928229e';
  const DEFAULT_QUERY_ID  = '4793e07f-7055-47d3-9a43-5255b6469a1d';
  return (
    <main style={{ padding: 24 }}>
      <h1>Welcome to PG Client Query.</h1>
      <a href={`/clients/${DEFAULT_CLIENT_ID}/queries/${DEFAULT_QUERY_ID}`}>Open workspace</a>
    </main>
  );
}


export default Page;
