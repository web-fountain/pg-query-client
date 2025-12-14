'use client';

import { useEffect }  from 'react';
import { logAudit }   from '@Observability/client';


function AuditBootstrapClient() {
  useEffect(() => {
    logAudit({ event: 'session:start' });
  }, []);

  return null;
}


export default AuditBootstrapClient;
