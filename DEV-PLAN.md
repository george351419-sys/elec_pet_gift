# DEV-PLAN：魔法宠物（Magic Pet）

**状态**：Phase 0 - 未开始
**最后更新**：2026-06-23
**关联文档**：Product-Spec.md · Design-Brief.md

---

## 技术上下文

| 项目 | 值 |
|------|----|
| 运行时 | Node.js v24.14.0 |
| 包管理器 | npm 11.9.0 |
| 前端 | React 18 + TypeScript + Vite |
| 后端 | Express + TypeScript，用 `tsx` 热重载 |
| 语音模块 | `full-duplex-voice/`（已实现，本地路径引用） |
| 记忆提取 | DeepSeek Chat API（`YOUR_DEEPSEEK_API_KEY`） |
| 数据存储 | `localStorage`（demo 阶段） |
| 宠物动画 | PNG 分帧 + CSS animation |
| 部署 | 本地 dev server（demo 阶段） |

### 目录结构（目标）

```
elec_pet_ gift/
├── full-duplex-voice/          ← 已有，不改
├── app/                        ← 本次新建
│   ├── client/                 ← Vite + React 前端
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx         ← Tab shell
│   │   │   ├── tabs/
│   │   │   │   ├── ParentTab.tsx
│   │   │   │   └── PetTab.tsx
│   │   │   ├── components/
│   │   │   │   ├── PetAvatar.tsx
│   │   │   │   ├── ProfileForm.tsx
│   │   │   │   ├── PetSelector.tsx
│   │   │   │   └── SubtitleArea.tsx
│   │   │   ├── lib/
│   │   │   │   ├── storage.ts   ← localStorage 读写
│   │   │   │   └── memoryApi.ts ← 调用后端记忆接口
│   │   │   └── assets/pets/     ← PNG 资产（15 张）
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── server/                 ← Express 后端
│       ├── src/
│       │   ├── index.ts        ← 挂载所有路由，启动服务
│       │   └── memory.ts       ← DeepSeek 记忆提取路由
│       ├── tsconfig.json
│       └── package.json
└── package.json                ← 根 workspace（并发启动前后端）
```

### 启动命令

```bash
# 安装所有依赖
npm install

# 开发模式（前后端并发）
npm run dev

# 前端单独：http://localhost:5173
# 后端单独：http://localhost:3000
# Vite 代理 /api/* → http://localhost:3000
```

### 环境变量（`.env` 放在 `app/server/`）

```
VOLC_ACCESS_KEY_ID=
VOLC_SECRET_ACCESS_KEY=
VOLC_RTC_APP_ID=
VOLC_RTC_APP_KEY=
DOUBAO_VOICE_APP_ID=
DOUBAO_VOICE_ACCESS_TOKEN=
DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY
```

---

## 规划原则

- 每个 Phase 结束时必须能编译、启动、展示用户可见的结果
- 高风险依赖（RTC 连接、DeepSeek API）在 Phase 0/1 验证，不留到最后
- 每个 Phase 的完成标准是可验证的行为，不是"代码写了"

---

## Phase 0：项目脚手架（基础可运行）

**目标**：`npm run dev` 能启动，前后端联通，语音模块接口可用

### 任务清单

- [ ] 创建根 `package.json`（workspaces: `app/client`, `app/server`），scripts: `dev` 用 `concurrently` 并发启动
- [ ] 创建 `app/client/`：`npm create vite@latest`，模板选 `react-ts`
- [ ] 配置 `vite.config.ts`：proxy `/api` → `http://localhost:3000`
- [ ] 创建 `app/server/`：`package.json` + `tsconfig.json`，依赖 `express tsx dotenv`
- [ ] `app/server/src/index.ts`：启动 Express，挂载 `full-duplex-voice` 路由到 `/api/full-duplex-voice`
- [ ] 将 `full-duplex-voice/` 以本地路径方式引入（`"@magic-pet/full-duplex-voice": "file:../../full-duplex-voice"`）
- [ ] 验证 `GET /api/full-duplex-voice/status` 返回 JSON

