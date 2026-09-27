import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type LlmConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

/** LLM 调用的窄接口：命令层依赖它，测试注入 fake，真实实现保持极薄。 */
export interface LlmClient {
  complete(prompt: string, system?: string): Promise<string>;
}

export const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
export const DEFAULT_MODEL = 'deepseek-chat';

export function defaultConfigPath(homedir?: string): string {
  const home = homedir ?? process.env.HOME ?? process.env.USERPROFILE ?? '';
  return join(home, '.ai-hero', 'config.json');
}

/**
 * 解析生效的 LLM 配置：环境变量优先于配置文件。
 * 无 API key 时返回 null（离线降级）。
 */
export function resolveConfig(opts: {
  configFile?: string;
  env?: NodeJS.ProcessEnv;
  homedir?: string;
}): (LlmConfig & { source: 'env' | 'file' }) | null {
  const env = opts.env ?? process.env;
  const envKey = env.AI_HERO_API_KEY?.trim();
  if (envKey) {
    return {
      baseUrl: env.AI_HERO_BASE_URL?.trim() || DEFAULT_BASE_URL,
      apiKey: envKey,
      model: env.AI_HERO_MODEL?.trim() || DEFAULT_MODEL,
      source: 'env',
    };
  }

  const file = opts.configFile ?? defaultConfigPath(opts.homedir);
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  try {
    const cfg = JSON.parse(raw) as Partial<LlmConfig>;
    if (!cfg.apiKey?.trim()) return null;
    return {
      baseUrl: cfg.baseUrl?.trim() || DEFAULT_BASE_URL,
      apiKey: cfg.apiKey.trim(),
      model: cfg.model?.trim() || DEFAULT_MODEL,
      source: 'file',
    };
  } catch {
    return null;
  }
}

/** OpenAI 兼容 /chat/completions 的极薄封装（全局 fetch，无 SDK）。 */
export class OpenAiCompatibleClient implements LlmClient {
  constructor(private readonly config: LlmConfig) {}

  async complete(prompt: string, system?: string): Promise<string> {
    const messages: { role: string; content: string }[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ model: this.config.model, messages, temperature: 0.7 }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LLM API 返回 ${res.status}：${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM API 返回内容为空');
    return content;
  }
}
