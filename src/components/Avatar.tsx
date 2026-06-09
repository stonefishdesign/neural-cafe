import React from 'react';
import type { AIConfig } from '../types';
import { colorOf, initialsOf, tintOf } from '../utils/identityColors';
import styles from './Avatar.module.css';

interface AvatarProps {
    config: Pick<AIConfig, 'id' | 'name' | 'color' | 'avatar'>;
    size?: number;
    radius?: number;
}

export const Avatar: React.FC<AvatarProps> = ({ config, size = 32, radius = 8 }) => {
    if (config.avatar && config.avatar.startsWith('data:')) {
        return (
            <img
                className={styles.avatar}
                style={{ width: size, height: size, borderRadius: radius }}
                src={config.avatar}
                alt={config.name}
            />
        );
    }

    const color = colorOf(config);
    return (
        <span
            className={styles.avatar}
            style={{
                width: size,
                height: size,
                borderRadius: radius,
                background: tintOf(color),
                color,
                fontSize: Math.round(size * 0.4),
            }}
        >
            {initialsOf(config.name)}
        </span>
    );
};
