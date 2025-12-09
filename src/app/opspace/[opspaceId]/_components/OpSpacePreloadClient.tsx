'use client';

import { useEffect }          from 'react';
import { preloadAllEditors }  from './editorPreloaders';


function OpSpacePreloadClient() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    preloadAllEditors();
  }, []);

  return null;
}


export default OpSpacePreloadClient;
