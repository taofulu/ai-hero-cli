# OpenAI 兼容 API + 离线降级

LLM 接入不绑定任何一家供应商：用 OpenAI 兼容的 `/chat/completions` 协议，base URL 与 API key 由学生自配（DeepSeek、智谱、Kimi 等国产模型均可）。未配置 key 时整体降级为内置固定问卷 + 模板合成，CLI 不联网也完整可用。

选 OpenAI 兼容格式而非某家官方 SDK：高中生（国内环境）无法稳定访问 OpenAI，而国产主流供应商全部兼容该格式；自实现 HTTP 调用也让依赖保持极简。降级不是可选项而是产品要求——目标用户没有付费能力和稳定性保证。
