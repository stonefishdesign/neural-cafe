# replyEngine 逻辑详解

> 文件：`src/services/replyEngine.ts`
> 作用：决定一条新消息出现后，**哪些 AI 会回复、什么时候回复、回复时带什么上下文**，并控制 AI 之间的"接龙"不至于失控。

---

## 1. 设计目标（心智模型）

多 AI 群聊的对话机制：

- 你（真人）发一句话 → **群里每个 AI 都各回一句**（全员参与，保证不冷场、不漏人）；
- 全员回完后，AI 之间可以**继续搭腔接龙**几句，然后**自然收尾**（不会无限刷屏、不烧爆 API）；
- 被 `@` 点名的 AI **必回**；
- 每个 AI 的"话痨程度"由它自己的 `replyProbability` 决定（只影响**搭腔**阶段，不影响"全员各回一句"）。

> 这是 2.0 版逻辑。1.0 版是"用户发言只选一个人抢答"，会出现"明明在跟所有人说话却只有一个人回"的问题，已废弃。

---

## 2. 涉及的数据字段（来自 `AIConfig`）

| 字段 | 含义 | 用在哪 |
|---|---|---|
| `replyProbability` (0–100) | 这个 AI 有多爱**搭腔** | 搭腔阶段：是否开口的概率 + 加权选人的权重 |
| `activeHours` (可选) | 活跃时段 `{start,end}` | 不在时段内→`offline`：全员轮里**跳过**它，搭腔里概率/权重 ×0.25 |
| `systemPrompt` | 人设 | 拼进上下文的 system 段 |
| `model` / `apiType` / `apiKey` / `baseUrl` | 调哪个模型 | 见 `aiAPI.ts` |

聊天室侧（`RoomContext`）：`script`（剧本/场景）、`userIdentity`（你的显示名 + 人设）。

---

## 3. 可调常量（文件顶部）

```ts
const MAX_AI_TURNS = 6;   // 一次用户发言最多产生的 AI 消息总数（全员轮 + 搭腔）的硬上限
const DECAY = 0.65;       // 搭腔概率随【搭腔深度】衰减，越往后越容易收场
const MAX_CONTEXT = 15;   // 进入上下文的最近消息条数

const roundGap = () => Math.random() * 700 + 500;       // 全员轮里，每位之间的小间隔
const banterDelay = () => Math.random() * 2000 + 1500;  // 搭腔发言延迟
```

---

## 4. 整体数据流

```
你发消息 (App.handleSendMessage)
      │  addMessage('user', ...) 先落库
      ▼
processNewMessage({ message, aiTurn:0, ... })
      │   message.sender === 'user' → 进入【全员轮】
      ▼
runRound(全部在线成员, 打乱顺序)
      │   依次（await，一个接一个）：
      │   for ai of 打乱后的成员:
      │       doReply(ai)   ← typing → 取上下文 → callAI → 落库
      │       sleep(roundGap)
      │   （后一位能看到前一位刚说的话，像真的群聊轮流发言）
      ▼
全员回完 → processNewMessage({ message:{sender:最后一位}, aiTurn:N, banterTurn:0 })
      │   message.sender 是 AI → 进入【搭腔】
      ▼
搭腔：单个加权挑 1 人（按 replyProbability，概率随 banterTurn 衰减）
      │   选中 → setTimeout(banterDelay) → handleBanterReply
      │       doReply → 成功则再 processNewMessage(继续搭腔, aiTurn+1, banterTurn+1)
      ▼   …没人想接 / 到达 MAX_AI_TURNS → 自然结束
```

要点：
- **全员轮是顺序 await 的**（不是并发）：保证不漏人、不丢消息（避免并发写库互相覆盖），且后发言的能读到先发言的。
- **搭腔是单线递归**：每次只挑 1 个（杜绝分叉爆炸），靠衰减 + 硬上限收尾。
- `aiTurn` = 这一串里已产生的 AI 消息总数（管硬上限）；`banterTurn` = 搭腔深度（管概率衰减，全员轮后从 0 起算）。

---

## 5. 选人逻辑 `processNewMessage`

```ts
readyAIs = roomAIIds → configs   // 只在本房间的成员
```
按消息类型分三条路：

### A. 带 `@` 提及
被 `@` 到的成员 → `runRound`（依次各回一句，保证都回）。

### B. 来自用户（没 @）—— 全员轮
```ts
online = readyAIs 里 activeHours 允许的
runRound(online.length ? online : readyAIs, startTurn = 0)
```
→ **每个在线成员各回一句**。（若全员都被 activeHours 设为离线，则兜底让全体都回，保证有人应答。）

