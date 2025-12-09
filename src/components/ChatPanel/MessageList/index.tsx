'use client';

import type { ChatMessage, ChatRole } from '@/app/opspace/[opspaceId]/_providers/ChatProvider';

import {
  memo, useCallback, useEffect,
  useEffectEvent, useRef, useState
}                                     from 'react';

import MessageComposer                from '../MessageComposer';
import styles                         from './styles.module.css';

/* AIDEV-NOTE: Renderer scaffold. In a later task we'll swap the assistant
   content to use react-markdown + rehype-pretty-code (Shiki). */

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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const expandedIdsRef = useRef<Set<string>>(new Set());
  const [overflowIds, setOverflowIds] = useState<Set<string>>(new Set());

  // AIDEV-NOTE: Root scroll container for the chat history.
  const parentRef = useRef<HTMLDivElement | null>(null);

  // AIDEV-NOTE: Simple ref setter map (no ResizeObserver). Overflow is computed
  // in a batched effect based on current DOM heights to avoid layout/state
  // feedback loops across browsers.
  const setNode = useCallback((id: string) => (el: HTMLDivElement | null) => {
    const map = nodeMapRef.current;
    if (el) {
      map.set(id, el);
    } else {
      map.delete(id);
    }
  }, []);

  // AIDEV-NOTE: Recompute which user bubbles overflow whenever the messages
  // array changes. This runs after paint and compares to the previous Set so
  // we only trigger a React re-render when the overflow membership changes.
  useEffect(() => {
    const map = nodeMapRef.current;
    if (map.size === 0) {
      setOverflowIds(prev => (prev.size === 0 ? prev : new Set()));
      return;
    }

    let rootFontPx = 16;
    try {
      rootFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    } catch {}
    const maxHeightPx = 5.5 * rootFontPx; // var(--space-22)

    setOverflowIds(prev => {
      const next = new Set<string>();
      for (const [id, el] of map.entries()) {
        if (!el) continue;
        try {
          const isOverflow = el.scrollHeight > maxHeightPx + 1;
          if (isOverflow) next.add(id);
        } catch {}
      }

      if (next.size === prev.size) {
        let same = true;
        for (const id of next) {
          if (!prev.has(id)) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return next;
    });
  }, [messages]);

  // Expansion can happen for ANY message (even those not overflowing)
  const isExpanded  = (id: string) => expandedIds.has(id);
  const isCollapsed = (id: string) => !expandedIds.has(id);
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      expandedIdsRef.current = next;
      return next;
    });
  };

  // Collapse expanded bubble when clicking outside
  useEffect(() => {
    expandedIdsRef.current = expandedIds;
  }, [expandedIds]);

  // Stable single document listener using Effect Event to see latest refs/state
  const onDocClickEvt = useEffectEvent((e: MouseEvent) => {
    const current = expandedIdsRef.current;
    if (current.size === 0) return;
    const map = nodeMapRef.current;
    for (const id of current) {
      const el = map.get(id);
      if (el && el.contains(e.target as Node)) return;
    }
    for (const id of current) {
      const el = map.get(id);
      if (el) el.scrollTop = 0;
    }
    expandedIdsRef.current = new Set();
    setExpandedIds(new Set());
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => onDocClickEvt(e);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // AIDEV-NOTE: Follow output if near bottom (similar to followOutput="auto").
  useEffect(() => {
    const el = parentRef.current;
    if (!el || messages.length === 0) return;
    const nearBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 48;
    if (nearBottom) {
      try {
        el.scrollTop = el.scrollHeight;
      } catch {}
    }
  }, [messages.length]);

  return (
    <div ref={parentRef} className={styles['virtual-scroller']} tabIndex={0}>
      <div
        className={styles['virtual-list']}
      >
        {messages.map((msg, index) => {
          if (!msg) return null;

          return (
            <div
              key={msg.id ?? index}
              className={styles['message']}
              style={{
                width: '100%'
              }}
              data-index={index}
            >
              {msg.role === 'user' ? (
                (() => {
                  const collapsed = isCollapsed(msg.id);
                  const expanded = isExpanded(msg.id);
                  return (
                    <div
                      ref={setNode(msg.id)}
                      className={styles['user-bubble']}
                      data-collapsed={(overflowIds.has(msg.id) && collapsed) || undefined}
                      data-expanded={(overflowIds.has(msg.id) && expanded) || undefined}
                      onClick={() => {
                        if (!collapsed) return;
                        toggleExpand(msg.id);
                      }}
                      title={collapsed ? 'Click to expand' : undefined}
                    >
                      {collapsed ? (
                        <div className={styles['user-plain']}>{msg.content}</div>
                      ) : (
                        <MessageComposer
                          value={msg.content}
                          readOnly={false}
                          collapsed={false}
                          expanded={true}
                          model={model}
                          onModelChange={onModelChange}
                          onSend={onSend}
                          tags={tags}
                          onToggleTag={onToggleTag}
                        />
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className={styles['assistant']}>
                  <div className={styles['assistant-meta']}>Thought for {new Date(msg.createdAt).toLocaleTimeString()}</div>
                  <div className={styles['assistant-plain']}>{msg.content}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


export type { ChatMessage, ChatRole };
export default memo(MessageList);
