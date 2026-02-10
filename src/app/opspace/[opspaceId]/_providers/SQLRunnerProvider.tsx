'use client';

import type { ReactNode }      from 'react';

import { SqlRunnerCtx, useSqlRunner } from './sqlRunner/context';
import { useSqlRunnerValue }          from './sqlRunner/useSqlRunnerValue';

function SQLRunnerProvider({ children }: { children: ReactNode }) {
  const value = useSqlRunnerValue();

  return (
    <SqlRunnerCtx.Provider value={value}>{children}</SqlRunnerCtx.Provider>
  );
}

export { SQLRunnerProvider, useSqlRunner };
