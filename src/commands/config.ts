import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_BASE_URL, DEFAULT_MODEL, defaultConfigPath, resolveConfig } from '../llm/client.js';
import type { CliDeps, CliResult } from '../cli.js';

/** config：交互式配置 LLM；非交互时打印生效配置概览。 */
export async function configCommand(_args: string[], deps: CliDeps): Promise<CliResult> {
  const out = deps.out ?? (() => {});
  const file = deps.configFile ?? defaultConfigPath();

  if (!deps.input) {
    const cfg = resolveConfig({ configFile: file, env: deps.env });
    if (!cfg) {
      out('LLM 尚未配置。在交互终端运行 ai-hero config，或设置环境变量：');
      out('AI_HERO_API_KEY / AI_HERO_BASE_URL / AI_HERO_MODEL');
      return { code: 1, lines: [] };
    }
    out(`配置来源：${cfg.source === 'env' ? '环境变量' : '配置文件'}`);
    out(`Base URL：${cfg.baseUrl}`);
    out(`模型：${cfg.model}`);
    out(`API Key：已设置（${cfg.apiKey.slice(0, 4)}****）`);
    return { code: 0, lines: [] };
  }

  out('配置 LLM（兼容 OpenAI 接口格式，DeepSeek / 智谱 / Kimi 等均可。直接回车采纳默认值）');
  const baseUrl = (await deps.input(`Base URL（默认 ${DEFAULT_BASE_URL}）：`))?.trim() || DEFAULT_BASE_URL;
  const apiKey = (await deps.input('API Key（必填）：'))?.trim() ?? '';
  if (!apiKey) {
    out('✗ 未提供 API Key，未保存任何更改。');
    return { code: 1, lines: [] };
  }
  const model = (await deps.input(`模型（默认 ${DEFAULT_MODEL}）：`))?.trim() || DEFAULT_MODEL;

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ baseUrl, apiKey, model }, null, 2) + '\n', 'utf8');
  out(`配置已保存：${file}`);
  out('现在运行 ai-hero grill 可以体验智能追问。');
  return { code: 0, lines: [] };
}
