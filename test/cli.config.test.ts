import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from '../src/cli.js';
import type { CliDeps } from '../src/cli.js';
import { collector, scriptedInput, tempRoot } from './helpers.js';

const PROJECT_STEPS = async (deps: CliDeps) => {
  await runCli(['new', 'p'], { cwd: deps.cwd });
  return join(deps.cwd, 'p');
};

describe('命令 config：配置 LLM', () => {
  it('交互式问答后把配置写入配置文件', async () => {
    const root = tempRoot();
    const configFile = join(root, '.ai-hero-config.json');
    const { collected, out } = collector();

    const result = await runCli(['config'], {
      cwd: root,
      configFile,
      out,
      input: scriptedInput(['https://api.deepseek.com/v1', 'sk-test-123', 'deepseek-chat']),
    });

    expect(result.code).toBe(0);
    expect(existsSync(configFile)).toBe(true);
    const cfg = JSON.parse(readFileSync(configFile, 'utf8'));
    expect(cfg.apiKey).toBe('sk-test-123');
    expect(cfg.baseUrl).toBe('https://api.deepseek.com/v1');
    expect(cfg.model).toBe('deepseek-chat');
    expect(collected.join('\n')).toContain('配置已保存');
  });

  it('直接回车采纳默认值（DeepSeek）', async () => {
    const root = tempRoot();
    const configFile = join(root, 'cfg.json');

    await runCli(['config'], {
      cwd: root,
      configFile,
      out: () => {},
      input: scriptedInput(['', 'sk-default', '']),
    });

    const cfg = JSON.parse(readFileSync(configFile, 'utf8'));
    expect(cfg.baseUrl).toBe('https://api.deepseek.com/v1');
    expect(cfg.model).toBe('deepseek-chat');
    expect(cfg.apiKey).toBe('sk-default');
  });

  it('非交互运行时打印生效配置概览，环境变量优先于配置文件', async () => {
    const root = tempRoot();
    const configFile = join(root, 'cfg.json');
    const { collected, out } = collector();

    // 无任何配置
    await runCli(['config'], { cwd: root, configFile, out });
    expect(collected.join('\n')).toContain('未配置');

    // 配置文件有 key
    await runCli(['config'], {
      cwd: root,
      configFile,
      out: () => {},
      input: scriptedInput(['', 'sk-file', '']),
    });
    collected.length = 0;
    await runCli(['config'], { cwd: root, configFile, out, env: {} });
    expect(collected.join('\n')).toContain('配置文件');

    // 环境变量优先
    collected.length = 0;
    await runCli(['config'], {
      cwd: root,
      configFile,
      out,
      env: { AI_HERO_API_KEY: 'sk-env' },
    });
    const text = collected.join('\n');
    expect(text).toContain('环境变量');
  });
});
