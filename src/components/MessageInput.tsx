import React, { useState, useRef } from 'react';
import { Send, X } from 'lucide-react';
import type { AIConfig } from '../types';
import { Avatar } from './Avatar';
import styles from './MessageInput.module.css';

interface MessageInputProps {
    onSend: (content: string, mentioned: string[]) => void;
    aiConfigs: AIConfig[];
    disabled?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({ onSend, aiConfigs, disabled }) => {
    const [input, setInput] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionedIds, setMentionedIds] = useState<string[]>([]);
    const [cursorPosition, setCursorPosition] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const cursor = e.target.selectionStart || 0;

        setInput(value);
        setCursorPosition(cursor);

        const beforeCursor = value.slice(0, cursor);
        const lastAtIndex = beforeCursor.lastIndexOf('@');

        if (lastAtIndex !== -1) {
            const afterAt = beforeCursor.slice(lastAtIndex + 1);
            if (!afterAt.includes(' ')) {
                setShowMentions(true);
                setMentionQuery(afterAt.toLowerCase());
                return;
            }
        }

        setShowMentions(false);
    };

    const handleMentionSelect = (ai: AIConfig) => {
        const beforeCursor = input.slice(0, cursorPosition);
        const lastAtIndex = beforeCursor.lastIndexOf('@');

        if (lastAtIndex !== -1) {
            const before = input.slice(0, lastAtIndex);
            const after = input.slice(cursorPosition);
            setInput(`${before}@${ai.name} ${after}`);

            if (!mentionedIds.includes(ai.id)) {
                setMentionedIds([...mentionedIds, ai.id]);
            }
        }

        setShowMentions(false);
        inputRef.current?.focus();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        onSend(input.trim(), mentionedIds);
        setInput('');
        setMentionedIds([]);
        setShowMentions(false);
    };

    const filteredAIs = aiConfigs.filter(ai => ai.name.toLowerCase().includes(mentionQuery));

    return (
        <div className={styles.wrap}>
            {showMentions && filteredAIs.length > 0 && (
                <div className={styles.mentionMenu}>
                    {filteredAIs.map(ai => (
                        <div key={ai.id} className={styles.mentionItem} onClick={() => handleMentionSelect(ai)}>
                            <Avatar config={ai} size={22} radius={6} />
                            <span>{ai.name}</span>
                        </div>
                    ))}
                </div>
            )}

            {mentionedIds.length > 0 && (
                <div className={styles.chips}>
                    {mentionedIds.map(id => {
                        const ai = aiConfigs.find(c => c.id === id);
                        return ai ? (
                            <span key={id} className={styles.chip}>
                                <Avatar config={ai} size={18} radius={5} />
                                @{ai.name}
                                <button
                                    type="button"
                                    className={styles.chipClose}
                                    onClick={() => setMentionedIds(mentionedIds.filter(i => i !== id))}
                                >
                                    <X size={13} />
                                </button>
                            </span>
                        ) : null;
                    })}
                </div>
            )}

            <form onSubmit={handleSubmit} className={styles.form}>
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    placeholder="写点想法… 输入 @ 提及群里的 AI"
                    className={styles.input}
                    disabled={disabled}
                />
                <button type="submit" className={styles.send} disabled={!input.trim() || disabled}>
                    <Send size={15} />
                    发送
                </button>
            </form>

            <div className={styles.hint}>提示：输入 @ 可以点名 AI，被点名的 AI 一定会回复</div>
        </div>
    );
};
