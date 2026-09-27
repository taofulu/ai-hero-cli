import { isDontKnow, QUESTIONNAIRE } from '../grill/questions.js';
import { applyProgressMark, GrillEngine } from '../grill/session.js';
import type { CliDeps, CliResult } from '../cli.js';
import { ProjectStore } from '../project/store.js';

/** grill：拷问环节。交互输出一律走 out，返回的 lines 保持为空以免重复打印。 */
export async function grillCommand(_args: string[], deps: CliDeps): Promise<CliResult> {
  const out = deps.out ?? (() => {});
  const store = new ProjectStore();
  const root = store.findProjectRoot(deps.cwd);
  if (!root) {
    out('✗ 这里不在任何学生项目里。先用 ai-hero new <项目名> 创建一个。');
    return { code: 1, lines: [] };
  }
  if (!deps.input) {
    out('✗ grill 需要交互终端来回答问题，请在终端里运行 ai-hero grill。');
    return { code: 1, lines: [] };
  }

  const engine = new GrillEngine(
    QUESTIONNAIRE,
    () => store.readSession(root),
    (session) => store.writeSession(root, session),
    (mark) => {
      const progress = store.readProgress(root);
      applyProgressMark(progress, mark);
      store.writeProgress(root, progress);
    },
  );

  if (store.readProgress(root).steps.grill === '未开始') {
    engine.markStarted();
  }

  let question = engine.nextQuestion();
  while (question) {
    const { index, total } = engine.position(question);
    out(`第 ${index}/${total} 题：${question.text}`);

    const raw = await deps.input('> ');
    const answer = raw?.trim() ?? '';
    if (raw === undefined || answer === 'q' || answer === 'quit' || answer === '退出') {
      out(`进度已保存（已答 ${engine.answeredCount()} 题），下次运行 ai-hero grill 从未答题继续。`);
      return { code: 0, lines: [] };
    }
    if (answer === '' || isDontKnow(answer)) {
      out(`提示：${question.hint}`);
      continue;
    }
    engine.record(question, answer);
    question = engine.nextQuestion();
  }

  engine.complete();
  out('拷问完成！你的回答汇总：');
  for (const { question: text, answer } of engine.summary()) {
    out(`- ${text}`);
    out(`  答：${answer}`);
  }
  out('下一步：运行 ai-hero spec 把回答合成 Spec。');
  return { code: 0, lines: [] };
}
