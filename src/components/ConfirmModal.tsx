import React from 'react';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
}) => {
    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onMouseDown={onCancel}>
            <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
                <h3 className={styles.title}>{title}</h3>
                <p className={styles.message}>{message}</p>
                <div className={styles.foot}>
                    <button className={styles.cancel} onClick={onCancel}>取消</button>
                    <button className={styles.confirm} onClick={onConfirm}>确认删除</button>
                </div>
            </div>
        </div>
    );
};
