import { describe, expect, it } from 'vitest';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCli } from '../src/cli.js';

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'ai-hero-test-'));
}

describe('命令 new：创建学生项目', () => {
  it('在当前目录创建同名学生项目文件夹：git init、docs/、进度文件', async () => {
    const root = tempRoot();

    const result = await runCli(['new', 'my-posture'], { cwd: root });

    const projectRoot = join(root, 'my-posture');
    expect(result.code).toBe(0);
    expect(result.lines.join('\n')).toContain('my-posture');
    expect(existsSync(join(projectRoot, 'docs'))).toBe(true);
    expect(existsSync(join(projectRoot, '.ai-hero', 'progress.json'))).toBe(true);
    // git 仓库已初始化
    expect(existsSync(join(projectRoot, '.git'))).toBe(true);
  });

  it('进度文件记录项目名与五步法全部未开始', async () => {
    const root = tempRoot();

    await runCli(['new', 'demo'], { cwd: root });

    const progress = JSON.parse(
      readFileSync(join(root, 'demo', '.ai-hero', 'progress.json'), 'utf8'),
    );
    expect(progress.project).toBe('demo');
    expect(progress.steps).toEqual({
      grill: '未开始',
      spec: '未开始',
      tickets: '未开始',
      implement: '未开始',
      review: '未开始',
    });
  });

  it('同名文件夹已存在时报错且不覆盖', async () => {
    const root = tempRoot();
    await runCli(['new', 'taken'], { cwd: root });

    const result = await runCli(['new', 'taken'], { cwd: root });

    expect(result.code).not.toBe(0);
    expect(result.lines.join('\n')).toMatch(/已存在|存在/);
  });
});

describe('命令 status：查看进度', () => {
  it('新建的项目显示五步法全部未开始', async () => {
    const root = tempRoot();
    await runCli(['new', 's1'], { cwd: root });

    const result = await runCli(['status'], { cwd: join(root, 's1') });

    expect(result.code).toBe(0);
    const text = result.lines.join('\n');
    for (const step of ['拷问', 'Spec', '任务卡', '实现', '审查']) {
      expect(text).toContain(step);
      expect(text).toContain('未开始');
    }
  });

  it('不在学生项目里运行 status 时给出可读错误', async () => {
    const root = tempRoot();

    const result = await runCli(['status'], { cwd: root });

    expect(result.code).not.toBe(0);
    expect(result.lines.join('\n')).toMatch(/ai-hero new/);
  });
});
