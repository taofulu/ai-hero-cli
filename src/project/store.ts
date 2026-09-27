import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type StepState = '未开始' | '进行中' | '已完成';

export const STEPS = ['grill', 'spec', 'tickets', 'implement', 'review'] as const;
export type StepName = (typeof STEPS)[number];

export const STEP_LABELS: Record<StepName, string> = {
  grill: '拷问',
  spec: 'Spec',
  tickets: '任务卡',
  implement: '实现',
  review: '审查',
};

export type Progress = {
  project: string;
  createdAt: string;
  steps: Record<StepName, StepState>;
};

const AI_HERO_DIR = '.ai-hero';
const PROGRESS_FILE = 'progress.json';

/** 学生项目文件夹的产物读写与进度管理。 */
export class ProjectStore {
  /** 在 cwd 下创建学生项目文件夹，返回其绝对路径。已存在时抛错。 */
  createProject(name: string, cwd: string): string {
    const root = join(cwd, name);
    if (existsSync(root)) {
      throw new Error(`文件夹 ${name} 已存在，换个名字或不重复创建`);
    }
    mkdirSync(join(root, 'docs'), { recursive: true });
    execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'ignore' });
    this.writeProgress(root, {
      project: name,
      createdAt: new Date().toISOString(),
      steps: {
        grill: '未开始',
        spec: '未开始',
        tickets: '未开始',
        implement: '未开始',
        review: '未开始',
      },
    });
    return root;
  }

  /** 从 cwd 向上查找所属学生项目的根目录，找不到返回 null。 */
  findProjectRoot(cwd: string): string | null {
    let dir = cwd;
    for (;;) {
      if (existsSync(join(dir, AI_HERO_DIR, PROGRESS_FILE))) return dir;
      const parent = dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  }

  readProgress(root: string): Progress {
    const file = join(root, AI_HERO_DIR, PROGRESS_FILE);
    return JSON.parse(readFileSync(file, 'utf8')) as Progress;
  }

  writeProgress(root: string, progress: Progress): void {
    const file = join(root, AI_HERO_DIR, PROGRESS_FILE);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(progress, null, 2) + '\n', 'utf8');
  }
}