### C. 来自 AI（搭腔）
```ts
if (aiTurn < MAX_AI_TURNS) {
  candidates = readyAIs 去掉【刚发言者】

  // B：上一句直接点了谁的名 → 谁优先接话（绕过衰减，把话题就地消化）
  cued = detectCue(message.content, candidates)
  if (cued) { schedule(cued); return }

  // 没人被点名 → 衰减概率决定谁想接
  willing = candidates 里每人各 roll：
            p = (replyProbability/100) * DECAY^banterTurn   // 随搭腔深度衰减
            (offline 再 ×0.25)
            Math.random() < p ? 想接 : 不接
  best = weightedPick(willing)        // 想接的人里按概率加权挑 1 个
  if (best) schedule(best)
}
```
- **B（点名接力）**：`detectCue` 扫描上一句正文里有没有直接点到其他成员的名字（含去掉姓氏的简称，如「安陵容」→「陵容」）。点到了就让那个人**优先接一句**（不受衰减影响），把"你来我往"的话题在搭腔阶段消化掉，而不是被衰减硬掐断、留到下一轮才被人回（避免"串台"）。间接指代（如用"翊坤宫"代指华妃）检测不到。
- 没点名才走衰减概率；只挑 1 个（不分叉）；没人想接 → 链结束；`aiTurn` 到上限 → 强制结束。
- 注意：B 只跟进**搭腔链种子那条消息**（全员轮的最后一句、或上一条搭腔）的点名；全员轮中间几位互相点名不在此处单独跟进——它们靠下面的 A 来收敛。

### `weightedPick`
按 `replyProbability` 比例做轮盘赌选 1 个（offline ×0.25；全为 0 则等概率）。

---

## 6. 单条回复 `doReply`（核心，不递归）

签名：`doReply(aiId, base, opts?) => Promise<string | null>`，成功返回回复文本，跳过/失败返回 `null`（让其所在的搭腔链就此终止）。

1. **房间守卫**：`getCurrentRoomId() !== roomId`（你切走了）→ 放弃，连 API 都不调。
2. `onTypingStart` → UI"正在输入"。
3. `buildContext`：`await getLatestMessages()` —— **从后端（唯一真相源）拉最新消息**，再规整成合法对话轮 + system（见 §7）。
   > ⚠️ 不能用 React 的 `messagesRef`：它靠 `useEffect` 在渲染提交后才更新、**有滞后**。全员轮顺序很快，轮到靠前的成员时 ref 可能还没刷到用户刚发的那条，导致它"没看见新消息、回到上一轮"。改成每次 `getMessages(roomId)` 后端直取就没这问题（串行执行保证前一条已落库）。
4. `await callAI(...)` → 调真正的大模型；**若返回空 → 重试一次**。
5. **房间守卫**：API 期间你切走了 → 丢弃这条回复。
6. **仍为空** → 跳过（不发"(无响应)"，见 §9），返回 `null`。
7. `setCooldown`（UI 状态点，见 §8）→ `onTypingEnd` → `await onReply`（落库，保证后续上下文顺序）→ 返回文本。
8. 出错 → `onTypingEnd` + `onError`（**不把错误当成 AI 的消息发出来**，交给前端弹系统提示条），返回 `null`。

---

## 7. 上下文构建 `buildContext`（含为什么必须以 user 收尾）

### system 段
```
<人设 systemPrompt>
[场景设定]: <剧本>
[群聊成员]: 除了你，群里还有 小帅、小芙、林林。这是一个多人群聊…
[用户]: 真人用户叫"林林"。林林的背景: …
[当前重点]: 请直接回应林林刚说的「…」，不要纠缠之前其他人没说完的话题。   ← A，仅全员轮(focusUser)时加
回复请控制在 2-3 句话以内，保持聊天节奏。
```
**A（聚焦最新）**：`doReply` 在全员轮里传 `focusUser:true`，`buildContext` 就把"当前重点"钉在用户最新这句上。这样即使上一轮 AI 之间留了没说完的悬案，用户一旦再开口，全员都会先回用户、而不是去续旧话题（"下一轮回复上一轮内容"的主要解法）。搭腔阶段不加这条，保持自由发挥。

### 消息怎么变成对话轮（关键）
这是一个**多人群聊喂给单模型 API**的场景，只能用 `user / assistant` 两种角色表达"我 vs 其他所有人"。所以**同一段历史，给不同 AI 构建出的请求是不一样的**：

| 这条消息的发送者 | 在「为小芙构建」的请求里 | 在「为小帅构建」的请求里 |
|---|---|---|
| 小芙 | `assistant`（我自己） | `user`：`[小芙]: …` |
| 小帅 | `user`：`[小帅]: …` | `assistant`（我自己） |
| 林林（真人） | `user`：`[林林]: …` | `user`：`[林林]: …` |

