import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCli } from '../src/cli.js';

function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'ai-hero-test-'));
}

describe('命令 implement/review：MVP 占位', () => {
  it.each(['implement', 'review'])('%s 在学生项目里给出 MVP 未开放提示', async (cmd) => {
    const root = tempRoot();
    await runCli(['new', 'p'], { cwd: root });

    const result = await runCli([cmd], { cwd: join(root, 'p') });

    expect(result.code).not.toBe(0);
    expect(result.lines.join('\n')).toContain('MVP 未开放');
  });
});
