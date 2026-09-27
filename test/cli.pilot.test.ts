import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BIN = join(process.cwd(), 'dist', 'bin.js');

/** 集成测试：真实进程 + 管道输入（覆盖 readline 丢行的回归） */
describe('端到端试点（真实进程，管道输入）', () => {
  it('grill 管道喂 8 答不丢行，spec/tickets 全流程产物齐全', () => {
    if (!existsSync(BIN)) throw new Error('dist/bin.js 不存在，请先 npm run build');

    const root = mkdtempSync(join(tmpdir(), 'ai-hero-pilot-'));
    const run = (args: string[], input?: string, cwd: string = root) =>
      execFileSync('node', [BIN, ...args], { cwd, input, encoding: 'utf8' });

    run(['new', '体态监测与矫正']);
    const projectRoot = join(root, '体态监测与矫正');

    // 分两次喂（模拟中断恢复），8 题全部落地
    const answers1 = ['监测学生课堂坐姿并统计不良姿势时长', '上课的学生自己', '长期驼背影响视力和脊柱'];
    const answers2 = ['笔记本电脑摄像头', '坐姿统计图表', '识别弯腰动作', '先只做统计', '能演示统计结果'];
    run(['grill'], [...answers1, 'q'].join('\n'), projectRoot);
    run(['grill'], answers2.join('\n'), projectRoot);

    const session = JSON.parse(
      readFileSync(join(projectRoot, '.ai-hero', 'grill-session.json'), 'utf8'),
    );
    expect(session.answers).toHaveLength(8);
    expect(session.answers[1].answer).toBe('上课的学生自己');

    run(['spec'], undefined, projectRoot);
    const spec = readFileSync(join(projectRoot, 'docs', 'spec.md'), 'utf8');
    expect(spec).toContain('上课的学生自己');
    expect(spec).toContain('用户故事');

    run(['tickets'], undefined, projectRoot);
    const progress = JSON.parse(readFileSync(join(projectRoot, '.ai-hero', 'progress.json'), 'utf8'));
    expect(progress.steps).toEqual({
      grill: '已完成',
      spec: '已完成',
      tickets: '已完成',
      implement: '未开始',
      review: '未开始',
    });
  });
});
