import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'ai-hero-test-'));
}

export function collector() {
  const collected: string[] = [];
  return { collected, out: (line: string) => collected.push(line) };
}

/** 把脚本化答案包成 input 提供器，答案用完后返回 undefined（模拟终端结束） */
export function scriptedInput(answers: string[]) {
  const queue = [...answers];
  return async () => (queue.length > 0 ? queue.shift() : undefined);
}

/** 离线问卷的标准 8 答 */
export const OFFLINE_ANSWERS = [
  '监测坐姿',
  '学生上课时',
  '预防驼背',
  '摄像头画面',
  '姿势统计图表',
  '识别弯腰动作',
  '先只做统计',
  '能演示统计结果',
];
