import { useState, useEffect, useCallback } from 'react';
import type { AIConfig } from '../types';
import { getAIConfigs, saveAIConfig, deleteAIConfig as deleteAIConfigStorage, generateId } from '../utils/storage';

export const useAIConfigs = () => {
    const [configs, setConfigs] = useState<AIConfig[]>([]);

    // 加载配置
    const loadConfigs = useCallback(async () => {
        const loadedConfigs = await getAIConfigs();
        setConfigs(loadedConfigs);
    }, []);

    useEffect(() => {
        loadConfigs();
    }, [loadConfigs]);

    // 添加或更新配置
    const upsertConfig = useCallback(async (config: Partial<AIConfig> & { id?: string }) => {
        const newConfig: AIConfig = {
            id: config.id || generateId(),
            name: config.name || '',
            apiType: config.apiType || 'openai',
            apiKey: config.apiKey || '',
            baseUrl: config.baseUrl,
            model: config.model,
            systemPrompt: config.systemPrompt || '',
            color: config.color,
            avatar: config.avatar,
            activeHours: config.activeHours,
            replyProbability: config.replyProbability ?? 20,
        };

        await saveAIConfig(newConfig);
        await loadConfigs();
        return newConfig;
    }, [loadConfigs]);

    // 删除配置
    const deleteConfig = useCallback(async (id: string) => {
        await deleteAIConfigStorage(id);
        await loadConfigs();
    }, [loadConfigs]);

    return {
        configs,
        upsertConfig,
        deleteConfig,
        reloadConfigs: loadConfigs,
    };
};
