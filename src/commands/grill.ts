import { isDontKnow, QUESTIONNAIRE } from '../grill/questions.js';
import { applyProgressMark, GrillEngine } from '../grill/session.js';
import { OpenAiCompatibleClient, resolveConfig } from '../llm/client.js';
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

  // LLM 可用性：注入优先（测试），否则按配置解析；无 key 走离线降级。
  const llm =
    deps.llm ??
    (() => {
      const cfg = resolveConfig({ configFile: deps.configFile, env: deps.env });
      return cfg ? new OpenAiCompatibleClient(cfg) : undefined;
    })();

  const engine = new GrillEngine(
    QUESTIONNAIRE,
    () => store.readSession(root),
    (session) => store.writeSession(root, session),
    (mark) => {
      const progress = store.readProgress(root);
      applyProgressMark(progress, mark);
      store.writeProgress(root, progress);
    },
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
