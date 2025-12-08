'use client';

import type { ReactNode }                       from 'react';
import type { UUIDv7 }                          from '@Types/primitives';

import { createContext, useContext, useState }  from 'react';
import { generateUUIDv7 }                       from '@Utils/generateId';


/* AIDEV-NOTE: Minimal chat provider to persist chat state across [dataQueryId]
   navigations. Lives at the [opspaceId]/queries level so it remains mounted
   while the QueryWorkspace tabs change. */
type ChatRole = 'user' | 'assistant';
type ChatMessage = {
  id: UUIDv7;
  dataQueryId: UUIDv7;
  role: ChatRole;
  content: string;
  createdAt: string;
};

type ChatContextValue = {
  messages: ChatMessage[];
  send: (text: string) => void;
  clear: () => void;
};

const ChatCtx = createContext<ChatContextValue | null>(null);

function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  function send(text: string) {
    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      {
        id: generateUUIDv7(),
        dataQueryId: generateUUIDv7(),
        role: 'user',
        content: text,
        createdAt: now
      },
      {
        id: generateUUIDv7(),
        dataQueryId: generateUUIDv7(),
        role: 'assistant',
        content: 'Mocked assistant reply. (Markdown supported; code fences will render later.)',
        createdAt: new Date().toISOString()
      }
    ]);
  }

  function clear() {
    setMessages([]);
  }

  return (
    <ChatCtx.Provider value={{ messages, send, clear }}>
      {children}
    </ChatCtx.Provider>
  );
}

function useChat(): ChatContextValue {
  const ctx = useContext(ChatCtx);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}


export type { ChatMessage, ChatRole };
export { ChatProvider, useChat };
