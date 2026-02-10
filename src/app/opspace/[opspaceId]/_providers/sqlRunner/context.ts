'use client';

import { createContext, useContext } from 'react';


type SqlRunnerContextValue = {
  isRunning: boolean;
  runQuery: (sql: string) => Promise<void>;
  clear: () => void;
};

const SqlRunnerCtx = createContext<SqlRunnerContextValue | null>(null);

function useSqlRunner(): SqlRunnerContextValue {
  const contextValue = useContext(SqlRunnerCtx);
  if (!contextValue) throw new Error('useSqlRunner must be used within SQLRunnerProvider');
  return contextValue;
}


export type { SqlRunnerContextValue };
export { SqlRunnerCtx, useSqlRunner };
