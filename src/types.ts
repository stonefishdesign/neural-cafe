export type APIType = 'openai' | 'claude' | 'gemini' | 'openai-compatible';

// AI配置接口
export interface AIConfig {
    id: string;
    name: string;
    apiType: APIType;
    apiKey: string;
    baseUrl?: string;
    model?: string; // 用户选择或自定义的模型名
    systemPrompt: string;
    color?: string; // 身份色 hex，用于色块头像与 @ 标识
    avatar?: string; // 可选：上传的头像图片 dataURL（默认展示 name 双字母）
    activeHours?: {
        start: string; // 格式: "HH:MM"
        end: string;   // 格式: "HH:MM"
    };
    replyProbability: number; // 0-100
}

// 聊天室接口
export interface ChatRoom {
    id: string;
    name: string;
    aiIds: string[]; // 最多3个AI ID
    userIdentity: {
        name: string;      // 用户在此聊天室的显示名
        persona: string;   // 用户的人设描述
    };
    script?: string;       // 聊天室剧本/背景设定
}

// 消息接口
export interface Message {
    id: string;
    sender: string; // "user" 或 ai_id
    content: string;
    timestamp: number;
    mentioned?: string[]; // @提及的AI ID列表
}

// AI状态
export type AIStatus = 'online' | 'cooldown' | 'offline';

// AI回复上下文
export interface AIContext {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
