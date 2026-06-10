import { useState, useEffect, useCallback } from 'react';
import type { ChatRoom } from '../types';
import { getChatRooms, saveChatRoom, deleteChatRoom as deleteChatRoomStorage, generateId } from '../utils/storage';

export const useChatRooms = () => {
    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

    // 加载聊天室（按最近活跃时间倒序，最近发言的排最上）
    const loadRooms = useCallback(async () => {
        const loadedRooms = await getChatRooms();
        const sorted = [...loadedRooms].sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
        setRooms(sorted);

        // 如果当前没选中聊天室，自动选择最近活跃的那个
        if (sorted.length > 0 && !currentRoomId) {
            setCurrentRoomId(sorted[0].id);
        }
    }, [currentRoomId]);

    useEffect(() => {
        loadRooms();
    }, [loadRooms]);

    // 添加或更新聊天室
    const upsertRoom = useCallback(async (room: Partial<ChatRoom> & { id?: string }) => {
        const existing = rooms.find(r => r.id === room.id);
        const newRoom: ChatRoom = {
            id: room.id || generateId(),
            name: room.name || '',
            aiIds: room.aiIds || [],
            userIdentity: room.userIdentity || { name: '用户', persona: '' },
            script: room.script,
            // 编辑房间时不带 lastMessageAt，沿用旧值，避免被抹掉打乱排序
            lastMessageAt: room.lastMessageAt ?? existing?.lastMessageAt,
        };

        await saveChatRoom(newRoom);
        await loadRooms();

        // 如果是新建的聊天室，自动选中
        if (!room.id) {
            setCurrentRoomId(newRoom.id);
        }

        return newRoom;
    }, [loadRooms, rooms]);

    // 删除聊天室
    const deleteRoom = useCallback(async (id: string) => {
        await deleteChatRoomStorage(id);

        // 如果删除的是当前选中的聊天室，清除选中状态
        if (id === currentRoomId) {
            setCurrentRoomId(null);
        }

        await loadRooms();
    }, [currentRoomId, loadRooms]);

    // 获取当前聊天室
    const currentRoom = rooms.find(r => r.id === currentRoomId);

    return {
        rooms,
        currentRoom,
        currentRoomId,
        setCurrentRoomId,
        upsertRoom,
        deleteRoom,
        reloadRooms: loadRooms,
    };
};
