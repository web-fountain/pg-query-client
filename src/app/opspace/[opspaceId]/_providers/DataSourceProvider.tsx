'use client';

import type { ReactNode }       from 'react';
import type { UUIDv7 }          from '@Types/primitives';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
}                               from 'react';
import ConnectDataSourceModal   from '../_components/ConnectDataSourceModal';
import ReconnectDataSourceModal from '../_components/ReconnectDataSourceModal';


type ReconnectRequest = {
  dataSourceCredentialId  : UUIDv7;
  reasonMessage?          : string | null;
  onSuccess?              : () => void;
};

type DataSourceUIContext = {
  openConnectDataSourceModal    : () => void;
  closeConnectDataSourceModal   : () => void;
  openReconnectDataSourceModal  : (request: ReconnectRequest) => void;
  closeReconnectDataSourceModal : () => void;
};

const DataSourceUICtx = createContext<DataSourceUIContext | null>(null);

function DataSourceProvider({ children }: { children: ReactNode }) {
  const [open, setOpen]                         = useState<boolean>(false);
  const [reconnectRequest, setReconnectRequest] = useState<ReconnectRequest | null>(null);
  const returnFocusToRef                        = useRef<HTMLElement | null>(null);

  const openConnectDataSourceModal = useCallback(() => {
    try {
      const active = document.activeElement;
      returnFocusToRef.current = active instanceof HTMLElement ? active : null;
    } catch {
      returnFocusToRef.current = null;
    }

    setReconnectRequest(null);
    setOpen(true);
  }, []);

  const closeConnectDataSourceModal = useCallback(() => {
    setOpen(false);

    const el = returnFocusToRef.current;
    returnFocusToRef.current = null;
    try { el?.focus?.(); } catch {}
  }, []);

  const openReconnectDataSourceModal = useCallback((request: ReconnectRequest) => {
    try {
      const active = document.activeElement;
      returnFocusToRef.current = active instanceof HTMLElement ? active : null;
    } catch {
      returnFocusToRef.current = null;
    }

    setOpen(false);
    setReconnectRequest(request);
  }, []);

  const closeReconnectDataSourceModal = useCallback(() => {
    setReconnectRequest(null);

    const el = returnFocusToRef.current;
    returnFocusToRef.current = null;
    try { el?.focus?.(); } catch {}
  }, []);

  const value = useMemo(() => ({
    openConnectDataSourceModal,
    closeConnectDataSourceModal,
    openReconnectDataSourceModal,
    closeReconnectDataSourceModal
  }), [closeConnectDataSourceModal, closeReconnectDataSourceModal, openConnectDataSourceModal, openReconnectDataSourceModal]);

  return (
    <DataSourceUICtx.Provider value={value}>
      {children}
      <ConnectDataSourceModal open={open} onClose={closeConnectDataSourceModal} />
      <ReconnectDataSourceModal
        open={reconnectRequest !== null}
        dataSourceCredentialId={reconnectRequest?.dataSourceCredentialId ?? null}
        reasonMessage={reconnectRequest?.reasonMessage}
        onClose={closeReconnectDataSourceModal}
        onSuccess={reconnectRequest?.onSuccess}
      />
    </DataSourceUICtx.Provider>
  );
}

function useDataSourceUI(): DataSourceUIContext {
  const ctx = useContext(DataSourceUICtx);
  if (!ctx) throw new Error('useDataSourceUI must be used within DataSourceProvider');
  return ctx;
}


export { DataSourceProvider, useDataSourceUI };
