import type { APIType } from '../types';

// provider 展示名（apiType → 友好标签）
export const PROVIDER_LABELS: Record<APIType, string> = {
    openai: 'OpenAI',
    claude: 'Anthropic',
    gemini: 'Google',
    'openai-compatible': '自定义',
};

export const providerLabel = (t: APIType): string => PROVIDER_LABELS[t] ?? t;

// 预设模型列表
export const PRESET_MODELS: Record<string, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini'],
    claude: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
    gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-3-pro-preview'],
};

export const DEFAULT_MODELS: Record<string, string> = {
    openai: 'gpt-4o-mini',
    claude: 'claude-3-5-haiku-latest',
    gemini: 'gemini-2.5-flash',
    'openai-compatible': '',
};

// 默认连接地址提示（占位用）
export const DEFAULT_BASE_URLS: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    claude: 'https://api.anthropic.com/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
    'openai-compatible': 'https://your-endpoint/v1',
};
