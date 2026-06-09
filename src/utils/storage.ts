import type { AIConfig, ChatRoom, Message } from '../types';

const API_BASE = 'http://localhost:5433/api';

// ===== AI配置管理 =====

export const getAIConfigs = async (): Promise<AIConfig[]> => {
    try {
        const response = await fetch(`${API_BASE}/ai-configs`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Failed to get AI configs:', error);
        return [];
    }
};

export const saveAIConfig = async (config: AIConfig): Promise<void> => {
    try {
        const configs = await getAIConfigs();
        const index = configs.findIndex(c => c.id === config.id);

        if (index >= 0) {
            configs[index] = config;
        } else {
            configs.push(config);
        }

        await fetch(`${API_BASE}/ai-configs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configs),
        });
    } catch (error) {
        console.error('Failed to save AI config:', error);
        throw error;
    }
};

export const deleteAIConfig = async (id: string): Promise<void> => {
    try {
        const configs = await getAIConfigs();
        const newConfigs = configs.filter(c => c.id !== id);
        await fetch(`${API_BASE}/ai-configs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newConfigs),
        });
    } catch (error) {
        console.error('Failed to delete AI config:', error);
        throw error;
    }
};

export const getAIConfigById = async (id: string): Promise<AIConfig | undefined> => {
    const configs = await getAIConfigs();
    return configs.find(c => c.id === id);
};

// ===== 聊天室管理 =====

export const getChatRooms = async (): Promise<ChatRoom[]> => {
    try {
        const response = await fetch(`${API_BASE}/chat-rooms`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Failed to get chat rooms:', error);
        return [];
    }
};

export const saveChatRoom = async (room: ChatRoom): Promise<void> => {
    try {
        const rooms = await getChatRooms();
        const index = rooms.findIndex(r => r.id === room.id);

        if (index >= 0) {
            rooms[index] = room;
        } else {
            rooms.push(room);
        }

        await fetch(`${API_BASE}/chat-rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rooms),
        });
    } catch (error) {
        console.error('Failed to save chat room:', error);
        throw error;
    }
};

export const deleteChatRoom = async (id: string): Promise<void> => {
    try {
        await fetch(`${API_BASE}/chat-rooms/${id}`, {
            method: 'DELETE',
        });
    } catch (error) {
        console.error('Failed to delete chat room:', error);
        throw error;
    }
};

export const getChatRoomById = async (id: string): Promise<ChatRoom | undefined> => {
    const rooms = await getChatRooms();
    return rooms.find(r => r.id === id);
};

// ===== 消息管理 =====

export const getMessages = async (roomId: string): Promise<Message[]> => {
    try {
        const response = await fetch(`${API_BASE}/messages/${roomId}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Failed to get messages:', error);
        return [];
    }
};

export const saveMessage = async (roomId: string, message: Message): Promise<void> => {
    try {
        const messages = await getMessages(roomId);
        messages.push(message);
        await fetch(`${API_BASE}/messages/${roomId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messages),
        });
    } catch (error) {
        console.error('Failed to save message:', error);
        throw error;
    }
};

export const clearMessages = async (roomId: string): Promise<void> => {
    try {
        await fetch(`${API_BASE}/messages/${roomId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([]),
        });
    } catch (error) {
        console.error('Failed to clear messages:', error);
        throw error;
    }
};

export const deleteMessage = async (roomId: string, messageId: string): Promise<void> => {
    try {
        const messages = await getMessages(roomId);
        const newMessages = messages.filter(m => m.id !== messageId);
        await fetch(`${API_BASE}/messages/${roomId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newMessages),
        });
    } catch (error) {
        console.error('Failed to delete message:', error);
        throw error;
    }
};

// ===== 工具函数 =====

export const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
