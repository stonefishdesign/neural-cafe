import React from 'react';
import { Coffee, Plus, User, AlertCircle, X } from 'lucide-react';
import type { ChatRoom, Message, AIConfig, AIStatus } from '../types';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { Avatar } from './Avatar';
import { getAIStatus } from '../services/replyEngine';
import styles from './ChatArea.module.css';

interface ChatAreaProps {
    currentRoom: ChatRoom | undefined;
    messages: Message[];
    aiConfigs: AIConfig[];
    typingIds: string[];
    notice?: string | null;
    onDismissNotice?: () => void;
    onSendMessage: (content: string, mentioned: string[]) => void;
    onDeleteMessage?: (messageId: string) => void;
    onNewRoom: () => void;
}

const statusClass = (status: AIStatus, styles: Record<string, string>): string => {
    switch (status) {
        case 'online': return styles.online;
        case 'cooldown': return styles.cooldown;
        case 'offline': return styles.offline;
    }
};

export const ChatArea: React.FC<ChatAreaProps> = ({
    currentRoom,
    messages,
    aiConfigs,
    typingIds,
    notice,
    onDismissNotice,
    onSendMessage,
    onDeleteMessage,
    onNewRoom,
}) => {
    const [, setTick] = React.useState(0);

    // 每秒刷新一次，更新冷却状态点
    React.useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    if (!currentRoom) {
        return (
            <div className={styles.area}>
                <div className={styles.empty}>
                    <Coffee size={40} className={styles.emptyIcon} strokeWidth={1.5} />
                    <div className={styles.emptyTitle}>欢迎来到神经咖啡馆</div>
                    <button className={styles.emptyBtn} onClick={onNewRoom}>
                        <Plus size={16} />
                        开一桌新聊天
                    </button>
                </div>
            </div>
        );
    }

    const roomAIConfigs = aiConfigs.filter(ai => currentRoom.aiIds.includes(ai.id));
    const userName = currentRoom.userIdentity?.name || '用户';

    return (
        <div className={styles.area}>
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>{currentRoom.name}</h2>
                    {currentRoom.script && (
                        <span className={styles.script} title={currentRoom.script}>
                            {currentRoom.script}
                        </span>
                    )}
                    <div className={styles.members}>
                        <span className={styles.userTag}>
                            <User size={14} />
                            {userName}
                        </span>
                        {roomAIConfigs.map(ai => {
                            const status = getAIStatus(ai.id, ai);
                            return (
                                <span key={ai.id} className={styles.member}>
                                    <Avatar config={ai} size={20} radius={6} />
                                    <span className={styles.memberName}>{ai.name}</span>
                                    {ai.model && <span className={styles.memberModel}>{ai.model}</span>}
                                    <span className={`${styles.statusDot} ${statusClass(status, styles)}`} />
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>

            <MessageList
                messages={messages}
                aiConfigs={aiConfigs}
                userName={userName}
                typingIds={typingIds}
                onDeleteMessage={onDeleteMessage}
            />

            <div className={styles.inputBar}>
                {notice && (
                    <div className={styles.notice}>
                        <AlertCircle size={14} className={styles.noticeIcon} />
                        <span className={styles.noticeText}>{notice}</span>
                        <button className={styles.noticeClose} onClick={onDismissNotice} aria-label="关闭提示">
                            <X size={13} />
                        </button>
                    </div>
                )}
                <MessageInput onSend={onSendMessage} aiConfigs={roomAIConfigs} />
            </div>
        </div>
    );
};
