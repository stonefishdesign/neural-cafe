import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { AIConfig } from '../types';
import { Avatar } from './Avatar';
import { ConfirmModal } from './ConfirmModal';
import { colorOf } from '../utils/identityColors';
import { providerLabel, DEFAULT_MODELS } from '../utils/providers';
import styles from './PersonaLibrary.module.css';

interface PersonaLibraryProps {
    configs: AIConfig[];
    onNew: () => void;
    onEdit: (config: AIConfig) => void;
    onCopy: (config: AIConfig) => void;
    onDelete: (id: string) => void;
}

export const PersonaLibrary: React.FC<PersonaLibraryProps> = ({
    configs,
    onNew,
    onEdit,
    onCopy,
    onDelete,
}) => {
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; configId: string | null }>({
        isOpen: false,
        configId: null,
    });

    const handleConfirmDelete = () => {
        if (deleteConfirm.configId) onDelete(deleteConfirm.configId);
        setDeleteConfirm({ isOpen: false, configId: null });
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <div className={styles.kicker}>Settings · Personas</div>
                    <h1 className={styles.title}>AI 人格库</h1>
                    <div className={styles.subtitle}>
                        这些 AI 常客可被邀请进任意聊天室 · 当前 {configs.length} / 10
                    </div>
                </div>
                <button className={styles.newBtn} onClick={onNew}>
                    <Plus size={16} />
                    新建人格
                </button>
            </div>

            <div className={styles.grid}>
                {configs.map(config => {
                    const model = config.model || DEFAULT_MODELS[config.apiType];
                    return (
                        <div key={config.id} className={styles.card}>
                            <div className={styles.cardTop}>
                                <Avatar config={config} size={40} radius={10} />
                                <div className={styles.cardHead}>
                                    <div className={styles.cardName}>
                                        {config.name}
                                        {model && <span className={styles.cardModel}>{model}</span>}
                                    </div>
                                </div>
                                <span className={styles.colorChip} style={{ background: colorOf(config) }} />
                            </div>

                            <div className={styles.persona}>
                                {config.publicIntro || config.systemPrompt || '还没写人设…'}
                            </div>

                            <div className={styles.tags}>
                                <span className={styles.tag}>{providerLabel(config.apiType)}</span>
                                {model && <span className={styles.tag}>{model}</span>}
                            </div>

                            <div className={styles.cardFoot}>
                                <button className={styles.linkBtn} onClick={() => onEdit(config)}>编辑</button>
                                <button className={`${styles.linkBtn} ${styles.muted}`} onClick={() => onCopy(config)}>复制</button>
                                <button
                                    className={`${styles.linkBtn} ${styles.del}`}
                                    title="删除"
                                    onClick={() => setDeleteConfirm({ isOpen: true, configId: config.id })}
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>
                    );
                })}

                <button className={styles.addCard} onClick={onNew}>
                    <Plus size={22} strokeWidth={1.5} />
                    <span className={styles.addLabel}>调配一位新常客</span>
                    <span className={styles.addHint}>选 provider · 写人设 · 配色</span>
                </button>
            </div>

            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                title="删除人格"
                message="确定要删除这个 AI 人格吗？"
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteConfirm({ isOpen: false, configId: null })}
            />
        </div>
    );
};
