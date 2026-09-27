import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from '../src/cli.js';
import type { CliDeps } from '../src/cli.js';
import type { LlmClient } from '../src/llm/client.js';
import { collector, scriptedInput, tempRoot } from './helpers.js';

async function setupProject(): Promise<string> {
  const root = tempRoot();
  await runCli(['new', 'p'], { cwd: root });
  return join(root, 'p');
}

/** 按序返回预置回复的假 LLM */
function fakeLlm(replies: string[]): LlmClient & { calls: () => number } {
  let n = 0;
  return {
    calls: () => n,
    async complete(): Promise<string> {
      if (n >= replies.length) throw new Error('fake: 预置回复已用完');
      return replies[n++];
    },
  };
}

const q = (text: string) => JSON.stringify({ question: text, hint: '想想具体的场景' });

describe('命令 grill：LLM 自适应追问（有 key）', () => {
  it('配置就绪时用 LLM 生成下一问，8 问后完成', async () => {
    const projectRoot = await setupProject();
    const { collected, out } = collector();
    const llm = fakeLlm([
      q('你说要监测坐姿——监测的时候学生要一直开着摄像头吗？'),
      q('统计结果给谁看？老师还是学生自己？'),
      q('弯腰和趴桌要分开统计吗？'),
      q('一节课 45 分钟都统计，还是只统计某段时间？'),
      q('提醒是弹卡片还是响铃？'),
      q('数据需要保存下来做对比吗？'),
      q('这个项目为什么不用现成的坐姿提醒软件？'),
      q('如果检测不准，你打算怎么处理？'),
    ]);

    const result = await runCli(['grill'], {
      cwd: projectRoot,
      out,
      input: scriptedInput(['开着', '学生自己', '分开', '整节课', '卡片', '保存', '自己做的更懂课堂', '多测几次取平均']),
      llm,
    } satisfies CliDeps);

    expect(result.code).toBe(0);
    const text = collected.join('\n');
    expect(llm.calls()).toBe(8);
    expect(text).toContain('你说要监测坐姿——监测的时候学生要一直开着摄像头吗？');
    expect(text).toContain('拷问完成');
    const session = JSON.parse(readFileSync(join(projectRoot, '.ai-hero', 'grill-session.json'), 'utf8'));
    expect(session.answers).toHaveLength(8);
    expect(session.answers[0].answer).toBe('开着');
    const status = await runCli(['status'], { cwd: projectRoot });
    expect(status.lines.join('\n')).toContain('拷问：已完成');
  });

  it('LLM 调用失败时给出可读警告并降级为固定问卷继续', async () => {
    const projectRoot = await setupProject();
    const { collected, out } = collector();
    const llm = fakeLlm([]);
    llm.complete = async () => {
      throw new Error('网络不通');
    };

    const result = await runCli(['grill'], {
      cwd: projectRoot,
      out,
      input: scriptedInput(['监测坐姿', '学生上课时', '预防驼背', '摄像头画面', '姿势统计图表', '识别弯腰动作', '先只做统计', '能演示统计结果']),
      llm,
    } satisfies CliDeps);

    expect(result.code).toBe(0);
    const text = collected.join('\n');
    expect(text).toMatch(/降级|固定问卷/);
    expect(text).toContain('你的项目想法是什么');
    expect(text).toContain('拷问完成');
  });
});
