'use client';

import { useEffect, useRef, useState } from 'react';
import MessageComposer from '../MessageComposer';
import styles from './styles.module.css';

/* AIDEV-NOTE: Renderer scaffold. In a later task we'll swap the assistant
   content to use react-markdown + rehype-pretty-code (Shiki). */

type ChatRole = 'user' | 'assistant';
type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

type Props = {
  messages?: ChatMessage[];
  model?: string;
  onModelChange?: (m: string) => void;
  tags?: string[];
  onToggleTag?: (t: string) => void;
  onSend?: (text: string) => void;
};

function MessageList({
  messages = [] as ChatMessage[],
  model,
  onModelChange,
  tags,
  onToggleTag,
  onSend
}: Props) {
  const nodeMapRef = useRef(new Map<string, HTMLDivElement>());
  const [overflowIds, setOverflowIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const setNode = (id: string) => (el: HTMLDivElement | null) => {
    const map = nodeMapRef.current;
    if (el) map.set(id, el); else map.delete(id);
  };

  // Measure overflow for user messages after render
  useEffect(() => {
    const rootFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const maxHeightPx = 5.5 * rootFontPx; // var(--space-22) = 5.5rem
    const next = new Set<string>();

    for (const msg of messages) {
      if (msg.role !== 'user') continue;
      const el = nodeMapRef.current.get(msg.id);
      if (!el) continue;
      if (el.scrollHeight > maxHeightPx + 1) next.add(msg.id);
    }
    setOverflowIds(next);
  }, [messages]);

  // Expansion can happen for ANY message (even those not overflowing)
  const isExpanded  = (id: string) => expandedIds.has(id);
  const isCollapsed = (id: string) => !expandedIds.has(id);
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Collapse expanded bubble when clicking outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (expandedIds.size === 0) return;
      const map = nodeMapRef.current;
      // If the click is inside any expanded bubble, ignore
      for (const id of expandedIds) {
        const el = map.get(id);
        if (el && el.contains(e.target as Node)) return;
      }
      // Otherwise collapse all and reset scroll to top so first lines are visible next time
      for (const id of expandedIds) {
        const el = map.get(id);
        if (el) el.scrollTop = 0;
      }
      setExpandedIds(new Set());
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [expandedIds]);

  return (
    <div className={styles['message-list']}>
      {messages.map((msg) => (
        <div key={msg.id} className={styles['message']}>
          {msg.role === 'user' ? (
            <div
              ref={setNode(msg.id)}
              className={styles['user-bubble']}
              data-collapsed={(overflowIds.has(msg.id) && isCollapsed(msg.id)) || undefined}
              data-expanded={(overflowIds.has(msg.id) && isExpanded(msg.id)) || undefined}
              onClick={() => { if (isCollapsed(msg.id)) toggleExpand(msg.id); }}
              title={isCollapsed(msg.id) ? 'Click to expand' : undefined}
            >
              <MessageComposer
                value={msg.content}
                readOnly={isCollapsed(msg.id)}
                collapsed={isCollapsed(msg.id)}
                expanded={isExpanded(msg.id)}
                model={model}
                onModelChange={onModelChange}
                onSend={onSend}
                tags={tags}
                onToggleTag={onToggleTag}
              />
            </div>
          ) : (
            <div className={styles['assistant']}>
              <div className={styles['assistant-meta']}>Thought for {new Date(msg.createdAt).toLocaleTimeString()}</div>
              <div className={styles['assistant-plain']}>{msg.content}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export type { ChatMessage, ChatRole };
export default MessageList;
