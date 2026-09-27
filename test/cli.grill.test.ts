import { describe, expect, it } from 'vitest';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCli } from '../src/cli.js';
import type { CliDeps } from '../src/cli.js';

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'ai-hero-test-'));
}

/** 建好一个学生项目，返回项目根目录与带收集器的 deps */
async function setupProject(): Promise<{ root: string; deps: () => CliDeps & { collected: string[] } }> {
  const root = tempRoot();
  await runCli(['new', 'p'], { cwd: root });
  const projectRoot = join(root, 'p');
  return {
    root: projectRoot,
    deps: () => {
      const collected: string[] = [];
      return { cwd: projectRoot, collected, out: (line: string) => collected.push(line) };
    },
  };
}

/** 把脚本化答案包成 input 提供器，答案用完后返回 undefined（模拟终端结束） */
function scriptedInput(answers: string[]): (prompt: string) => Promise<string | undefined> {
  const queue = [...answers];
  return async () => (queue.length > 0 ? queue.shift() : undefined);
}

describe('命令 grill：离线拷问（无 key）', () => {
  it('依次呈现内置问卷全部问题，答完输出问答汇总并落盘', async () => {
    const { root, deps } = await setupProject();
    const d = deps();

    const result = await runCli(['grill'], { ...d, input: scriptedInput(['监测坐姿', '学生上课时', '预防驼背', '摄像头画面', '姿势统计图表', '识别弯腰动作', '先只做统计', '能演示统计结果']) });

    expect(result.code).toBe(0);
    const text = d.collected.join('\n');
    // 一次一问带进度
    expect(text).toMatch(/第 1\/8 题/);
    expect(text).toContain('你的项目想法是什么');
    expect(text).toContain('第一版只做最小的哪一块');
    // 问答汇总
    expect(text).toContain('拷问完成');
    expect(text).toContain('监测坐姿');
    // 问答落盘
    const session = JSON.parse(readFileSync(join(root, '.ai-hero', 'grill-session.json'), 'utf8'));
    expect(Object.keys(session.answers)).toHaveLength(8);
    // 进度更新
    const status = await runCli(['status'], { cwd: root });
    expect(status.lines.join('\n')).toContain('拷问：已完成');
  });

  it('回答"不知道"给出提示并重复同一题，不跳题不记空答案', async () => {
    const { deps } = await setupProject();
    const d = deps();

    const result = await runCli(['grill'], {
      ...d,
      input: scriptedInput(['不知道', '嗯，监测坐姿', '学生上课时', '预防驼背', '摄像头画面', '姿势统计图表', '识别弯腰动作', '先只做统计', '能演示统计结果']),
    });

    expect(result.code).toBe(0);
    const text = d.collected.join('\n');
    expect(text).toMatch(/提示/);
    // 同一题出现两次（重复问）
    expect(text.split('你的项目想法是什么').length - 1).toBeGreaterThanOrEqual(2);
    const session = JSON.parse(readFileSync(join(d.cwd, '.ai-hero', 'grill-session.json'), 'utf8'));
    expect(session.answers.idea).toBe('嗯，监测坐姿');
  });

  it('中断后重进从第一个未答的题继续，已答内容不丢', async () => {
    const { root, deps } = await setupProject();

    // 第一次：答两题后输入结束（模拟下课退出）
    const d1 = deps();
    const r1 = await runCli(['grill'], { ...d1, input: scriptedInput(['监测坐姿', '学生上课时']) });
    expect(r1.code).toBe(0);
    expect(d1.collected.join('\n')).toMatch(/进度已保存|下次继续/);

    // 第二次：从第 3 题继续
    const d2 = deps();
    const r2 = await runCli(['grill'], { ...d2, input: scriptedInput(['预防驼背', '摄像头画面', '姿势统计图表', '识别弯腰动作', '先只做统计', '能演示统计结果']) });
    expect(r2.code).toBe(0);
    expect(d2.collected.join('\n')).toMatch(/第 3\/8 题/);

    const session = JSON.parse(readFileSync(join(root, '.ai-hero', 'grill-session.json'), 'utf8'));
    expect(Object.keys(session.answers)).toHaveLength(8);
    expect(session.answers.idea).toBe('监测坐姿');
    const status = await runCli(['status'], { cwd: root });
    expect(status.lines.join('\n')).toContain('拷问：已完成');
  });

  it('不在学生项目里运行 grill 时给出可读错误', async () => {
    const root = tempRoot();
    const collected: string[] = [];
    const result = await runCli(['grill'], { cwd: root, out: (l) => collected.push(l), input: scriptedInput([]) });
    expect(result.code).not.toBe(0);
    expect(collected.join('\n')).toMatch(/ai-hero new/);
  });

  it('没有输入提供器（非交互终端）时提示需要在终端运行', async () => {
    const { deps } = await setupProject();
    const d = deps();
    const result = await runCli(['grill'], d);
    expect(result.code).not.toBe(0);
    expect(d.collected.join('\n')).toMatch(/终端/);
  });
});