### 完成标准

```bash
npm run dev
# → 前端: http://localhost:5173 能打开（React 默认页面）
# → 后端: curl http://localhost:3000/api/full-duplex-voice/status 返回 {"ok":true,...}
```

---

## Phase 1：App Shell + 数据层

**目标**：Tab 框架上屏，localStorage 工具就绪，设计系统基础色/字体/圆角到位

### 任务清单

- [ ] `App.tsx`：两个 Tab（`家长设置` / `宠物陪伴`），Tab 激活态样式（主色下划线）
- [ ] Tab 切换动画：`opacity` + `translateY(8px)`，150ms ease-out
- [ ] 全局 CSS：背景渐变（`#FFF8F0 → #EDE7FF`），max-width 480px 居中，字体族设置
- [ ] `lib/storage.ts` 实现以下函数，每个配 JSDoc 示例：
  - `getProfile() → PetProfile | null`
  - `saveProfile(p: PetProfile) → void`
  - `getFacts() → FactEntry[]`
  - `saveFacts(facts: FactEntry[]) → void`
  - `getSummaries() → ConversationSummary[]`
  - `saveSummaries(s: ConversationSummary[]) → void`
- [ ] Tab 1/2 各放一个占位卡片（白色 `border-radius: 20px`，文字说明内容待填）
- [ ] Header：Logo 文字 `魔法宠物` + Tab 切换控件

### 完成标准

```
视觉验证：
- 背景渐变可见，Tab 可切换，激活态高亮
- 两个 Tab 各有白色占位卡片

代码验证：
- storage.ts 函数可在浏览器 Console 调用，读写 localStorage 正常
```

---

## Phase 2：家长 Tab —— 语音访谈

**目标**：家长可以完成一次完整的语音访谈，对话记录保存到 localStorage

### 任务清单

- [ ] 在 `ParentTab.tsx` 引入 `FullDuplexVoice` 组件，`mode="parent_onboarding"`
- [ ] 自定义 `renderAvatar`：显示 AI 引导师"小颖"头像（简单 emoji 或纯文字占位即可）
- [ ] `onComplete` 回调：将完整 `transcript`（仅 final turns）存入 `localStorage['magic_pet_raw_transcript']`
- [ ] 访谈结束后，组件折叠为"继续补充"文字按钮（`phase === 'ended'` 时切换展示）
- [ ] 状态摘要行（Tab 1 顶部）：显示"档案状态：未完成"，访谈结束后变"待提取"
- [ ] 环境变量文件（`.env`）创建说明：`README.md` 补充环境变量配置步骤

### 完成标准

```
完整路径验证：
1. 点击「开始语音访谈」→ 弹出麦克风权限请求
2. 完成一段对话（至少说 3 句话）
3. 点击「结束访谈」
4. localStorage['magic_pet_raw_transcript'] 有内容（数组，含 role/content/final）
5. 访谈区折叠，显示「继续补充」按钮
```

---

## Phase 3：家长 Tab —— 档案提取 + 宠物选择

**目标**：访谈结束后 AI 自动填充档案字段，家长确认后选择宠物，数据保存到 localStorage

### 任务清单

**后端：DeepSeek 提取接口**
- [ ] `app/server/src/memory.ts`：`POST /api/memory/extract`
  - 接收 `{ transcript: TranscriptTurn[], existingProfile?: Partial<PetProfile> }`
  - 调用 DeepSeek Chat API（`https://api.deepseek.com/chat/completions`，model: `deepseek-chat`）
  - System prompt：根据对话提取 nickname / age / personality / likes / fears / comfort / memories / encouragement
  - 返回 `{ profile: Partial<PetProfile> }`
- [ ] 错误处理：DeepSeek 超时或失败时返回 `{ profile: {} }`，前端降级为手动填写

**前端：档案表单**
- [ ] `ProfileForm.tsx`：9 个字段的表单（见 Spec 2.2 功能 B）
  - 性格标签：`['活泼', '安静', '好奇', '敏感', '爱笑', '粘人', '独立']` 多选 chip
  - 其他字段：单行 input 或多行 textarea（亲子回忆）
  - 全部字段圆角 12px，focus 主色边框
