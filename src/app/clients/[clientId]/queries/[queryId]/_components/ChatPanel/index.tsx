'use client';

import { useCallback, useState }         from 'react';
import { useOpSpaceLayout } from '@Components/layout/OpSpaceProvider';
import { useChat }          from '../../../_providers/ChatProvider';
import Composer             from './Composer';
import MessageList          from './MessageList';
import styles               from './styles.module.css';
import { preloadEditors }   from './preloadEditors';

function ChatPanel({ collapsed, side = 'left' }: { collapsed: boolean; side?: 'left' | 'right' }) {
  const layout        = useOpSpaceLayout();

  // AIDEV-NOTE: Use ChatProvider so chat persists across QueryWorkspace tab switches.
  const { messages, send } = useChat();
  const [model, setModel]       = useState<string>('gpt-5');
  const [tags, setTags]         = useState<string[]>([]);

  const handleSend = useCallback((text: string) => {
    send(text);
    preloadEditors();
  }, [send]);

  const handleModelChange = useCallback((m: string) => { setModel(m); }, []);

  const handleToggleTag = useCallback((tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }, []);

  return (
    <div
      className={styles['chat-panel']}
      data-collapsed={collapsed || undefined}
      data-panel-side={side}
    >
      {/* AIDEV-NOTE: Keep content mounted; hide via CSS when collapsed */}
      <div
        className={styles['collapsed-icon']}
        onClick={() => layout.expandSide(side)}
        style={{ display: collapsed ? 'flex' : 'none' }}
        aria-hidden={!collapsed}
      >
        {/* AIDEV-NOTE: Icon-only view when collapsed to 40px width */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
        </svg>
      </div>

      <div
        className={styles['content']}
        style={{ display: collapsed ? 'none' : 'flex' }}
        aria-hidden={collapsed}
      >
        {messages.length === 0 && (
          <Composer
            model={model}
            onModelChange={handleModelChange}
            onSend={handleSend}
            tags={tags}
            onToggleTag={handleToggleTag}
            placement="top"
          />
        )}

        <div className={styles['messages']}>
          <MessageList
            messages={messages}
            model={model}
            onModelChange={handleModelChange}
            onSend={handleSend}
            tags={tags}
            onToggleTag={handleToggleTag}
            />
        </div>

        {messages.length > 0 && (
          <div className={styles['composer-dock']}>
            <Composer
              model={model}
              onModelChange={handleModelChange}
              onSend={handleSend}
              tags={tags}
              onToggleTag={handleToggleTag}
              placement="bottom"
            />
          </div>
        )}
      </div>
    </div>
  );
}


export default ChatPanel;
