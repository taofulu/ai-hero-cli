import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLlmJson, resolveLlmClient } from '../llm/client.js';
import type { LlmClient } from '../llm/client.js';
import type { CliDeps, CliResult } from '../cli.js';
import { NOT_IN_PROJECT, ProjectStore } from '../project/store.js';

type LlmTicket = {
  title: string;
  what: string;
  criteria: string[];
  blockedBy?: number[];
};

type LlmTickets = { tickets?: LlmTicket[] };

/** tickets：把 Spec 切分为 docs/tickets/NN-*.md（LLM 路径，失败降级离线模板）。 */
export async function ticketsCommand(_args: string[], deps: CliDeps): Promise<CliResult> {
  const out = deps.out ?? (() => {});
  const store = new ProjectStore();
  const root = store.findProjectRoot(deps.cwd);
  if (!root) {
    out(NOT_IN_PROJECT);
    return { code: 1, lines: [] };
  }
  const specFile = join(root, 'docs', 'spec.md');
  if (!existsSync(specFile)) {
    out('✗ 还没有 Spec，先运行 ai-hero spec。');
    return { code: 1, lines: [] };
  }
  const spec = readFileSync(specFile, 'utf8');

  const llm = resolveLlmClient(deps);

  const projectName = store.readProgress(root).project;
  let cards: LlmTicket[];
  let sourceNote: string;
  if (llm) {
    try {
      cards = await renderLlmTickets(llm, spec, projectName);
      sourceNote = 'LLM 切分';
    } catch (e) {
      out(`⚠ LLM 切分失败（${(e as Error).message}），改用离线模板。`);
      cards = offlineCards(spec);
      sourceNote = '离线模板';
    }
  } else {
    cards = offlineCards(spec);
    sourceNote = '离线模板';
  }

  const dir = join(root, 'docs', 'tickets');
  mkdirSync(dir, { recursive: true });
  // 重复运行：清掉旧卡，覆盖式生成，不产生重复
  for (const f of readdirSync(dir)) {
    if (/^\d+-.*\.md$/.test(f)) rmSync(join(dir, f));
  }
  cards.forEach((card, i) => {
    const nn = String(i + 1).padStart(2, '0');
    const safeTitle = card.title.replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '') || 'ticket';
    const blocked =
      card.blockedBy && card.blockedBy.length > 0
        ? card.blockedBy.map((n) => `#${n}`).join('、')
        : 'None（可立即开始）';
    const markdown = `# ${nn}：${card.title}

**要做什么：**${card.what}

**被阻塞于：**${blocked}

## 验收标准

${card.criteria.map((c) => `- [ ] ${c}`).join('\n')}

> 由 ai-hero（${sourceNote}）从 Spec 切分。
`;
    writeFileSync(join(dir, `${nn}-${safeTitle}.md`), markdown, 'utf8');
  });

  store.updateProgress(root, (p) => {
    p.steps.tickets = '已完成';
  });

  out(`✓ 已生成 ${cards.length} 张任务卡：docs/tickets/（${sourceNote}）`);
  out('按阻塞顺序逐张完成并勾选验收标准。');
  return { code: 0, lines: [] };
}

async function renderLlmTickets(llm: LlmClient, spec: string, projectName: string): Promise<LlmTicket[]> {
  const system =
    '你是面向高中生的 AI 项目教练。把 Spec 切分为 3-6 张竖直切片任务卡，' +
    '每张卡独立可验证、按学习难度排序。只输出 JSON：' +
    '{"tickets":[{"title":"卡名","what":"端到端要做什么","criteria":["验收标准"],"blockedBy":[被阻塞的卡序号数组，从1开始]}]}，全中文。';
  const raw = await llm.complete(`项目名：${projectName}\n\nSpec：\n${spec}`, system);
  const parsed = parseLlmJson<LlmTickets>(raw);
  if (!parsed.tickets?.length) throw new Error('LLM 未返回任务卡');
  return parsed.tickets;
}

/** 离线模板：把 Spec 的用户故事逐条切成任务卡，按顺序串联阻塞。 */
function offlineCards(spec: string): LlmTicket[] {
  const storySection = spec.split('## 用户故事')[1]?.split('##')[0] ?? '';
  const stories = storySection
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^\d+\.\s/.test(l))
    .map((l) => l.replace(/^\d+\.\s*/, ''));
  const base = stories.length > 0 ? stories : ['实现 Spec 的核心功能（离线模板未解析到用户故事）'];

  return base.map((story, i) => ({
    title: `实现：${story.slice(0, 24)}`,
    what: `${story}——完成后能独立演示这一条。`,
    criteria: [
      '按描述完成后，能向同学演示对应功能',
      '相关行为与 Spec 的问答要点一致',
    ],
    blockedBy: i === 0 ? [] : [i],
  }));
}