- [ ] 访谈结束后自动调用 `/api/memory/extract`，loading 状态显示 spinner
- [ ] 提取结果自动填入表单，家长可二次编辑
- [ ] "保存档案"按钮 → `saveProfile()`，toast 提示"已保存"

**前端：宠物选择**
- [ ] `PetSelector.tsx`：5 张宠物卡片，横向滚动
  - 宠物列表：`british_shorthair`/`american_shorthair`/`teddy`/`shiba`/`golden`
  - 每张卡含：宠物 PNG（idle 帧）+ 中文名 + 性格一句话
  - 选中态：主色边框 + 淡紫背景
- [ ] "确认选择"按钮 → 更新 `profile.petType` + `saveProfile()`
- [ ] 宠物 PNG 资产：**15 张**（5 种 × 3 帧：`_idle` / `_talking1` / `_talking2`）
  - demo 阶段用 AI 生成（Midjourney / DALL·E / 即梦）或外购免版权素材
  - 放置路径：`app/client/src/assets/pets/`
  - 规格：400×400px 透明背景 PNG

### 完成标准

```
完整路径验证：
1. 完成访谈 → 自动调用提取接口 → 表单自动填充（nickname 等字段有内容）
2. 修改一个字段 → 点「保存档案」→ localStorage['magic_pet_profile'] 有正确数据
3. 选择「柴犬」→ 点「确认选择」→ profile.petType === 'shiba'
4. 刷新页面 → 档案和选择持久化（从 localStorage 恢复）
```

---

## Phase 4：宠物 Tab —— 形象展示 + 语音对话

**目标**：孩子可以与宠物全双工语音对话，宠物说话时有动画，双方字幕实时显示

### 任务清单

**宠物形象**
- [ ] `PetAvatar.tsx`：接收 `petType` + `remoteLevel: number` props
  - idle 态：显示 `{type}_idle.png`，加 `breathe` CSS animation（scale 1→1.03，3s loop）
  - talking 态（`remoteLevel > 0.05`）：每 100ms 根据 `remoteLevel` 在 `talking1`/`talking2` 帧间切换
  - 外层：圆形光晕背景（`radial-gradient`，200px 直径）
- [ ] 宠物昵称显示（从 `profile.petName` 读取，fallback 为宠物中文名）

**语音对话**
- [ ] `PetTab.tsx` 挂载 `FullDuplexVoice`，`mode="child_pet"`
- [ ] `context` 构建函数 `buildPetContext()`：
  ```typescript
  {
    persona: { petType, petName, ...profile },
    memory: { facts: getFacts(), summaries: getSummaries().slice(-3) }
  }
  ```
- [ ] `renderAvatar` prop：将 `VoiceState.remoteLevel` 传给 `PetAvatar`
- [ ] 无档案时（`getProfile() === null`）：禁用对话按钮，显示引导文字

**字幕区**
- [ ] `SubtitleArea.tsx`：接收 `turns: TranscriptTurn[]` 显示最近 2 条
  - agent 角色：`font-size: 22px`，颜色 `#3D2B6B`
  - child 角色：`font-size: 13px`，颜色 `#888`，前缀"你说："
  - 新字幕 `translateY(6px)` 淡入动画

### 完成标准

```
完整路径验证：
1. 完成 Phase 3（有档案）→ 切换到「宠物陪伴」Tab
2. 看到对应宠物形象 + 宠物昵称，idle 呼吸动画可见
3. 点击「开始对话」→ 宠物说欢迎语 → 嘴部动画启动
4. 说一句话 → 孩子字幕出现 → 宠物回应 → 宠物字幕出现
5. 点「打断」→ 宠物停止说话
6. 点「结束」→ 宠物说再见 → 动画停止
```

---

## Phase 5：记忆系统 L2 / L3

**目标**：每次对话结束后提取关键记忆，下次对话注入，宠物能"记住"孩子说过的事

### 任务清单

