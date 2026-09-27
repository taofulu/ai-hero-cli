import { isDontKnow, QUESTIONNAIRE } from '../grill/questions.js';
import { GrillEngine } from '../grill/session.js';
import { resolveLlmClient } from '../llm/client.js';
import type { CliDeps, CliResult } from '../cli.js';
import { NOT_IN_PROJECT, ProjectStore } from '../project/store.js';
import type { GrillSessionFile } from '../project/store.js';

/** grill：拷问环节。交互输出一律走 out，返回的 lines 保持为空以免重复打印。 */
export async function grillCommand(_args: string[], deps: CliDeps): Promise<CliResult> {
  const out = deps.out ?? (() => {});
  const store = new ProjectStore();
  const root = store.findProjectRoot(deps.cwd);
  if (!root) {
    out(NOT_IN_PROJECT);
    return { code: 1, lines: [] };
  }
  if (!deps.input) {
    out('✗ grill 需要交互终端来回答问题，请在终端里运行 ai-hero grill。');
    return { code: 1, lines: [] };
  }

  // LLM 可用性：注入优先（测试），否则按配置解析；无 key 走离线降级。
  const llm = resolveLlmClient(deps);

  // 拷问已完成：支持逐题修改答案（补充新答案后重新合成 Spec）。
  const existing = store.readSession(root);
  if (existing.answers.length >= QUESTIONNAIRE.length) {
    return supplementAnswers(existing, deps, store, root, out);
  }

  const engine = new GrillEngine(
    QUESTIONNAIRE,
    () => store.readSession(root),
    (session) => store.writeSession(root, session),
    (step, state) => store.updateProgress(root, (p) => { p.steps[step] = state; }),
    llm,
  );

  if (store.readProgress(root).steps.grill === '未开始') {
    engine.markStarted();
  }

  let current = await engine.nextQuestion();
  while (current) {
    if (current.note) out(`⚠ ${current.note}。`);
    out(`第 ${engine.answeredCount() + 1}/${engine.total()} 题：${current.text}`);

    const raw = await deps.input('> ');
    const answer = raw?.trim() ?? '';
    if (raw === undefined || answer === 'q' || answer === 'quit' || answer === '退出') {
      out(`进度已保存（已答 ${engine.answeredCount()} 题），下次运行 ai-hero grill 从未答题继续。`);
      return { code: 0, lines: [] };
    }
    if (answer === '' || isDontKnow(answer)) {
      out(`提示：${current.hint ?? '结合你的项目想想。'}`);
      continue;
    }
    engine.record(current, answer);
    current = await engine.nextQuestion();
  }

  engine.complete();
  out('拷问完成！你的回答汇总：');
  for (const { question, answer } of engine.summary()) {
    out(`- ${question}`);
    out(`  答：${answer}`);
  }
  out('下一步：运行 ai-hero spec 把回答合成 Spec。');
  return { code: 0, lines: [] };
}

/** 拷问完成后的补充入口：逐题回看可修改答案，回车保留原答案。 */
async function supplementAnswers(
  session: GrillSessionFile,
  deps: CliDeps,
  store: ProjectStore,
  root: string,
  out: (line: string) => void,
): Promise<CliResult> {
  const total = session.answers.length;
  out(`拷问已完成（共 ${total} 题）。输入 y 逐题修改答案（回车保留原答案），其他键直接退出：`);
  const choice = (await deps.input?.('> '))?.trim().toLowerCase();
  if (choice !== 'y') {
    out(`进度已保存（已答 ${total} 题）。下一步：运行 ai-hero spec 把回答合成 Spec。`);
    return { code: 0, lines: [] };
  }
  for (let i = 0; i < total; i++) {
    const item = session.answers[i];
    out(`第 ${i + 1}/${total} 题：${item.question}`);
    out(`  原答：${item.answer}`);
    const raw = await deps.input?.('> ');
    if (raw === undefined) break; // 输入结束，其余题保留原答案
    const trimmed = raw.trim();
    if (trimmed === 'q' || trimmed === 'quit' || trimmed === '退出') break;
    if (trimmed === '' || isDontKnow(trimmed)) continue; // 保留原答案
    item.answer = trimmed;
  }
  store.writeSession(root, session);
  out('答案已更新！汇总：');
  for (const { question, answer } of session.answers) {
    out(`- ${question}`);
    out(`  答：${answer}`);
  }
  out('下一步：运行 ai-hero spec 重新合成 Spec（覆盖旧文档）。');
  return { code: 0, lines: [] };
}
