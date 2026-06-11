import type { AIConfig, AIContext, Message, AIStatus } from '../types';
import { callAI } from './aiAPI';

// ===== 调参 =====
const MAX_AI_TURNS = 6;   // 一次用户发言最多产生的 AI 消息总数（全员轮 + 搭腔）的硬上限
const DECAY = 0.65;       // 搭腔概率随【搭腔深度】衰减（被点名接话不受此限）
const MAX_CONTEXT = 15;   // 进入上下文的最近消息条数

const roundGap = () => Math.random() * 700 + 500;       // 全员轮里，每位之间的小间隔
const banterDelay = () => Math.random() * 2000 + 1500;  // 搭腔发言延迟

// ===== 类型 =====
export interface RoomContext {
    script?: string;
    userIdentity?: { name: string; persona: string };
}

export interface ReplyHandlers {
    getLatestMessages: () => Message[] | Promise<Message[]>; // 从唯一真相源（后端）拉，避免 React ref 滞后

    onReply: (aiId: string, content: string) => void | Promise<unknown>;
    onError?: (aiId: string, error: Error) => void;
    onTypingStart?: (aiId: string) => void;
    onTypingEnd?: (aiId: string) => void;
    getCurrentRoomId?: () => string | null;
}

interface Base {
    roomId: string | null;
    roomAIIds: string[];
    allAIConfigs: AIConfig[];
    roomContext?: RoomContext;
    handlers: ReplyHandlers;
    epoch?: number; // 本串回复所属的轮次纪元；用户每发新消息 +1，旧纪元的在途/排队回复一律作废
}

// ===== 轮次纪元：防止上一轮还在排队/在途的回复，叠到用户新发言开启的新一轮上 =====
const roomEpochs = new Map<string, number>();

const bumpEpoch = (roomId: string | null): number => {
    const key = roomId ?? '';
    const next = (roomEpochs.get(key) ?? 0) + 1;
    roomEpochs.set(key, next);
    return next;
};

const isStale = (base: Base): boolean =>
    base.epoch !== undefined && roomEpochs.get(base.roomId ?? '') !== base.epoch;

interface ProcessParams extends Base {
    message: Message;
    aiTurn?: number;     // 这一串里已经产生的 AI 消息总数（用于硬上限）
    banterTurn?: number; // 搭腔深度（用于概率衰减），全员轮结束后从 0 起算
}

// ===== 冷却（现在仅用于 UI 状态点，不再门控选人）=====
const cooldowns = new Map<string, number>();

const isOfflineByHours = (config: AIConfig): boolean => {
    if (!config.activeHours) return false;
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const { start, end } = config.activeHours;
    return t < start || t > end;
};

export const getAIStatus = (aiId: string, config: AIConfig): AIStatus => {
    const until = cooldowns.get(aiId);
    if (until && Date.now() < until) return 'cooldown';
    if (isOfflineByHours(config)) return 'offline';
    return 'online';
};

export const setCooldown = (aiId: string, ms?: number): void => {
    cooldowns.set(aiId, Date.now() + (ms ?? Math.random() * 7000 + 3000)); // 默认 3-10 秒
};

// ===== 上下文构建 =====
export const buildContext = (
    messages: Message[],
    config: AIConfig,
    aiConfigs: AIConfig[],
    options?: RoomContext & { participants?: string[]; focusUser?: boolean }
): AIContext[] => {
    const recentMessages = messages.slice(-MAX_CONTEXT);

    let systemContent = config.systemPrompt;

    if (options?.script) {
        systemContent += `\n\n[场景设定]: ${options.script}`;
    }

    if (options?.participants?.length) {
        systemContent += `\n\n[群聊成员]: 除了你，群里还有 ${options.participants.join('、')}。这是一个多人群聊，你可以回应任何人，也可以只针对某一句搭话。`;
    }

    const userName = options?.userIdentity?.name || '用户';
    if (options?.userIdentity) {
        systemContent += `\n\n[用户]: 真人用户叫"${userName}"。`;
        if (options.userIdentity.persona) {
            systemContent += ` ${userName}的背景: ${options.userIdentity.persona}`;
        }
    }

    // A：用户刚发言这一轮，把焦点钉在用户最新这句上，避免去续别人没说完的旧话题
    if (options?.focusUser) {
        const lastUser = [...recentMessages].reverse().find(m => m.sender === 'user');
        if (lastUser) {
            systemContent += `\n\n[当前重点]: 请直接回应${userName}刚说的「${lastUser.content}」，不要纠缠之前其他人之间没说完的话题。`;
        }
    }

    systemContent += '\n\n回复请控制在 2-3 句话以内，用一段话说完，不要分段、不要空行，保持聊天节奏。';

    // 1) 映射成对话轮：自己=assistant，其他人（含真人）=user，并给非自己的发言加名字前缀
    const rawTurns: AIContext[] = recentMessages.map(msg => {
        if (msg.sender === 'user') return { role: 'user', content: `[${userName}]: ${msg.content}` };
        if (msg.sender === config.id) return { role: 'assistant', content: msg.content };
        const aiName = aiConfigs.find(c => c.id === msg.sender)?.name || 'AI';
        return { role: 'user', content: `[${aiName}]: ${msg.content}` };
    });

    // 2) 合并连续同角色（Gemini 等模型要求 user/assistant 严格交替）
    const turns: AIContext[] = [];
    for (const t of rawTurns) {
        const last = turns[turns.length - 1];
        if (last && last.role === t.role) last.content += `\n${t.content}`;
        else turns.push({ ...t });
    }

    // 3) 去掉开头的 assistant（首轮须为 user）
    while (turns.length && turns[0].role === 'assistant') turns.shift();

    // 4) 结尾必须是 user：否则对话停在"模型自己那句"，严格交替的 provider 会无从回应而返回空
    if (turns.length === 0 || turns[turns.length - 1].role === 'assistant') {
        turns.push({
            role: 'user',
            content: `（请以"${config.name}"的身份，自然地接着上面的群聊回一句）`,
        });
    }

    return [{ role: 'system', content: systemContent }, ...turns];
};

