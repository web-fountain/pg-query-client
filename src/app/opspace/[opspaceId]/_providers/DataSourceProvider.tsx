'use client';

import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
}                         from 'react';
import ConnectServerModal from '../_components/ConnectServerModal';


type DataSourceUIContext = {
  openConnectServerModal: () => void;
  closeConnectServerModal: () => void;
};

const DataSourceUICtx = createContext<DataSourceUIContext | null>(null);

function DataSourceProvider({ children }: { children: ReactNode }) {
  const [open, setOpen]   = useState<boolean>(false);
  const returnFocusToRef  = useRef<HTMLElement | null>(null);

  const openConnectServerModal = useCallback(() => {
    try {
      const active = document.activeElement;
      returnFocusToRef.current = active instanceof HTMLElement ? active : null;
    } catch {
      returnFocusToRef.current = null;
    }

    setOpen(true);
  }, []);

  const closeConnectServerModal = useCallback(() => {
    setOpen(false);

    const el = returnFocusToRef.current;
    returnFocusToRef.current = null;
    try { el?.focus?.(); } catch {}
  }, []);

  const value = useMemo(() => ({
    openConnectServerModal,
    closeConnectServerModal
  }), [openConnectServerModal, closeConnectServerModal]);

  return (
    <DataSourceUICtx.Provider value={value}>
      {children}
      <ConnectServerModal open={open} onClose={closeConnectServerModal} />
    </DataSourceUICtx.Provider>
  );
}

function useDataSourceUI(): DataSourceUIContext {
  const ctx = useContext(DataSourceUICtx);
  if (!ctx) throw new Error('useDataSourceUI must be used within DataSourceProvider');
  return ctx;
}


export { DataSourceProvider, useDataSourceUI };
