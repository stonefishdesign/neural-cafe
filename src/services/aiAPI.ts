import type { AIConfig, AIContext } from '../types';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// 规整 OpenAI 兼容的 Base URL：只填了主机（如 http://localhost:8045）时自动补 /v1；
// 已带 /v1、/v1beta 等版本段则原样保留，避免重复，省得用户记不清要不要加 /v1。
const normalizeOpenAIBase = (raw?: string): string => {
    const b = (raw || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
    return /\/v\d+[a-z0-9]*$/i.test(b) ? b : `${b}/v1`;
};

// 统一的API调用接口
export const callAI = async (
    config: AIConfig,
    context: AIContext[]
): Promise<string> => {
    switch (config.apiType) {
        case 'openai':
        case 'openai-compatible':
            return callOpenAI(config, context);
        case 'claude':
            return callClaude(config, context);
        case 'gemini':
            return callGemini(config, context);
        default:
            throw new Error(`Unsupported API type: ${config.apiType}`);
    }
};

// OpenAI API调用
const callOpenAI = async (
    config: AIConfig,
    context: AIContext[]
): Promise<string> => {
    const baseUrl = normalizeOpenAIBase(config.baseUrl);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`,
                },
                body: JSON.stringify({
                    model: config.model || 'gpt-4o-mini',
                    messages: context,
                    max_tokens: 150,
                    temperature: 0.8,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`OpenAI API error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (!content) {
                console.warn(
                    `[空响应] ${config.name} / model=${config.model} / finish_reason=${data.choices?.[0]?.finish_reason}`,
                    { request: { model: config.model, max_tokens: 150, msgCount: context.length }, rawResponse: data }
                );
            }
            return content || ''; // 空响应返回空串，由上层决定重试/跳过
        } catch (error) {
            if (attempt === MAX_RETRIES - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
        }
    }

    throw new Error('Max retries exceeded');
};

// Claude API调用
const callClaude = async (
    config: AIConfig,
    context: AIContext[]
): Promise<string> => {
    const baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';

    // 提取system prompt和转换消息格式
    const systemPrompt = context.find(c => c.role === 'system')?.content || '';
    const messages = context
        .filter(c => c.role !== 'system')
        .map(c => ({
            role: c.role === 'assistant' ? 'assistant' : 'user',
            content: c.content,
        }));

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(`${baseUrl}/messages`, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': config.apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify({
                    model: config.model || 'claude-3-5-haiku-latest',
                    max_tokens: 150,
                    system: systemPrompt,
                    messages: messages,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Claude API error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            const claudeText = data.content?.[0]?.text;
            if (!claudeText) {
                console.warn(`[空响应] ${config.name} / model=${config.model} / stop_reason=${data.stop_reason}`, data);
            }
            return claudeText || '';
        } catch (error) {
            if (attempt === MAX_RETRIES - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
        }
    }

    throw new Error('Max retries exceeded');
};

// Gemini API调用
const callGemini = async (
    config: AIConfig,
    context: AIContext[]
): Promise<string> => {
    const baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';

    // 转换消息格式
    const systemPrompt = context.find(c => c.role === 'system')?.content || '';
    const history = context
        .filter(c => c.role !== 'system')
        .slice(0, -1) // 排除最后一条消息
        .map(c => ({
            role: c.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: c.content }],
        }));

    const lastMessage = context[context.length - 1];

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(
                `${baseUrl}/models/${config.model || 'gemini-2.5-flash'}:generateContent?key=${config.apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        system_instruction: {
                            parts: [{ text: systemPrompt }],
                        },
                        contents: [
                            ...history,
                            {
                                role: 'user',
                                parts: [{ text: lastMessage.content }],
                            },
                        ],
                        generationConfig: {
                            maxOutputTokens: 300,
                            temperature: 0.8,
                            thinkingConfig: {
                                thinkingBudget: 0,
                            },
                        },
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Gemini API error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            const geminiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!geminiText) {
                console.warn(
                    `[空响应] ${config.name} / model=${config.model} / finishReason=${data.candidates?.[0]?.finishReason}`,
                    data
                );
            }
            return geminiText || '';
        } catch (error) {
            if (attempt === MAX_RETRIES - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
        }
    }

    throw new Error('Max retries exceeded');
};

// 测试AI连接
export const testAIConnection = async (
    config: AIConfig
): Promise<{ success: boolean; message: string }> => {
    const testContext: AIContext[] = [
        { role: 'system', content: 'You are a helpful assistant. Respond with exactly: "Connection successful!"' },
        { role: 'user', content: 'Hello, this is a test message.' },
    ];

    try {
        const response = await callAI(config, testContext);
        return {
            success: true,
            message: `连接成功\n响应: "${response.slice(0, 100)}${response.length > 100 ? '...' : ''}"`
        };
    } catch (error) {
        return {
            success: false,
            message: `连接失败\n错误: ${(error as Error).message}`
        };
    }
};

// 动态获取可用模型
export const fetchAvailableModels = async (config: { apiType: string, apiKey: string, baseUrl?: string }): Promise<string[]> => {
    if (!config.apiKey) return [];
    
    try {
        if (config.apiType === 'openai' || config.apiType === 'openai-compatible') {
            const baseUrl = normalizeOpenAIBase(config.baseUrl);
            const res = await fetch(`${baseUrl}/models`, {
                headers: { 'Authorization': `Bearer ${config.apiKey}` }
            });
            if (!res.ok) throw new Error('Bad response fetching models');
            const data = await res.json();
            return data.data ? data.data.map((m: { id: string }) => m.id) : [];
        } else if (config.apiType === 'gemini') {
            const baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
            const res = await fetch(`${baseUrl}/models?key=${config.apiKey}`);
            if (!res.ok) throw new Error('Bad response fetching models');
            const data = await res.json();
            return data.models ? data.models.map((m: { name: string }) => m.name.replace('models/', '')) : [];
        } else {
            // Claude currently does not have a standard models list endpoint.
            return [];
        }
    } catch (e) {
        console.error("Error fetching models: ", e);
        return [];
    }
};
