import type { GrillSessionFile, StepState } from '../project/store.js';
import { parseLlmJson } from '../llm/client.js';
import type { LlmClient } from '../llm/client.js';
import type { Question } from './questions.js';

export type AskableQuestion = { text: string; hint?: string; note?: string };

/** 拷问会话：驱动"一次一问 + 中断恢复"的状态机。 */
export class GrillEngine {
  private llm: LlmClient | undefined;

  constructor(
    private readonly questions: Question[],
    private readonly load: () => GrillSessionFile,
    private readonly save: (session: GrillSessionFile) => void,
    private readonly onProgress: (step: 'grill', state: StepState) => void,
    llm?: LlmClient,
  ) {
    this.llm = llm;
  }

  total(): number {
    return this.questions.length;
  }

  /** 已答题数。 */
  answeredCount(): number {
    return this.load().answers.length;
  }

  /**
   * 下一个问题：已答满返回 null。
   * 有 LLM 时自适应生成；LLM 失败则带 note 降级为固定问卷的对应题。
   */
  async nextQuestion(): Promise<AskableQuestion | null> {
    const answered = this.answeredCount();
    if (answered >= this.questions.length) return null;

    if (this.llm) {
      try {
        return await this.generateAdaptive(answered);
      } catch (e) {
        this.llm = undefined; // 本次会话后续固定走离线问卷
        const offline = this.questions[answered];
        return {
          text: offline.text,
          hint: offline.hint,
          note: `智能追问不可用（${(e as Error).message}），降级为固定问卷继续`,
        };
      }
    }
    const q = this.questions[answered];
    return { text: q.text, hint: q.hint };
  }

  record(question: AskableQuestion, answer: string): void {
    const session = this.load();
    session.answers.push({ question: question.text, answer });
    this.save(session);
  }

  markStarted(): void {
    this.onProgress('grill', '进行中');
  }

  complete(): void {
    this.onProgress('grill', '已完成');
  }

  /** 问答汇总：全部已答题目与学生的回答。 */
  summary(): { question: string; answer: string }[] {
    return this.load().answers.slice();
  }

  private async generateAdaptive(answered: number): Promise<AskableQuestion> {
    const history = this.load()
      .answers.map((a, i) => `${i + 1}. 问：${a.question}\n   答：${a.answer}`)
      .join('\n');
    const system =
      '你是面向高中生的 AI 项目教练，正在一对一拷问学生的项目想法。' +
      '根据已有问答，提出下一个最值得追问的问题，不要重复已问过的维度' +
      '（想法/用户/问题/数据/输出/AI环节/范围/成功标准）。' +
      '只输出 JSON：{"question":"问题","hint":"学生答不上来时的提示"}，不要输出其他内容。';
    const raw = await this.llm!.complete(history || '（学生还没有回答，请从项目想法问起）', system);
    const parsed = parseLlmJson<{ question?: string; hint?: string }>(raw);
    if (!parsed.question?.trim()) throw new Error('LLM 返回的问题为空');
    return { text: parsed.question.trim(), hint: parsed.hint?.trim() || '结合你的项目想想。' };
  }
}
