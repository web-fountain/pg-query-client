'use client';

import { useEffect } from 'react';


// AIDEV-NOTE: Dev-only client bootstrap to fetch server-minted JWT and set cookies.
function DevJwtBootstrapClient() {
  useEffect(() => {
    let aborted = false;

    (async () => {
      try {
        const res = await fetch('/api/dev/mint-jwt', { cache: 'no-store' });
        if (!res.ok) return;
        const { token, ttl } = await res.json();
        if (aborted || !token) return;

        const setCookie = (name: string, value: string, maxAge: number) => {
          document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
        };

        const sessionName = 'pg-query-client-session';
        const csrfName    = 'pg-query-client-csrf';
        const jwtName     = 'pg-query-client-jwt';

        const sessionId = 'dev-session-123';
        const csrfToken = 'dev-csrf-123';

        setCookie(sessionName, sessionId, ttl);
        setCookie(csrfName,    csrfToken, ttl);
        setCookie(jwtName,     token,     ttl);

        let meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = 'csrf-token';
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', csrfToken);

        try {
          (window as any).__PGQ__ = Object.assign({}, (window as any).__PGQ__ || {}, {
            sessionId,
            csrfToken,
            jwtPreview: (token || '').slice(0, 12) + '…'
          });
        } catch {}
      } catch {}
    })();

    return () => {
      aborted = true;
    };
  }, []);

  return null;
}


export default DevJwtBootstrapClient;
