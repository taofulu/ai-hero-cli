import { describe, expect, it } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCli } from '../src/cli.js';
import type { LlmClient } from '../src/llm/client.js';

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'ai-hero-test-'));
}

function scriptedInput(answers: string[]) {
  const queue = [...answers];
  return async () => (queue.length > 0 ? queue.shift() : undefined);
}

const OFFLINE_ANSWERS = ['监测坐姿', '学生上课时', '预防驼背', '摄像头画面', '姿势统计图表', '识别弯腰动作', '先只做统计', '能演示统计结果'];

async function setupProjectWithSpec(llm?: LlmClient): Promise<string> {
  const root = tempRoot();
  await runCli(['new', 'p'], { cwd: root });
  const projectRoot = join(root, 'p');
  await runCli(['grill'], { cwd: projectRoot, out: () => {}, input: scriptedInput(OFFLINE_ANSWERS), llm });
  await runCli(['spec'], { cwd: projectRoot, out: () => {}, llm });
  return projectRoot;
}

function ticketsDir(projectRoot: string): string {
  return join(projectRoot, 'docs', 'tickets');
}

describe('命令 tickets：任务卡切分（离线模板路径）', () => {
  it('从 Spec 切出任务卡：含验收勾选框与阻塞声明，进度完成', async () => {
    const projectRoot = await setupProjectWithSpec();
    const { collected, out } = collector();

    const result = await runCli(['tickets'], { cwd: projectRoot, out });

    expect(result.code).toBe(0);
    const files = readdirSync(ticketsDir(projectRoot)).filter((f) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) {
      const text = readFileSync(join(ticketsDir(projectRoot), f), 'utf8');
      expect(text).toContain('- [ ]');
      expect(text).toContain('被阻塞于');
    }
    const status = await runCli(['status'], { cwd: projectRoot });
    expect(status.lines.join('\n')).toContain('任务卡：已完成');
  });

  it('重复运行覆盖旧卡且不产生重复', async () => {
    const projectRoot = await setupProjectWithSpec();
    await runCli(['tickets'], { cwd: projectRoot, out: () => {} });
    const run1 = readdirSync(ticketsDir(projectRoot)).length;

    await runCli(['tickets'], { cwd: projectRoot, out: () => {} });

    const files = readdirSync(ticketsDir(projectRoot)).filter((f) => f.endsWith('.md'));
    expect(files.length).toBe(run1);
  });

  it('还没有 Spec 时报错提示先运行 spec', async () => {
    const root = tempRoot();
    await runCli(['new', 'fresh'], { cwd: root });
    const collected: string[] = [];

    const result = await runCli(['tickets'], {
      cwd: join(root, 'fresh'),
      out: (l) => collected.push(l),
    });

    expect(result.code).not.toBe(0);
    expect(collected.join('\n')).toMatch(/spec/);
  });
});

describe('命令 tickets：LLM 切分路径', () => {
  it('有 key 时由 LLM 结构化输出渲染任务卡', async () => {
    const projectRoot = await setupProjectWithSpec();
    const llm: LlmClient = {
      async complete(): Promise<string> {
        return JSON.stringify({
          tickets: [
            { title: '摄像头画面采集', what: '打开浏览器就能看到摄像头画面', criteria: ['页面能显示实时画面', '未授权摄像头时给出提示'], blockedBy: [] },
            { title: '姿态检测接入', what: '在画面上叠加检测到的人体关键点', criteria: ['能看到关键点叠加'], blockedBy: [1] },
          ],
        });
      },
    };

    const result = await runCli(['tickets'], { cwd: projectRoot, out: () => {}, llm });

    expect(result.code).toBe(0);
    const card2 = readFileSync(join(ticketsDir(projectRoot), '02-姿态检测接入.md'), 'utf8');
    expect(card2).toContain('在画面上叠加检测到的人体关键点');
    expect(card2).toContain('能看到关键点叠加');
    expect(card2).toContain('#1');
  });
});

function collector() {
  const collected: string[] = [];
  return { collected, out: (line: string) => collected.push(line) };
}
