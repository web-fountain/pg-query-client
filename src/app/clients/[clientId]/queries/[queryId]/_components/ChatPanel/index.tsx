'use client';

import { useState }         from 'react';
import { useOpSpaceLayout } from '@Components/layout/OpSpaceProvider';
import { useClientRoute }   from '../../_providers/ClientRouteProvider';
import { useChat }          from '../../../_providers/ChatProvider';
import Composer             from './Composer';
import MessageList          from './MessageList';
import styles               from './styles.module.css';


function ChatPanel({ collapsed, side = 'left' }: { collapsed: boolean; side?: 'left' | 'right' }) {
  const layout        = useOpSpaceLayout();
  const { clientId }  = useClientRoute();

  // AIDEV-NOTE: Use ChatProvider so chat persists across QueryWorkspace tab switches.
  const { messages, send } = useChat();
  const [model, setModel]       = useState<string>('gpt-4o-mini');
  const [tags, setTags]         = useState<string[]>([]);

  function handleSend(text: string) { send(text); }

  function handleToggleTag(tag: string) { setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])); }

  return (
    <div
      className={styles['chat-panel']}
      data-collapsed={collapsed || undefined}
      data-panel-side={side}
    >
      {collapsed ? (
        <div className={styles['collapsed-icon']} onClick={() => layout.expandSide(side)}>
          {/* AIDEV-NOTE: Icon-only view when collapsed to 40px width */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </div>
      ) : (
        <div className={styles['content']}>
          {messages.length === 0 && (
            <Composer
              model={model}
              onModelChange={setModel}
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
              onModelChange={setModel}
              onSend={handleSend}
              tags={tags}
              onToggleTag={handleToggleTag}
              />
          </div>

          {messages.length > 0 && (
            <div className={styles['composer-dock']}>
              <Composer
                model={model}
                onModelChange={setModel}
                onSend={handleSend}
                tags={tags}
                onToggleTag={handleToggleTag}
                placement="bottom"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export default ChatPanel;
