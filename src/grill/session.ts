import type { Progress } from '../project/store.js';
import type { Question } from './questions.js';

export type GrillSession = {
  answers: Record<string, string>;
};

/** 拷问会话：驱动"一次一问 + 中断恢复"的状态机。 */
export class GrillEngine {
  constructor(
    private readonly questions: Question[],
    private readonly load: () => GrillSession,
    private readonly save: (session: GrillSession) => void,
    private readonly onProgress: (step: 'markStarted' | 'markDone') => void,
  ) {}

  private current(): GrillSession {
    return this.load();
  }

  /** 第一个未答的题；全部答完返回 null。 */
  nextQuestion(): Question | null {
    const { answers } = this.current();
    return this.questions.find((q) => !(q.id in answers)) ?? null;
  }

  /** 题目序号（从 1 起）与总数，用于进度显示。 */
  position(question: Question): { index: number; total: number } {
    const total = this.questions.length;
    const index = this.questions.findIndex((q) => q.id === question.id) + 1;
    return { index, total };
  }

  /** 已答题数（用于恢复时的进度展示）。 */
  answeredCount(): number {
    return Object.keys(this.current().answers).length;
  }

  record(question: Question, answer: string): void {
    const session = this.current();
    session.answers[question.id] = answer;
    this.save(session);
  }

  markStarted(): void {
    this.onProgress('markStarted');
  }

  complete(): void {
    this.onProgress('markDone');
  }

  /** 问答汇总：全部题目与学生的最终回答。 */
  summary(): { question: string; answer: string }[] {
    const { answers } = this.current();
    return this.questions
      .filter((q) => q.id in answers)
      .map((q) => ({ question: q.text, answer: answers[q.id] }));
  }
}

export function applyProgressMark(
  progress: Progress,
  mark: 'markStarted' | 'markDone',
): void {
  progress.steps.grill = mark === 'markDone' ? '已完成' : '进行中';
}
