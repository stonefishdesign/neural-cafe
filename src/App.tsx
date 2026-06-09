import { useState, useCallback, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { PersonaLibrary } from './components/PersonaLibrary';
import { PersonaModal } from './components/PersonaModal';
import { ChatRoomModal } from './components/ChatRoomModal';
import { useAIConfigs } from './hooks/useAIConfigs';
import { useChatRooms } from './hooks/useChatRooms';
import { useMessages } from './hooks/useMessages';
import { processNewMessage } from './services/replyEngine';
import { getMessages } from './utils/storage';
import styles from './App.module.css';

import type { AIConfig, ChatRoom } from './types';

type View = 'chat' | 'personas';

function App() {
  const [view, setView] = useState<View>('chat');
  const [editingPersona, setEditingPersona] = useState<AIConfig | null | undefined>(undefined);
  const [editingRoom, setEditingRoom] = useState<ChatRoom | null | undefined>(undefined);
  const [typingIds, setTypingIds] = useState<string[]>([]);

  const { configs, upsertConfig, deleteConfig } = useAIConfigs();
  const { rooms, currentRoom, currentRoomId, setCurrentRoomId, upsertRoom, deleteRoom } = useChatRooms();
  const { messages, addMessage, deleteMessage } = useMessages(currentRoomId);

  // 维护当前房间 id 引用，供回复引擎的"房间守卫"判断是否已切走
  const currentRoomIdRef = useRef(currentRoomId);
  useEffect(() => {
    currentRoomIdRef.current = currentRoomId;
  }, [currentRoomId]);

  const handleSelectRoom = useCallback((roomId: string) => {
    setCurrentRoomId(roomId);
    setView('chat');
  }, [setCurrentRoomId]);

  const startTyping = useCallback((aiId: string) => {
    setTypingIds(prev => (prev.includes(aiId) ? prev : [...prev, aiId]));
  }, []);

  const stopTyping = useCallback((aiId: string) => {
    setTypingIds(prev => prev.filter(id => id !== aiId));
  }, []);

  // 系统提示条（用于 API 出错等，不让角色"说"出错误码）
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  }, []);

  // Handle sending message
  const handleSendMessage = useCallback(
    async (content: string, mentioned: string[]) => {
      if (!currentRoomId || !currentRoom) return;

      setNotice(null);

      // Add user message
      const newMessage = await addMessage('user', content, mentioned);
      if (!newMessage) {
        console.error('Failed to create new message.');
        return;
      }

      // Trigger AI replies
      const roomContext = {
        script: currentRoom.script,
        userIdentity: currentRoom.userIdentity,
      };
      processNewMessage({
        message: newMessage,
        roomId: currentRoomId,
        roomAIIds: currentRoom.aiIds,
        allAIConfigs: configs,
        roomContext,
        aiTurn: 0,
        handlers: {
          getLatestMessages: () => getMessages(currentRoomId), // 每次从后端取最新，避免 React 状态滞后导致漏消息
          onReply: (aiId, content) => addMessage(aiId, content),
          onError: (aiId, error) => {
            console.error(`AI ${aiId} reply failed:`, error);
            const name = configs.find(c => c.id === aiId)?.name || 'AI';
            showNotice(`${name} 没接上话 · ${error.message}`);
          },
          onTypingStart: startTyping,
          onTypingEnd: stopTyping,
          getCurrentRoomId: () => currentRoomIdRef.current,
        },
      });
    },
    [currentRoomId, currentRoom, configs, addMessage, startTyping, stopTyping, showNotice]
  );

  const handleSavePersona = useCallback((data: Partial<AIConfig> & { id?: string }) => {
    upsertConfig(data);
    setEditingPersona(undefined);
  }, [upsertConfig]);

  const handleCopyPersona = useCallback((config: AIConfig) => {
    const { id: _id, ...rest } = config;
    void _id;
    upsertConfig({ ...rest, name: `${config.name} - 副本` });
  }, [upsertConfig]);

  return (
    <div className={styles.app}>
      <Sidebar
        rooms={rooms}
        currentRoomId={currentRoomId}
        activeView={view}
        onSelectRoom={handleSelectRoom}
        onDeleteRoom={deleteRoom}
        onEditRoom={(room) => setEditingRoom(room)}
        onNewRoom={() => setEditingRoom(null)}
        onOpenConfig={() => setView('personas')}
      />

      <main className={styles.main}>
        {view === 'personas' ? (
          <PersonaLibrary
            configs={configs}
            onNew={() => setEditingPersona(null)}
            onEdit={(config) => setEditingPersona(config)}
            onCopy={handleCopyPersona}
            onDelete={deleteConfig}
          />
        ) : (
          <ChatArea
            currentRoom={currentRoom}
            messages={messages}
            aiConfigs={configs}
            typingIds={typingIds}
            notice={notice}
            onDismissNotice={() => setNotice(null)}
            onSendMessage={handleSendMessage}
            onDeleteMessage={deleteMessage}
            onNewRoom={() => setEditingRoom(null)}
          />
        )}
      </main>

      <PersonaModal
        isOpen={editingPersona !== undefined}
        onClose={() => setEditingPersona(undefined)}
        onSave={handleSavePersona}
        initialData={editingPersona || undefined}
      />

      <ChatRoomModal
        isOpen={editingRoom !== undefined}
        onClose={() => setEditingRoom(undefined)}
        onSave={(roomData) => {
          if (editingRoom) {
            upsertRoom({ ...roomData, id: editingRoom.id });
          } else {
            upsertRoom(roomData);
          }
          setEditingRoom(undefined);
        }}
        aiConfigs={configs}
        initialData={editingRoom || undefined}
      />
    </div>
  );
}

export default App;
