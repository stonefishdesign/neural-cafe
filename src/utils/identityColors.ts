// 身份色板：人格头像色块 / @ 提及标识共用
export interface IdentityColor {
    key: string;
    hex: string;
}

export const IDENTITY_COLORS: IdentityColor[] = [
    { key: 'rose', hex: '#c2557a' },
    { key: 'amber', hex: '#b5762e' },
    { key: 'green', hex: '#4f8a5b' },
    { key: 'indigo', hex: '#5b6bc0' },
    { key: 'teal', hex: '#2f8f8a' },
    { key: 'brown', hex: '#8a6a4f' },
    { key: 'violet', hex: '#7d5bbe' },
    { key: 'slate', hex: '#5f6b7a' },
];

// 取名字的双字母/双字：英文取首字母（最多 2 个词），中文取前两字
export const initialsOf = (name: string): string => {
    const trimmed = (name || '').trim();
    if (!trimmed) return '·';

    // 含 CJK：直接取前两个字符
    if (/[一-鿿]/.test(trimmed)) {
        return Array.from(trimmed).slice(0, 2).join('');
    }

    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
};

// 头像底色（身份色淡化）
export const tintOf = (hex: string): string =>
    `color-mix(in srgb, ${hex} 14%, #fff)`;

// @ chip 背景
export const chipBgOf = (hex: string): string =>
    `color-mix(in srgb, ${hex} 12%, #fff)`;

// 旧数据没有 color 时，按 id/name 稳定哈希取一个板内颜色
export const fallbackColor = (seed: string): string => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % IDENTITY_COLORS.length;
    return IDENTITY_COLORS[idx].hex;
};

// 统一取一个人格的展示色：优先自定义 color，否则按 id 兜底
export const colorOf = (config: { id: string; color?: string }): string =>
    config.color || fallbackColor(config.id);
