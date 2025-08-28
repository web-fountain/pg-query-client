'use client';

import type { ReactNode }                      from 'react';
import { createContext, useContext, useState } from 'react';

/* AIDEV-NOTE: Minimal chat provider to persist chat state across [queryId]
   navigations. Lives at the [clientId]/queries level so it remains mounted
   while the QueryWorkspace tabs change. */

type ChatRole = 'user' | 'assistant';
type ChatMessage = {
  id: string;
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
      { id: crypto.randomUUID(), role: 'user', content: text, createdAt: now },
      { id: crypto.randomUUID(), role: 'assistant', content: 'Mocked assistant reply. (Markdown supported; code fences will render later.)', createdAt: new Date().toISOString() }
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


export { ChatProvider, useChat };
