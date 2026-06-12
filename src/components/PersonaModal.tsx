import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, ClipboardPaste, Eye, EyeOff } from 'lucide-react';
import type { AIConfig, APIType } from '../types';
import { testAIConnection, fetchAvailableModels } from '../services/aiAPI';
import { Avatar } from './Avatar';
import { IDENTITY_COLORS } from '../utils/identityColors';
import { PRESET_MODELS, DEFAULT_MODELS, DEFAULT_BASE_URLS, PROVIDER_LABELS } from '../utils/providers';
import styles from './PersonaModal.module.css';

interface PersonaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: Partial<AIConfig> & { id?: string }) => void;
    initialData?: AIConfig;
}

const newFormData = (): Partial<AIConfig> => ({
    name: '',
    apiType: 'openai',
    apiKey: '',
    baseUrl: '',
    model: DEFAULT_MODELS.openai,
    systemPrompt: '',
    color: IDENTITY_COLORS[0].hex,
    replyProbability: 20,
});

export const PersonaModal: React.FC<PersonaModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
    const [formData, setFormData] = useState<Partial<AIConfig>>(newFormData);
    const [testStatus, setTestStatus] = useState<{ testing: boolean; ok?: boolean; result?: string }>({ testing: false });
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [cachedModels, setCachedModels] = useState<Record<string, string[]>>(() => {
        try { return JSON.parse(localStorage.getItem('cached_models') || '{}'); }
        catch { return {}; }
    });
    const fileRef = useRef<HTMLInputElement>(null);

    const presetsFor = (type: string): string[] => {
        const presets = PRESET_MODELS[type] || [];
        const cached = cachedModels[type] || [];
        return Array.from(new Set([...presets, ...cached]));
    };

    useEffect(() => {
        if (!isOpen) return;
        setFormData(initialData ? initialData : newFormData());
        setTestStatus({ testing: false });
        setShowKey(false);
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const apiType = (formData.apiType || 'openai') as APIType;

    // 连接相关信息一改动，就清掉上次的测试/错误提示，让按钮可以干净重试
    const clearStatus = () => setTestStatus(s => (s.result || s.testing) ? { testing: false } : s);

    const handleApiTypeChange = (newType: APIType) => {
        setFormData({ ...formData, apiType: newType, model: DEFAULT_MODELS[newType] });
        clearStatus();
    };

    const handleTest = async () => {
        if (!formData.apiKey) {
            setTestStatus({ testing: false, ok: false, result: '请先填写 API Key' });
            return;
        }
        setTestStatus({ testing: true });
        const result = await testAIConnection({
            id: 'test',
            name: 'Test',
            apiType,
            apiKey: formData.apiKey,
            baseUrl: formData.baseUrl,
            model: formData.model || DEFAULT_MODELS[apiType],
            systemPrompt: 'You are a test assistant.',
            replyProbability: 100,
        });
        setTestStatus({ testing: false, ok: result.success, result: result.message });
    };

    const handleFetchModels = async () => {
        if (!formData.apiKey) {
            setTestStatus({ testing: false, ok: false, result: '请先填写 API Key' });
            return;
        }
        setIsFetchingModels(true);
        try {
            const models = await fetchAvailableModels({ apiType, apiKey: formData.apiKey, baseUrl: formData.baseUrl });
            if (models.length > 0) {
                const next = { ...cachedModels, [apiType]: models };
                setCachedModels(next);
                localStorage.setItem('cached_models', JSON.stringify(next));
                setFormData(prev => ({ ...prev, model: prev.model?.trim() ? prev.model : models[0] }));
            } else {
                setTestStatus({ testing: false, ok: false, result: '未获取到模型，请检查 API Key / Base URL' });
            }
        } catch (e) {
            setTestStatus({ testing: false, ok: false, result: '获取模型失败：' + e });
        } finally {
            setIsFetchingModels(false);
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) setFormData(prev => ({ ...prev, apiKey: text.trim() }));
        } catch {
            // 剪贴板不可用时忽略
        }
    };

    const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setFormData(prev => ({ ...prev, avatar: String(reader.result) }));
        reader.readAsDataURL(file);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.apiKey || !formData.systemPrompt) {
            setTestStatus({ testing: false, ok: false, result: '请填写名称、API Key 与人格设定' });
            return;
        }
        if (!formData.model || !formData.model.trim()) {
            setTestStatus({ testing: false, ok: false, result: '请填写模型名称' });
            return;
        }
        const finalData: Partial<AIConfig> & { id?: string } = {
            ...formData,
            model: formData.model.trim() || DEFAULT_MODELS[apiType],
        };
        if (initialData) finalData.id = initialData.id;
        onSave(finalData);
    };

    const currentPresets = presetsFor(apiType);

    return (
        <div className={styles.overlay} onMouseDown={onClose}>
            <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
                <div className={styles.head}>
                    <div>
                        <div className={styles.kicker}>{initialData ? 'Edit Persona' : 'New Persona'}</div>
                        <div className={styles.title}>{initialData ? '编辑 AI 人格' : '创建一个 AI 人格'}</div>
                    </div>
                    <button className={styles.close} onClick={onClose} aria-label="关闭">
                        <X size={18} />
                    </button>
                </div>

                <form className={styles.body} onSubmit={handleSubmit}>
                    {/* 名称 + 头像 */}
                    <div className={styles.nameRow}>
                        <div className={styles.uploader}>
                            <button
                                type="button"
                                className={styles.avatarBtn}
                                onClick={() => fileRef.current?.click()}
                                title="上传头像图片"
                            >
                                <Avatar
                                    config={{ id: initialData?.id || 'preview', name: formData.name || '', color: formData.color, avatar: formData.avatar }}
                                    size={52}
                                    radius={12}
                                />
                                <span className={styles.uploadBadge}><Upload size={10} /></span>
                            </button>
                            <span className={styles.uploadHint}>取名字首字 · 可上传图</span>
                            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarFile} />
                        </div>
                        <div className={styles.nameField}>
                            <label className={styles.label}>名称</label>
                            <input
                                className={styles.input}
                                value={formData.name || ''}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="例如：小英"
                                required
                            />
                        </div>
                    </div>

                    {/* provider + 模型 */}
                    <div className={styles.row2}>
                        <div className={styles.field}>
                            <label className={styles.label}>Provider</label>
                            <select
                                className={styles.select}
                                value={apiType}
                                onChange={e => handleApiTypeChange(e.target.value as APIType)}
                            >
                                {(Object.keys(PROVIDER_LABELS) as APIType[]).map(t => (
                                    <option key={t} value={t}>{PROVIDER_LABELS[t]}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.field}>
                            <div className={styles.labelRow}>
                                <label className={styles.label}>模型</label>
                                <button
                                    type="button"
                                    className={styles.linkAction}
                                    onClick={handleFetchModels}
                                    disabled={isFetchingModels || apiType === 'claude'}
                                >
                                    {isFetchingModels ? '获取中…' : '动态获取'}
                                </button>
                            </div>
                            {/* 一个可输入的下拉框：能直接打字（自定义型号），也能从建议里选（预设/动态获取） */}
                            <input
                                className={`${styles.input} ${styles.mono}`}
                                value={formData.model || ''}
                                onChange={e => { setFormData({ ...formData, model: e.target.value }); clearStatus(); }}
                                placeholder="填或选模型名，如 gpt-4o / gemini-3-pro"
                                list={`models-${apiType}`}
                                autoComplete="off"
                            />
                            <datalist id={`models-${apiType}`}>
                                {currentPresets.map(m => <option key={m} value={m} />)}
                            </datalist>
                        </div>
                    </div>

                    {/* 连接设置 */}
                    <div className={styles.conn}>
                        <div className={styles.connHead}>
                            <span className={styles.connTitle}>连接设置</span>
                            <span className={styles.note}>仅保存在本地浏览器</span>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Base URL</label>
                            <input
                                className={`${styles.input} ${styles.mono}`}
                                value={formData.baseUrl || ''}
                                onChange={e => { setFormData({ ...formData, baseUrl: e.target.value }); clearStatus(); }}
                                placeholder={DEFAULT_BASE_URLS[apiType] || '留空使用默认地址'}
                            />
                            <span className={styles.note}>留空则用 provider 默认地址；兼容 OpenAI 格式的中转可改这里（填或不填 /v1 都行）</span>
                        </div>
                        <div className={styles.field}>
                            <div className={styles.labelRow}>
                                <label className={styles.label}>API Key</label>
                                <button type="button" className={styles.linkAction} onClick={() => setShowKey(s => !s)}>
                                    {showKey ? <Eye size={13} /> : <EyeOff size={13} />}
                                </button>
                            </div>
                            <div className={styles.apiKeyRow}>
                                <input
                                    className={`${styles.input} ${styles.mono}`}
                                    type={showKey ? 'text' : 'password'}
                                    value={formData.apiKey || ''}
                                    onChange={e => { setFormData({ ...formData, apiKey: e.target.value }); clearStatus(); }}
                                    placeholder="sk-..."
                                    required
                                />
                                <button type="button" className={styles.linkAction} onClick={handlePaste} title="从剪贴板粘贴">
                                    <ClipboardPaste size={15} />
                                </button>
                            </div>
                        </div>
                        <div className={styles.labelRow}>
                            <button
                                type="button"
                                className={styles.linkAction}
                                onClick={handleTest}
                                disabled={testStatus.testing || !formData.apiKey}
                            >
                                {testStatus.testing ? '测试中…' : '测试连接'}
                            </button>
                        </div>
                        {testStatus.result && (
                            <div className={`${styles.testResult} ${testStatus.ok ? styles.ok : styles.err}`}>
                                {testStatus.result}
                            </div>
                        )}
                    </div>

                    {/* System Prompt */}
                    <div className={styles.field}>
                        <label className={styles.label}>人格设定 · System Prompt</label>
                        <textarea
                            className={styles.textarea}
                            value={formData.systemPrompt || ''}
                            onChange={e => setFormData({ ...formData, systemPrompt: e.target.value })}
                            placeholder="描述这个 AI 的性格、说话风格与行为方式…"
                            required
                        />
                    </div>

                    {/* 公开简介 */}
                    <div className={styles.field}>
                        <label className={styles.label}>公开简介（可选）</label>
                        <input
                            className={styles.input}
                            value={formData.publicIntro || ''}
                            onChange={e => setFormData({ ...formData, publicIntro: e.target.value })}
                            placeholder="一句话，别人眼中的TA，如：组里的点子王，嘴快心善"
                        />
                        <span className={styles.note}>会贴给群里其他 AI 看，让大家互相认识；藏底牌的设定写在上面的人格设定里即可，不会泄露</span>
                    </div>

                    {/* 回复概率 */}
                    <div className={styles.field}>
                        <label className={styles.label}>回复概率：{formData.replyProbability ?? 20}%</label>
                        <input
                            className={styles.slider}
                            type="range"
                            min={0}
                            max={100}
                            value={formData.replyProbability ?? 20}
                            onChange={e => setFormData({ ...formData, replyProbability: parseInt(e.target.value) })}
                        />
                        <span className={styles.note}>看到其他 AI 发言时的搭腔概率（被 @ 或用户点名时必回）</span>
                    </div>

                    {/* 活跃时段 */}
                    <div className={styles.field}>
                        <label className={styles.label}>活跃时段（可选）</label>
                        <div className={styles.timeRow}>
                            <input
                                className={styles.input}
                                type="time"
                                value={formData.activeHours?.start || ''}
                                onChange={e => setFormData({
                                    ...formData,
                                    activeHours: { start: e.target.value, end: formData.activeHours?.end || '23:59' },
                                })}
                            />
                            <span className={styles.note}>至</span>
                            <input
                                className={styles.input}
                                type="time"
                                value={formData.activeHours?.end || ''}
                                onChange={e => setFormData({
                                    ...formData,
                                    activeHours: { start: formData.activeHours?.start || '00:00', end: e.target.value },
                                })}
                            />
                        </div>
                        <span className={styles.note}>非活跃时段回复概率降至 1/4，留空表示全天活跃</span>
                    </div>

                    {/* 身份色 */}
                    <div className={styles.field}>
                        <label className={styles.label}>身份色</label>
                        <div className={styles.swatches}>
                            {IDENTITY_COLORS.map(c => (
                                <button
                                    key={c.key}
                                    type="button"
                                    className={`${styles.swatch} ${formData.color === c.hex ? styles.selected : ''}`}
                                    style={{ background: c.hex }}
                                    onClick={() => setFormData({ ...formData, color: c.hex })}
                                    aria-label={c.key}
                                />
                            ))}
                        </div>
                    </div>
                </form>

                <div className={styles.foot}>
                    <button type="button" className={styles.cancel} onClick={onClose}>取消</button>
                    <button type="button" className={styles.submit} onClick={handleSubmit}>
                        {initialData ? '保存' : '创建人格'}
                    </button>
                </div>
            </div>
        </div>
    );
};