**后端：记忆更新接口**
- [ ] `POST /api/memory/update`
  - 接收 `{ transcript: TranscriptTurn[], existingFacts: FactEntry[], sessionDate: string }`
  - DeepSeek 调用 1：从本次对话提取重要事实（JSON 数组，key/value 格式）
  - DeepSeek 调用 2：若 turns > 5，生成对话摘要（≤100 字）
  - 合并逻辑：相同 key 的事实做 UPDATE，新 key 做 ADD
  - 返回 `{ updatedFacts: FactEntry[], newSummary: ConversationSummary | null }`

**前端：对话结束触发**
- [ ] `PetTab.tsx` 的 `onComplete` 回调：
  1. 调用 `POST /api/memory/update`，传入本次 transcript
  2. 用返回值更新 `localStorage` L2（facts）和 L3（summaries，最多保留 20 条）
  3. 失败时静默（不影响用户）

**验证记忆注入**
- [ ] 确认 `buildPetContext()` 在下次对话开始时从 localStorage 读取最新 facts + summaries
- [ ] `doubao-s2s.ts` 的 `buildDefaultInstructions` 已支持 `context.memory` 注入（检查现有实现）

### 完成标准

```
完整路径验证：
1. Session 1：跟宠物说"我最喜欢恐龙"，结束对话
2. 等待记忆更新完成（1-3秒）
3. Session 2：开始新对话，宠物主动提到"你上次说很喜欢恐龙"或相关话题
4. localStorage['magic_pet_facts'] 含 { key: 'likes', value: '恐龙' } 类似条目
```

---

## 当前焦点

**验证** — 端到端流程测试

---

## 技术决策

| 决策 | 原因 |
|------|------|
| 宠物动画用 PNG 帧而非 Spline/Lottie | demo 速度优先，PNG 无外部依赖，易于替换 |
| 记忆提取用 DeepSeek 独立 API 调用 | 与豆包 S2S 解耦，提取质量更可控，成本低 |
| localStorage 而非后端数据库 | demo 阶段无需账号体系，快速验证 |
| full-duplex-voice 以本地路径引用 | 模块已验证，避免 npm 发布流程 |
| 前后端分离（Vite proxy） | 开发体验好，后期小程序化时后端可独立部署 |
| Tab 切换不用 React Router | 单页两个 Tab，不需要 URL 路由复杂度 |

---

## 风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| PNG 宠物资产制作耗时 | 高 | 中 | Phase 3/4 并行准备资产，Phase 0-2 用色块占位 |
| DeepSeek 结构化提取格式不稳定 | 中 | 中 | system prompt 强制 JSON 输出，前端 try/catch 降级 |
| 豆包 S2S 上线环境缺少配置 | 中 | 高 | Phase 0 立即验证 `/status` 接口，确认 env 完整 |
| localStorage 存储超限（>10MB） | 低 | 低 | 记忆摘要限 20 条，单条 ≤100 字 |
| 宠物 PNG 帧切换在低端手机卡顿 | 低 | 低 | 帧切换间隔 100ms，仅 3 帧，性能无忧 |

---

## Phase 完成记录

| Phase | 状态 | 完成时间 | 备注 |
|-------|------|----------|------|
| 0 | 完成 | 2026-06-23 | 服务启动，status 返回 realtimeReady:true，vite build 通过 |
| 1 | 完成 | 2026-06-23 | Tab 框架、CSS 系统、storage.ts、memoryApi.ts，vite build + typecheck 通过 |
| 2 | 完成 | 2026-06-23 | ParentTab + FullDuplexVoice 集成，transcript 保存到 localStorage，typecheck 0 errors |
| 3 | 完成 | 2026-06-23 | DeepSeek extract/update 端点，ProfileForm，PetSelector，ParentTab 完整流程 |
| 4 | 完成 | 2026-06-23 | PetAvatar、SubtitleArea、PetTab，宠物动画 + 全双工语音集成，typecheck 0 errors |
| 5 | 完成 | 2026-06-23 | memory.ts /extract /update，L2 事实提取，L3 对话压缩，PetTab onComplete 触发 |