// ===== 工具 =====
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const roomChanged = (base: Base): boolean =>
    base.handlers.getCurrentRoomId ? base.handlers.getCurrentRoomId() !== base.roomId : false;

const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

const participantsFor = (aiId: string, base: Base): string[] => [
    ...(base.roomContext?.userIdentity?.name ? [base.roomContext.userIdentity.name] : []),
    ...base.roomAIIds
        .filter(id => id !== aiId)
        .map(id => base.allAIConfigs.find(c => c.id === id)?.name)
        .filter((n): n is string => !!n),
];

// 按 replyProbability 比例加权随机选 1 个（offline ×0.25）；全为 0 则等概率。
const weightedPick = (candidates: AIConfig[]): AIConfig | null => {
    if (candidates.length === 0) return null;
    const weights = candidates.map(c => (isOfflineByHours(c) ? c.replyProbability * 0.25 : c.replyProbability));
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return candidates[Math.floor(Math.random() * candidates.length)];
    let r = Math.random() * total;
    for (let i = 0; i < candidates.length; i++) {
        r -= weights[i];
        if (r <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
};

// B：检测一段回复里直接点到的其他角色（含去掉姓氏的简称，如「安陵容」→「陵容」）。
// 返回正文里最早被点到的那一位，没有则 null。
const detectCue = (content: string, candidates: AIConfig[]): AIConfig | null => {
    if (!content) return null;
    let best: AIConfig | null = null;
    let bestIdx = Infinity;
    for (const c of candidates) {
        const aliases = c.name.length >= 3 ? [c.name, c.name.slice(-2)] : [c.name];
        for (const a of aliases) {
            const idx = content.indexOf(a);
            if (idx !== -1 && idx < bestIdx) {
                bestIdx = idx;
                best = c;
            }
        }
    }
    return best;
};

// ===== 核心：单条回复（不递归、不触发搭腔）。成功返回回复文本，失败/跳过返回 null =====
const doReply = async (aiId: string, base: Base, opts?: { focusUser?: boolean }): Promise<string | null> => {
    const { handlers } = base;
    const config = base.allAIConfigs.find(c => c.id === aiId);
    if (!config) return null;
    // 作废条件：用户切走了房间，或用户又发了新消息（本串已是旧纪元）
    const abandoned = () => roomChanged(base) || isStale(base);
    if (abandoned()) return null;

    handlers.onTypingStart?.(aiId);
    try {
        const latest = await handlers.getLatestMessages();
        const context = buildContext(latest, config, base.allAIConfigs, {
            ...base.roomContext,
            participants: participantsFor(aiId, base),
            focusUser: opts?.focusUser,
        });

        // 模型偶尔会返回空（这一轮"没话说"）——重试一次
        let response = await callAI(config, context);
        if (!response.trim() && !abandoned()) {
            response = await callAI(config, context);
        }

        if (abandoned()) {
            handlers.onTypingEnd?.(aiId);
            return null;
        }

        // 仍为空：当作这位这轮没接话，直接跳过（不往聊天里发"(无响应)"）
        if (!response.trim()) {
            console.warn(`[跳过] ${config.name} 连续两次空响应，本轮不发言`);
            handlers.onTypingEnd?.(aiId);
            return null;
        }

        // 压成一行：把换行（及周围空白）收成一个空格，群聊里不出现"两行/空段"
        response = response.replace(/\s*\n+\s*/g, ' ').trim();

        setCooldown(aiId);        // 仅供 UI 显示"刚说过话"
        handlers.onTypingEnd?.(aiId);
        await handlers.onReply(aiId, response); // 等落库，保证后续上下文顺序
        return response;
    } catch (error) {
        handlers.onTypingEnd?.(aiId);
        handlers.onError?.(aiId, error as Error);
        return null;
    }
};

// ===== 全员轮：列表里每位各回一句（打乱顺序、依次进行），结束后开启搭腔 =====
const runRound = async (roundIds: string[], base: Base, startTurn: number): Promise<void> => {
    const ids = shuffle(roundIds);
    let turn = startTurn;
    let lastSender: string | null = null;
    let lastContent = '';

    for (const aiId of ids) {
        if (roomChanged(base) || isStale(base)) return; // 切房/新纪元 → 整轮作废
        if (turn >= MAX_AI_TURNS) break; // 保险：超大房间也不超过硬上限
        turn++;
        const content = await doReply(aiId, base, { focusUser: true }); // A：全员轮聚焦用户最新消息
        if (content !== null) {
            lastSender = aiId;
            lastContent = content;
        }
        await sleep(roundGap());
    }

    // 全员回复完，进入搭腔阶段（深度从 0 起算）
    if (lastSender && !roomChanged(base) && !isStale(base)) {
        void processNewMessage({
            ...base,
            message: { id: '', sender: lastSender, content: lastContent, timestamp: Date.now() },
            aiTurn: turn,
            banterTurn: 0,
        });
    }
};

// ===== 搭腔单条 = 回复 + 继续往下传 =====
const handleBanterReply = async (
    aiId: string,
    base: Base,
    replyTurn: number,
    banterTurn: number,
): Promise<void> => {
    const content = await doReply(aiId, base);
    if (content !== null && !roomChanged(base) && !isStale(base)) {
        void processNewMessage({
            ...base,
            message: { id: '', sender: aiId, content, timestamp: Date.now() },
            aiTurn: replyTurn,
            banterTurn,
        });
    }
};

// ===== 入口：决定谁来回复 =====
export const processNewMessage = async (params: ProcessParams): Promise<void> => {
    const { message, aiTurn = 0, banterTurn = 0, ...base } = params;

    // 用户每发一条新消息就开新纪元：上一轮所有还在排队/在途的回复立即作废，
    // 不会叠到新一轮上（也就不会突破 MAX_AI_TURNS）
    if (message.sender === 'user') {
        base.epoch = bumpEpoch(base.roomId);
    }

    const readyAIs = base.roomAIIds
        .map(id => base.allAIConfigs.find(c => c.id === id))
        .filter((c): c is AIConfig => c !== undefined);

    const mentions = message.mentioned || [];

    if (mentions.length > 0) {
        // 被 @ 的人各回一句（依次，保证都回）
        const ids = readyAIs.filter(c => mentions.includes(c.id)).map(c => c.id);
        void runRound(ids, base, aiTurn);
    } else if (message.sender === 'user') {
        // 用户发言：全员各回一句（保证全员参与）；只跳过被 activeHours 设为离线的
        const online = readyAIs.filter(c => !isOfflineByHours(c));
        const ids = (online.length ? online : readyAIs).map(c => c.id);
        void runRound(ids, base, 0);
    } else if (aiTurn < MAX_AI_TURNS) {
        // AI 搭腔：受总条数上限约束
        const candidates = readyAIs.filter(c => c.id !== message.sender);

        // B：上一句直接点了谁的名，就让谁优先接话（绕过衰减，把话题就地消化）
        const cued = detectCue(message.content, candidates);
        if (cued) {
            const id = cued.id;
            setTimeout(() => void handleBanterReply(id, base, aiTurn + 1, banterTurn + 1), banterDelay());
            return;
        }

        // 没人被点名：按各自(随搭腔深度衰减的)概率决定想不想接，想接的人里加权挑 1 个
        const willing = candidates.filter(c => {
            let p = (c.replyProbability / 100) * (DECAY ** banterTurn);
            if (isOfflineByHours(c)) p *= 0.25;
            return Math.random() < p;
        });
        const best = weightedPick(willing);
        if (best) {
            const id = best.id;
            setTimeout(() => void handleBanterReply(id, base, aiTurn + 1, banterTurn + 1), banterDelay());
        }
    }
};
