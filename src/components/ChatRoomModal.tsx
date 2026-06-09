import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import type { AIConfig, ChatRoom } from '../types';
import { Avatar } from './Avatar';
import { DEFAULT_MODELS } from '../utils/providers';
import styles from './ChatRoomModal.module.css';

interface ChatRoomModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (room: Partial<ChatRoom>) => void;
    aiConfigs: AIConfig[];
    initialData?: ChatRoom;
}

const MAX_AIS = 3;

export const ChatRoomModal: React.FC<ChatRoomModalProps> = ({ isOpen, onClose, onSave, aiConfigs, initialData }) => {
    const [roomName, setRoomName] = useState('');
    const [selectedAIs, setSelectedAIs] = useState<string[]>([]);
    const [userName, setUserName] = useState('');
    const [userPersona, setUserPersona] = useState('');
    const [script, setScript] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setRoomName(initialData?.name || '');
            setSelectedAIs(initialData?.aiIds || []);
            setUserName(initialData?.userIdentity?.name || '');
            setUserPersona(initialData?.userIdentity?.persona || '');
            setScript(initialData?.script || '');
            setError('');
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleToggleAI = (aiId: string) => {
        if (selectedAIs.includes(aiId)) {
            setSelectedAIs(selectedAIs.filter(id => id !== aiId));
            return;
        }
        if (selectedAIs.length >= MAX_AIS) {
            setError(`最多只能邀请 ${MAX_AIS} 位 AI`);
            return;
        }
        setError('');
        setSelectedAIs([...selectedAIs, aiId]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!roomName.trim()) {
            setError('请输入聊天室名称');
            return;
        }
        if (selectedAIs.length === 0) {
            setError('请至少邀请一位 AI');
            return;
        }
        onSave({
            name: roomName.trim(),
            aiIds: selectedAIs,
            userIdentity: { name: userName.trim() || '用户', persona: userPersona },
            script: script.trim() || undefined,
        });
    };

    return (
        <div className={styles.overlay} onMouseDown={onClose}>
            <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
                <div className={styles.head}>
                    <div>
                        <div className={styles.kicker}>New Room</div>
                        <div className={styles.title}>{initialData ? '编辑聊天室' : '新建聊天室'}</div>
                    </div>
                    <button className={styles.close} onClick={onClose} aria-label="关闭">
                        <X size={18} />
                    </button>
                </div>

                <form className={styles.body} onSubmit={handleSubmit}>
                    <div className={styles.field}>
                        <label className={styles.label}>聊天室名称</label>
                        <input
                            className={styles.input}
                            value={roomName}
                            onChange={e => setRoomName(e.target.value)}
                            placeholder="例如：group project"
                            required
                        />
                    </div>

                    {/* 你的身份 */}
                    <div className={styles.identityBox}>
                        <div className={styles.identityHead}>
                            <Avatar config={{ id: 'user-self', name: userName || '你' }} size={32} radius={8} />
                            <div>
                                <div className={styles.identityTitle}>你的身份</div>
                                <div className={styles.identitySub}>你在群聊里也是一个角色</div>
                            </div>
                        </div>
                        <div className={styles.field}>
                            <span className={styles.subLabel}>显示名称</span>
                            <input
                                className={styles.input}
                                value={userName}
                                onChange={e => setUserName(e.target.value)}
                                placeholder="默认：用户"
                            />
                        </div>
                        <div className={styles.field}>
                            <span className={styles.subLabel}>人设描述（可选）</span>
                            <textarea
                                className={styles.textarea}
                                value={userPersona}
                                onChange={e => setUserPersona(e.target.value)}
                                placeholder="例如：组里的发起人，遇事爱犯怂。"
                            />
                        </div>
                    </div>

                    {/* 剧本 */}
                    <div className={styles.field}>
                        <label className={styles.label}>聊天室剧本（可选）</label>
                        <textarea
                            className={styles.textarea}
                            value={script}
                            onChange={e => setScript(e.target.value)}
                            placeholder="这里是 A 大学的自习教室，几个同学正凑在一起赶一个 AI 交互网站的项目。"
                        />
                        <span className={styles.note}>剧本会作为群聊的共同背景，影响每位 AI 的发言。</span>
                    </div>

                    {/* 成员 */}
                    <div className={styles.field}>
                        <div className={styles.memberHead}>
                            <label className={styles.label}>
                                选择 AI 成员 <span className={styles.count}>({selectedAIs.length}/{MAX_AIS})</span>
                            </label>
                        </div>

                        {aiConfigs.length === 0 ? (
                            <div className={styles.emptyMembers}>
                                还没有 AI 人格，先去「AI 配置」调配一位常客吧
                            </div>
                        ) : (
                            <div className={styles.memberList}>
                                {aiConfigs.map(config => {
                                    const selected = selectedAIs.includes(config.id);
                                    return (
                                        <div
                                            key={config.id}
                                            className={`${styles.memberRow} ${selected ? styles.selected : ''}`}
                                            onClick={() => handleToggleAI(config.id)}
                                        >
                                            <Avatar config={config} size={32} radius={8} />
                                            <div className={styles.memberInfo}>
                                                <div className={styles.memberName}>
                                                    {config.name}
                                                    <span className={styles.memberModel}>
                                                        {config.model || DEFAULT_MODELS[config.apiType]}
                                                    </span>
                                                </div>
                                                {config.systemPrompt && (
                                                    <div className={styles.memberDesc}>{config.systemPrompt}</div>
                                                )}
                                            </div>
                                            <span className={styles.checkbox}><Check size={14} /></span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {error && <span className={styles.note} style={{ color: 'var(--danger)' }}>{error}</span>}
                </form>

                <div className={styles.foot}>
                    <button type="button" className={styles.cancel} onClick={onClose}>取消</button>
                    <button
                        type="button"
                        className={styles.submit}
                        onClick={handleSubmit}
                        disabled={aiConfigs.length === 0}
                    >
                        {initialData ? '保存修改' : '创建聊天室'}
                    </button>
                </div>
            </div>
        </div>
    );
};
