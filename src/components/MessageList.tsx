import React from 'react';
import { MessageSquare, X } from 'lucide-react';
import type { Message, AIConfig } from '../types';
import { Avatar } from './Avatar';
import { colorOf, chipBgOf } from '../utils/identityColors';
import styles from './MessageList.module.css';

interface MessageListProps {
    messages: Message[];
    aiConfigs: AIConfig[];
    currentUserId?: string;
    userName?: string;
    typingIds?: string[];
    onDeleteMessage?: (messageId: string) => void;
}

const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

// 把正文里的 @人格名 高亮为带身份色的标识
const renderContent = (text: string, aiConfigs: AIConfig[]): React.ReactNode => {
    const named = aiConfigs
        .filter(a => a.name)
        .sort((a, b) => b.name.length - a.name.length);
    if (named.length === 0) return text;

    const escaped = named.map(a => a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`@(${escaped.join('|')})`, 'g');

    const nodes: React.ReactNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = re.exec(text)) !== null) {
        if (match.index > last) nodes.push(text.slice(last, match.index));
        const ai = named.find(a => a.name === match![1]);
        const color = ai ? colorOf(ai) : 'var(--coffee)';
        nodes.push(
            <span key={key++} className={styles.mention} style={{ background: chipBgOf(color), color }}>
                @{match[1]}
            </span>
        );
        last = match.index + match[0].length;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
};

export const MessageList: React.FC<MessageListProps> = ({
    messages,
    aiConfigs,
    currentUserId = 'user',
    userName = '用户',
    typingIds = [],
    onDeleteMessage,
}) => {
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typingIds]);

    const getAIConfig = (senderId: string): AIConfig | undefined =>
        aiConfigs.find(c => c.id === senderId);

    const typingConfigs = typingIds
        .map(getAIConfig)
        .filter((c): c is AIConfig => c !== undefined);

    if (messages.length === 0 && typingConfigs.length === 0) {
        return (
            <div className={styles.list}>
                <div className={styles.empty}>
                    <MessageSquare size={36} className={styles.emptyIcon} strokeWidth={1.5} />
                    <div>还没有消息，发第一句开场吧</div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.list}>
            {messages.map(message => {
                const isUser = message.sender === currentUserId;
                const aiConfig = isUser ? null : getAIConfig(message.sender);

                if (isUser) {
                    return (
                        <div key={message.id} className={`${styles.row} ${styles.user}`}>
                            <div className={styles.userBlock}>
                                <div className={styles.userMeta}>
                                    {onDeleteMessage && (
                                        <button
                                            className={styles.delete}
                                            title="删除消息"
                                            onClick={() => onDeleteMessage(message.id)}
                                        >
                                            <X size={13} />
                                        </button>
                                    )}
                                    <span className={styles.userName}>{userName}</span>
                                    <span className={styles.time}>{formatTime(message.timestamp)}</span>
                                </div>
                                <div className={styles.userText}>{message.content}</div>
                            </div>
                        </div>
                    );
                }

                const color = aiConfig ? colorOf(aiConfig) : 'var(--text-primary)';
                return (
                    <div key={message.id} className={styles.row}>
                        {aiConfig ? (
                            <Avatar config={aiConfig} size={32} />
                        ) : (
                            <span className={styles.mention} style={{ width: 32, height: 32 }} />
                        )}
                        <div className={styles.content}>
                            <div className={styles.meta}>
                                <span className={styles.name} style={{ color }}>
                                    {aiConfig?.name || '未知'}
                                </span>
                                {aiConfig?.model && <span className={styles.model}>{aiConfig.model}</span>}
                                <span className={styles.time}>{formatTime(message.timestamp)}</span>
                                {onDeleteMessage && (
                                    <button
                                        className={styles.delete}
                                        title="删除消息"
                                        onClick={() => onDeleteMessage(message.id)}
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                            <div className={styles.text}>{renderContent(message.content, aiConfigs)}</div>
                        </div>
                    </div>
                );
            })}

            {typingConfigs.map(ai => (
                <div key={`typing-${ai.id}`} className={styles.row}>
                    <Avatar config={ai} size={32} />
                    <div className={styles.content}>
                        <div className={styles.meta}>
                            <span className={styles.name} style={{ color: colorOf(ai) }}>{ai.name}</span>
                        </div>
                        <div className={styles.typing}>
                            正在输入
                            <span className={styles.dots}>
                                <span /><span /><span />
                            </span>
                        </div>
                    </div>
                </div>
            ))}

            <div ref={messagesEndRef} />
        </div>
    );
};