> 所以你在 provider 日志里看到"只有小芙是 assistant、其他都是 user"——**不是 bug**，那条请求就是为小芙构建的；它自己=assistant，别人（含真人）=user。

### 三道"交规"处理（`buildContext` 末尾）
直接把上面的映射丢给模型会踩坑：**OpenAI 比较宽容，但 Gemini（以及包它的代理）要求 user/assistant 严格交替，且对话必须以 user 收尾**。否则——

> ⚠️ **实测确诊**：当 prompt 结尾停在"模型自己那条 assistant"时（即该 AI 正好是上一个发言者），Gemini 没有要回应的 user 输入，会返回**空内容**（`finish_reason: stop`、`completion_tokens: 0/1`，只吐一个 `\n`）。这就是"无响应"的真正成因，也解释了"上轮最后发言者下轮常无响应"。

所以做了三步规整：
1. **合并连续同角色**：把挨着的多条 `user`（林林、别的 AI 混在一起）并成一条，满足"交替"。
2. **去掉开头的 assistant**：首轮必须是 user。
3. **结尾强制为 user**：若整段停在自己那句 assistant，就补一条 user 提示 `（请以"小芙"的身份，自然地接着上面的群聊回一句）`，给模型一个可回应的落点。

最终发出去的就是：`system → user → (assistant) → user → … → user` ⇒ 模型生成 assistant。各家 provider 都吃得下。

---

## 8. 冷却 `cooldowns`（现在只剩 UI 用途）

2.0 里**不再用冷却来门控选人**（全员轮要求人人都回、搭腔靠衰减收尾）。`setCooldown` 仅在回复后打个时间戳，让 `getAIStatus` 返回 `cooldown`，UI 头部小圆点短暂变色，表示"刚说过话"。`getAIStatus` 还会按 `activeHours` 返回 `offline`。

> 这个 Map 仍是**全局**的、跨房间共享、刷新页面才清空。

---

## 9. 出错 & 空响应处理（都不污染聊天）

**出错**（网络错误、4xx/5xx 等）：`doReply` 抛错 → `handlers.onError(aiId, error)`。`App.tsx` 里 `onError` **不再 `addMessage`**，而是 `showNotice(...)` 弹一条**系统提示条**（输入框上方，6 秒自动消失）。不会出现"角色说 400 error"。

**空响应**（调用成功但 content 为空，见 §7）：双保险
1. `aiAPI` 把空内容返回 `''`（不再兜底成 `"(无响应)"`），并 `console.warn('[空响应] … finish_reason=…', 原始返回)` 便于排查（注意：日志在**浏览器控制台**，不是 server.js）。
2. `doReply` 拿到空串 → **重试一次**；仍空 → **当作这位这轮没接话，直接跳过**（群聊里本就不必人人出声），`console.warn('[跳过] …')`。
3. 配合 §7 的"结尾强制为 user"，空响应已基本不会发生；这里是兜底。

> AI 调用全在**前端**（浏览器直接 fetch provider），`server.js` 只负责存 JSON。所以所有 AI 相关日志看 DevTools → Console。

---

## 10. 行为预期

- 你发一句 → 群里**每位在线成员各回一句**（顺序、错落出现）。
- 之后**有一定概率继续搭腔几句**（受 `replyProbability` + 衰减影响），到 `MAX_AI_TURNS` 封顶或没人想接为止。
- 全员轮**不看 `replyProbability`**（人人都回）；`replyProbability` 只决定搭腔阶段谁更爱接话。
- 某个 AI 配置坏了（如模型名错误）→ 它那一条静默失败、弹系统提示条，不影响别人回复，也不会刷屏。

---

## 11. 想调手感时可以动的地方

| 想要的效果 | 改哪里 |
|---|---|
| 全员轮后多搭几句 / 更容易到 6 轮 | 调高 `DECAY`（如 0.8）、调高 `MAX_AI_TURNS` |
| 全员轮后基本不搭腔、答完就停 | 调低 `DECAY`（如 0.4）、或把 `MAX_AI_TURNS` 设成房间人数 |
| 某个 AI 搭腔更积极 | 调高它的 `replyProbability` |
| 全员轮发言更快/更慢 | 改 `roundGap()` |
| 某 AI 夜里不说话 | 给它设 `activeHours`（全员轮会跳过离线的它） |
| 多房间冷却互不干扰 | 把全局 `cooldowns` 改成"按房间"的 Map |

> 注意：全员轮是顺序 await 的，房间人多时（最多 3 人）总时长 ≈ 各自 API 延迟之和，属正常。
