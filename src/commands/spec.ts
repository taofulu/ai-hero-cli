import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { OpenAiCompatibleClient, resolveConfig } from '../llm/client.js';
import type { LlmClient } from '../llm/client.js';
import type { CliDeps, CliResult } from '../cli.js';
import { ProjectStore } from '../project/store.js';

type Answered = { question: string; answer: string };

type LlmSpec = {
  title?: string;
  problem?: string;
  solution?: string;
  userStories?: string[];
  decisions?: string[];
  outOfScope?: string[];
};

/** spec：把拷问问答合成为 docs/spec.md（LLM 路径，失败降级离线模板）。 */
export async function specCommand(_args: string[], deps: CliDeps): Promise<CliResult> {
  const out = deps.out ?? (() => {});
  const store = new ProjectStore();
  const root = store.findProjectRoot(deps.cwd);
  if (!root) {
    out('✗ 这里不在任何学生项目里。先用 ai-hero new <项目名> 创建一个。');
    return { code: 1, lines: [] };
  }
  const answers = store.readSession(root).answers;
  if (answers.length === 0) {
    out('✗ 还没有拷问回答，先运行 ai-hero grill 完成拷问。');
    return { code: 1, lines: [] };
  }

  const llm =
    deps.llm ??
    (() => {
      const cfg = resolveConfig({ configFile: deps.configFile, env: deps.env });
      return cfg ? new OpenAiCompatibleClient(cfg) : undefined;
    })();

  const projectName = store.readProgress(root).project;
  let markdown: string;
  if (llm) {
    try {
      markdown = await renderLlmSpec(llm, answers, projectName);
    } catch (e) {
      out(`⚠ LLM 合成失败（${(e as Error).message}），改用离线模板。`);
      markdown = renderOfflineSpec(answers, projectName);
    }
  } else {
    markdown = renderOfflineSpec(answers, projectName);
  }

  const file = join(root, 'docs', 'spec.md');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, markdown, 'utf8');

  const progress = store.readProgress(root);
  progress.steps.spec = '已完成';
  store.writeProgress(root, progress);

  out('✓ Spec 已生成：docs/spec.md');
  out('下一步：运行 ai-hero tickets 把 Spec 切分任务卡。');
  return { code: 0, lines: [] };
}

function numbered(items: string[]): string {
  return items.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

function bulleted(items: string[]): string {
  return items.map((s) => `- ${s}`).join('\n');
}

export function renderOfflineSpec(answers: Answered[], projectName: string): string {
  const pick = (index: number) => answers[index]?.answer?.trim() ?? '';
  const user = pick(1) || '目标用户';
  const idea = pick(0) || '（待补充项目想法）';
  const problem = pick(2) || '上面提到的问题';
  const output = pick(4) || '统计结果';
  const scope = pick(6) || '以问答要点为准';

  return `# Spec：${projectName}

## 问题陈述
${problem}

## 用户故事
1. 作为${user}，我想要${idea}，以便解决${problem}。
2. 作为${user}，我想看到${output}。
3. 作为${user}，我希望第一版只做${scope}。

## 问答要点
${bulleted(answers.map((a) => `问：${a.question}／答：${a.answer}`))}

## 第一版范围
- ${scope}

> 由 ai-hero 离线模板从拷问回答生成；补充回答后重新运行 ai-hero spec 可覆盖本文档。
`;
}

async function renderLlmSpec(llm: LlmClient, answers: Answered[], projectName: string): Promise<string> {
  const history = answers
    .map((a, i) => `${i + 1}. 问：${a.question}\n   答：${a.answer}`)
    .join('\n');
  const system =
    '你是面向高中生的 AI 项目教练。根据拷问问答合成一份学生能看懂的项目 Spec。' +
    '只输出 JSON：{"title":"项目名","problem":"问题陈述","solution":"解决方案",' +
    '"userStories":["作为…，我想…，以便…"],"decisions":["实现决定"],"outOfScope":["明确不做的事"]}，' +
    '全部用中文，userStories 至少 5 条。';
  const raw = await llm.complete(`项目名：${projectName}\n\n拷问问答：\n${history}`, system);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('LLM 未返回 JSON');
  const spec = JSON.parse(match[0]) as LlmSpec;

  const sections = [`# Spec：${spec.title?.trim() || projectName}`];
  if (spec.problem) sections.push(`## 问题陈述\n${spec.problem}`);
  if (spec.solution) sections.push(`## 解决方案\n${spec.solution}`);
  if (spec.userStories?.length) sections.push(`## 用户故事\n${numbered(spec.userStories)}`);
  if (spec.decisions?.length) sections.push(`## 实现决定\n${bulleted(spec.decisions)}`);
  if (spec.outOfScope?.length) sections.push(`## 暂不做\n${bulleted(spec.outOfScope)}`);
  sections.push('> 由 ai-hero 从拷问回答合成；补充回答后重新运行 ai-hero spec 可覆盖本文档。');
  return sections.join('\n\n') + '\n';
}
