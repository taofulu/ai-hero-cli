import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from '../src/cli.js';
import type { LlmClient } from '../src/llm/client.js';
import { OFFLINE_ANSWERS, collector, scriptedInput, tempRoot } from './helpers.js';

async function setupProjectWithAnswers(llm?: LlmClient): Promise<string> {
  const root = tempRoot();
  await runCli(['new', 'p'], { cwd: root });
  const projectRoot = join(root, 'p');
  await runCli(['grill'], {
    cwd: projectRoot,
    out: () => {},
    input: scriptedInput(OFFLINE_ANSWERS),
    llm,
  });
  return projectRoot;
}

describe('命令 spec：合成 Spec（离线模板路径）', () => {
  it('无 key 时用模板把问答合成为中文 spec.md 并完成 Spec 步', async () => {
    const projectRoot = await setupProjectWithAnswers();
    const { collected, out } = collector();

    const result = await runCli(['spec'], { cwd: projectRoot, out });

    expect(result.code).toBe(0);
    const file = join(projectRoot, 'docs', 'spec.md');
    expect(existsSync(file)).toBe(true);
    const text = readFileSync(file, 'utf8');
    expect(text).toContain('用户故事');
    expect(text).toContain('监测坐姿');
    expect(text).toContain('识别弯腰动作');
    const status = await runCli(['status'], { cwd: projectRoot });
    expect(status.lines.join('\n')).toContain('Spec：已完成');
  });

  it('重新运行 spec 覆盖旧文档', async () => {
    const projectRoot = await setupProjectWithAnswers();
    const file = join(projectRoot, 'docs', 'spec.md');
    writeFileSync(file, '旧文档内容', 'utf8');

    await runCli(['spec'], { cwd: projectRoot, out: () => {} });

    const text = readFileSync(file, 'utf8');
    expect(text).not.toContain('旧文档内容');
    expect(text).toContain('监测坐姿');
  });

  it('还没有拷问回答时报错提示先运行 grill', async () => {
    const root = tempRoot();
    await runCli(['new', 'fresh'], { cwd: root });
    const { collected, out } = collector();

    const result = await runCli(['spec'], { cwd: join(root, 'fresh'), out });

    expect(result.code).not.toBe(0);
    expect(collected.join('\n')).toMatch(/grill/);
  });
});

describe('命令 spec：LLM 合成路径', () => {
  it('有 key 时由 LLM 结构化输出渲染 spec.md', async () => {
    const projectRoot = await setupProjectWithAnswers();
    const { collected, out } = collector();
    const llm: LlmClient = {
      async complete(): Promise<string> {
        return JSON.stringify({
          title: '课堂坐姿监测与矫正助手',
          problem: '学生长期驼背影响视力与脊柱健康',
          solution: '用摄像头姿态检测统计不良姿势时长并给出图表',
          userStories: ['作为学生，我想看到自己的坐姿统计，以便及时矫正', '作为老师，我想了解全班坐姿情况'],
          decisions: ['第一版只做统计，不做提醒'],
          outOfScope: ['手机端'],
        });
      },
    };

    const result = await runCli(['spec'], { cwd: projectRoot, out, llm });

    expect(result.code).toBe(0);
    const text = readFileSync(join(projectRoot, 'docs', 'spec.md'), 'utf8');
    expect(text).toContain('课堂坐姿监测与矫正助手');
    expect(text).toContain('学生长期驼背影响视力与脊柱健康');
    expect(text).toContain('作为学生，我想看到自己的坐姿统计');
    expect(text).toContain('手机端');
  });
});
