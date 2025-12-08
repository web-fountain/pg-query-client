'use server';

import { Suspense } from 'react';

import DirectoryPanel     from '..';
import UnsavedQueryTree   from '../UnsavedQueryTree';
import QueryTree          from '../QueryTree';
import HydrateQueryTree   from './HydrateQueryTree';
import HydrateUnsavedTree from './HydrateUnsavedTree';

import { buildInitialQueryTree, buildInitialUnsavedQueryTree } from '../../../app/opspace/[opspaceId]/queries/_actions/queryTree';


async function SavedQueriesLoader() {
  const data = await buildInitialQueryTree();
  return (
    <>
      <HydrateQueryTree data={data} />
      <QueryTree rootId="queries" label="Queries" />
    </>
  );
}

async function UnsavedQueryTreeLoader() {
  const data = await buildInitialUnsavedQueryTree();
  return (
    <>
      <HydrateUnsavedTree data={data} />
      <UnsavedQueryTree rootId="unsaved-queries" label="Unsaved Queries" />
    </>
  );
}

async function ServerData() {
  return (
    <>
      <DirectoryPanel side="right"
        unsavedSlot={
          <Suspense fallback={<div>Loading drafts...</div>}>
            <UnsavedQueryTreeLoader />
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
