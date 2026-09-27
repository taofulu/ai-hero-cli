# ai-hero-cli

面向高中生的 AI 项目教练：在终端里带你走完自己的 AI 项目——从一句模糊的想法，到一份能看懂的 Spec，再到一张张可以动手做的任务卡。

工作流产品化自 [mattpocock/skills](https://github.com/mattpocock/skills) 的五步法：**拷问 → Spec → 任务卡 → 实现 → 审查**。

## 安装

```bash
git clone https://github.com/taofulu/ai-hero-cli.git
cd ai-hero-cli
npm install
npm run build
npm link   # 之后可以直接运行 ai-hero
```

要求 Node 20+。

## 快速上手

```bash
# 1. 创建你的学生项目（会自动 git init）
ai-hero new 体态监测

cd 体态监测

# 2. 拷问：教练一次一问，把你的想法逼清楚
#    没配置 API key 也能用（内置固定问卷）
ai-hero grill

# 3. 把拷问回答合成 Spec（docs/spec.md）
ai-hero spec

# 4. 把 Spec 切成任务卡（docs/tickets/）
ai-hero tickets

# 5. 随时看进度
ai-hero status
```

回答"不知道"会得到提示；中途退出（`q` 或 Ctrl+C 结束输入）会自动保存进度，下次 `ai-hero grill` 从未答的题继续。拷问完成后重跑 `ai-hero grill` 可逐题修改答案（回车保留原答案），改完再跑 `ai-hero spec` 即可覆盖旧 Spec。

## 配置 LLM（可选）

没有 LLM 时教练用固定问卷 + 模板，完整可用。配置后拷问会变成针对你想法的自适应追问，Spec 和任务卡也由 LLM 合成：

```bash
ai-hero config   # 交互式输入 Base URL / API Key / 模型
```

兼容 OpenAI 接口格式的服务都可以（DeepSeek、智谱、Kimi 等），默认指向 DeepSeek。也可以用环境变量（优先级更高）：

```bash
export AI_HERO_API_KEY=sk-xxx
export AI_HERO_BASE_URL=https://api.deepseek.com/v1   # 可选
export AI_HERO_MODEL=deepseek-chat                     # 可选
```

查看当前生效配置：不带参数运行 `ai-hero config`。

## MVP 边界

当前版本覆盖五步法的前半程（拷问 / Spec / 任务卡）。`implement` 与 `review` 是占位命令，远期形态为"学生写码 + AI 辅导"（LLM 生成骨架与测试，学生填核心代码，LLM 再审查）。详见 [ADR-0001](docs/adr/0001-mvp-front-half-only.md)。

## 开发

```bash
npm test        # 全量测试（Vitest）
npm run test:watch
npm run typecheck
npm run build
```

测试走命令层接缝：注入 fake LLM 与临时目录，只断言外部行为（终端输出 + 落盘产物）。

## 设计文档

- [CONTEXT.md](CONTEXT.md)：领域术语表
- [docs/adr/](docs/adr/)：架构决策（MVP 前半程、LLM 接入与离线降级、产物落盘、分步子命令）
- [docs/agents/](docs/agents/)：AI 协作约定（issue tracker、triage 标签、领域文档）
