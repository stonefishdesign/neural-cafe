import React, { useState } from 'react';
import { Plus, Settings, Pencil, Trash2 } from 'lucide-react';
import type { ChatRoom } from '../types';
import { ConfirmModal } from './ConfirmModal';
import styles from './Sidebar.module.css';

interface SidebarProps {
    rooms: ChatRoom[];
    currentRoomId: string | null;
    activeView: 'chat' | 'personas';
    onSelectRoom: (roomId: string) => void;
    onDeleteRoom: (roomId: string) => void;
    onEditRoom: (room: ChatRoom) => void;
    onNewRoom: () => void;
    onOpenConfig: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    rooms,
    currentRoomId,
    activeView,
    onSelectRoom,
    onDeleteRoom,
    onEditRoom,
    onNewRoom,
    onOpenConfig,
}) => {
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; roomId: string | null }>({
        isOpen: false,
        roomId: null,
    });

    const handleDeleteClick = (e: React.MouseEvent, roomId: string) => {
        e.stopPropagation();
        setDeleteConfirm({ isOpen: true, roomId });
    };

    const handleConfirmDelete = () => {
        if (deleteConfirm.roomId) {
            onDeleteRoom(deleteConfirm.roomId);
        }
        setDeleteConfirm({ isOpen: false, roomId: null });
    };

    const handleCancelDelete = () => {
        setDeleteConfirm({ isOpen: false, roomId: null });
    };

    return (
        <>
            <aside className={styles.sidebar}>
                <div className={styles.header}>
                    <span className={styles.dot} />
                    <span className={styles.brand}>神经咖啡馆</span>
                </div>

                <nav className={styles.section}>
                    <div className={styles.sectionLabel}>Rooms</div>

                    {rooms.length === 0 ? (
                        <div className={styles.empty}>
                            还没有聊天室<br />在下方「新建聊天室」开一桌吧
                        </div>
                    ) : (
                        rooms.map(room => {
                            const isActive = activeView === 'chat' && currentRoomId === room.id;
                            return (
                                <div
                                    key={room.id}
                                    onClick={() => onSelectRoom(room.id)}
                                    className={`${styles.roomItem} ${isActive ? styles.active : ''}`}
                                >
                                    <div className={styles.roomBody}>
                                        <div className={styles.roomName}>{room.name}</div>
                                        <div className={styles.roomMeta}>{room.aiIds.length} 位 AI</div>
                                    </div>
                                    <div className={styles.roomActions}>
                                        <button
                                            className={styles.iconBtn}
                                            title="编辑"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEditRoom(room);
                                            }}
                                        >
                                            <Pencil size={15} />
                                        </button>
                                        <button
                                            className={`${styles.iconBtn} ${styles.danger}`}
                                            title="删除"
                                            onClick={(e) => handleDeleteClick(e, room.id)}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </nav>

                <div className={styles.footer}>
                    <button className={styles.navItem} onClick={onNewRoom}>
                        <Plus size={16} />
                        新建聊天室
                    </button>
                    <button
                        className={`${styles.navItem} ${activeView === 'personas' ? styles.active : ''}`}
                        onClick={onOpenConfig}
                    >
                        <Settings size={16} />
                        AI 配置
                    </button>
                </div>
            </aside>

            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                title="删除聊天室"
                message="确定要删除这个聊天室吗？聊天记录也会被删除。"
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />
        </>
    );
};
