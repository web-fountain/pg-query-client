'use client';

import type { Base64Url22, UUIDv7 } from '@Types/primitives';
import { useEffect, useState }      from 'react';
import { STORAGE_KEY_LAST_VISITED } from '@Constants';


type OpenOpSpaceLinkClientProps = Record<string, never>;

function OpenOpSpaceLinkClient({}: OpenOpSpaceLinkClientProps) {
  // AIDEV-NOTE: Derive destination purely client-side; no server fallback to avoid SSR crypto.
  const [href, setHref]     = useState<string | null>(null);
  const [origin, setOrigin] = useState<'restored' | 'missing'>('missing');

  useEffect(() => {
    try {
      const LAST_VISITED_KEY  = STORAGE_KEY_LAST_VISITED;

      let opspaceId   : Base64Url22 | null = null;
      let dataQueryId : UUIDv7 | null = null;

      // Prefer a dedicated last-visited marker if present
      try {
        const rawLast = window.localStorage.getItem(LAST_VISITED_KEY);
        if (rawLast) {
          const last = JSON.parse(rawLast);
          if (last && last.opspaceId) opspaceId = last.opspaceId as Base64Url22;
          if (last && last.dataQueryId) dataQueryId = last.dataQueryId as UUIDv7;
        }
      } catch {}

      const dest = (function computeDestination(opId?: string | null, dqId?: string | null): string | null {
        if (!opId) return null;
        if (!dqId) return null;
        return `/opspace/${opId}/queries/${dqId}`;
      })(opspaceId, dataQueryId);

      if (dest) {
        setHref(dest);
        setOrigin('restored');
      } else {
        // AIDEV-NOTE: No OpSpace found. Log guidance and render nothing.
        // AIDEV-QUESTION: Should we surface a UI message here instead of logging only?
        // eslint-disable-next-line no-console
        console.error('[OpenOpSpaceLinkClient] No OpSpace session found in localStorage. To proceed, open an existing OpSpace via a shared link (format: /opspace/:opspaceId/queries/:dataQueryId) or create one from within the app, then revisit this page.');
      }
    } catch {}
  }, []);

  if (!href) return null;
  return (
    <a id="open-opspace-link" href={href} data-href-origin={origin}>Open your OpSpace</a>
  );
}

export default OpenOpSpaceLinkClient;
