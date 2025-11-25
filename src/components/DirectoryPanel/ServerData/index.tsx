'use server';

import { Suspense } from 'react';

import DirectoryPanel     from '..';
import UnsavedQueriesTree from '../UnsavedQueryTree';
import QueriesTree        from '../QueriesTree';
import HydrateQueryTree   from './HydrateQueryTree';
import HydrateUnsavedTree from './HydrateUnsavedTree';

import { buildInitialQueryTree, buildInitialUnsavedQueryTree } from '../../../app/opspace/[opspaceId]/queries/[dataQueryId]/_actions/queryTree';


async function SavedQueriesLoader() {
  const data = await buildInitialQueryTree();
  return (
    <>
      <HydrateQueryTree data={data} />
      <QueriesTree rootId="queries" label="Queries" />
    </>
  );
}

async function UnsavedQueriesLoader() {
  const data = await buildInitialUnsavedQueryTree();
  return (
    <>
      <HydrateUnsavedTree data={data} />
      <UnsavedQueriesTree rootId="unsaved-queries" label="Unsaved Queries" />
    </>
  );
}

async function ServerData() {
  return (
    <>
      <DirectoryPanel side="right"
        unsavedSlot={
          <Suspense fallback={<div>Loading drafts...</div>}>
            <UnsavedQueriesLoader />
          </Suspense>
        }
        queriesSlot={
          <Suspense fallback={<div>Loading queries...</div>}>
            <SavedQueriesLoader />
          </Suspense>
        }
      />
    </>
  );
}


export default ServerData;
