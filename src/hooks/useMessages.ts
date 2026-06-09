import { useState, useEffect, useCallback } from 'react';
import type { Message } from '../types';
import { getMessages, saveMessage, deleteMessage as deleteMessageStorage, generateId } from '../utils/storage';

export const useMessages = (roomId: string | null) => {
    const [messages, setMessages] = useState<Message[]>([]);

    // 加载消息
    const loadMessages = useCallback(async () => {
        if (!roomId) {
            setMessages([]);
            return;
        }

        const loadedMessages = await getMessages(roomId);
        setMessages(loadedMessages);
    }, [roomId]);

    useEffect(() => {
        loadMessages();
    }, [loadMessages]);

    // 添加消息
    const addMessage = useCallback(async (
        sender: string,
        content: string,
        mentioned?: string[]
    ) => {
        if (!roomId) return;

        const newMessage: Message = {
            id: generateId(),
            sender,
            content,
            timestamp: Date.now(),
            mentioned,
        };

        await saveMessage(roomId, newMessage);
        await loadMessages();

        return newMessage;
    }, [roomId, loadMessages]);

    const deleteMessage = useCallback(async (messageId: string) => {
        if (!roomId) return;
        await deleteMessageStorage(roomId, messageId);
        await loadMessages();
    }, [roomId, loadMessages]);

    return {
        messages,
        addMessage,
        deleteMessage,
        reloadMessages: loadMessages,
    };
};
