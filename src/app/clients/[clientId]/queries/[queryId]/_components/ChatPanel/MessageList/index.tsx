'use client';

import { memo, useEffect, useRef, useState }  from 'react';
import { useVirtualizer }                     from '@tanstack/react-virtual';

import { areEditorsReady, preloadEditors }    from '../preloadEditors';
import MessageComposer                        from '../MessageComposer';
import styles                                 from './styles.module.css';

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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const expandedIdsRef = useRef<Set<string>>(new Set());
  const [overflowIds, setOverflowIds] = useState<Set<string>>(new Set());
  const roMapRef = useRef(new Map<string, ResizeObserver>());

  // AIDEV-NOTE: TanStack Virtualizer setup
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 6,
    getItemKey: (index) => messages[index]?.id ?? String(index),
    measureElement: (el) => {
      const rect = el.getBoundingClientRect();
      const mb = parseFloat(getComputedStyle(el).marginBottom || '0');
      return rect.height + (Number.isFinite(mb) ? mb : 0);
    }
  });
  const virtualItems = rowVirtualizer.getVirtualItems();

  const setNode = (id: string) => (el: HTMLDivElement | null) => {
    const map = nodeMapRef.current;
    const roMap = roMapRef.current;

    // Clean up existing observer
    const prev = roMap.get(id);
    if (prev) { try { prev.disconnect(); } catch {} roMap.delete(id); }

    if (el) {
      map.set(id, el);
      // Observe this bubble only (virtualized list => visible only)
      const ro = new ResizeObserver(() => {
        try {
          const rootFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
          const maxHeightPx = 5.5 * rootFontPx; // var(--space-22)
          const isOverflow = el.scrollHeight > maxHeightPx + 1;
          setOverflowIds(prev => {
            const next = new Set(prev);
            const has = next.has(id);
            if (isOverflow && !has) next.add(id);
            if (!isOverflow && has) next.delete(id);
            return has === isOverflow ? prev : next;
          });
        } catch {}
      });
      ro.observe(el);
      roMap.set(id, ro);
    } else {
      map.delete(id);
    }
  };

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

  // Stable single document listener reads from ref to avoid re-subscribing
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
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
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // AIDEV-NOTE: Preload editor bundles when the first item becomes visible.
  const preloadedRef = useRef(false);
  useEffect(() => {
    if (preloadedRef.current) return;
    if (virtualItems.some(v => v.index === 0)) {
      try { preloadEditors(); } catch {}
      preloadedRef.current = true;
    }
  }, [virtualItems]);

  // AIDEV-NOTE: Follow output if near bottom (similar to followOutput="auto").
  useEffect(() => {
    const el = parentRef.current;
    if (!el || messages.length === 0) return;
    const nearBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < 48;
    if (nearBottom) {
      try { rowVirtualizer.scrollToIndex(messages.length - 1, { align: 'end' }); } catch {}
    }
  }, [messages.length, rowVirtualizer]);

  return (
    <div ref={parentRef} className={styles['virtual-scroller']} tabIndex={0}>
      <div
        className={styles['virtual-list']}
        style={{
          height: rowVirtualizer.getTotalSize(),
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualItems.map(vItem => {
          const index = vItem.index;
          const msg = messages[index];
          if (!msg) return null;

          return (
            <div
              key={vItem.key}
              ref={(el) => { if (el) rowVirtualizer.measureElement(el); }}
              className={styles['message']}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vItem.start}px)`
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
                      onClick={async () => {
                        if (!collapsed) return;
                        if (!areEditorsReady()) {
                          try { await preloadEditors(); } catch (err) {
                            // eslint-disable-next-line no-console
                            console.warn('[ChatPanel] editor preload on-click failed', err);
                          }
                        }
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
