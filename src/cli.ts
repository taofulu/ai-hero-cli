import { NOT_IN_PROJECT, ProjectStore, STEP_LABELS, STEPS } from './project/store.js';
import { grillCommand } from './commands/grill.js';
import { configCommand } from './commands/config.js';
import { specCommand } from './commands/spec.js';
import { ticketsCommand } from './commands/tickets.js';
import type { LlmClient } from './llm/client.js';

export type CliResult = { code: number; lines: string[] };

export type CliDeps = {
  cwd: string;
  /** 交互式命令的问题应答器；缺省视为非交互终端。 */
  input?: (prompt: string) => Promise<string | undefined>;
  /** 交互式命令的输出收集器；缺省静默（测试收集用）。 */
  out?: (line: string) => void;
  /** LLM 配置文件路径；缺省 ~/.ai-hero/config.json（测试注入临时路径）。 */
  configFile?: string;
  /** 环境变量；缺省 process.env（测试注入隔离环境）。 */
  env?: NodeJS.ProcessEnv;
  /** 注入的 LLM 客户端（测试用 fake）；缺省按配置解析。 */
  llm?: LlmClient;
};

const USAGE = '用法：ai-hero <new|grill|spec|tickets|config|status>';

function newCommand(args: string[], deps: CliDeps): CliResult {
  const name = args[0];
  if (!name) {
    return { code: 1, lines: ['用法：ai-hero new <项目名>'] };
  }
  const store = new ProjectStore();
  try {
    store.createProject(name, deps.cwd);
  } catch (e) {
    return { code: 1, lines: [`✗ ${(e as Error).message}`] };
  }
  return {
    code: 0,
    lines: [
      `✓ 学生项目已创建：${name}`,
      `下一步：cd ${name} && ai-hero grill 开始拷问`,
    ],
  };
}

function placeholderCommand(deps: CliDeps): CliResult {
  const store = new ProjectStore();
  const root = store.findProjectRoot(deps.cwd);
  const hint = root
    ? 'MVP 未开放：五步法的前半程（拷问 → Spec → 任务卡）已可用，实现与审查将在后续版本提供。'
    : NOT_IN_PROJECT;
  return { code: 1, lines: [hint] };
}

function statusCommand(_args: string[], deps: CliDeps): CliResult {
  const store = new ProjectStore();
  const root = store.findProjectRoot(deps.cwd);
  if (!root) {
    return {
      code: 1,
      lines: [NOT_IN_PROJECT],
    };
  }
  const progress = store.readProgress(root);
  const lines = [
    `学生项目：${progress.project}`,
    ...STEPS.map((step) => `${STEP_LABELS[step]}：${progress.steps[step]}`),
  ];
  return { code: 0, lines };
}

export async function runCli(argv: string[], deps: CliDeps): Promise<CliResult> {
  const [cmd, ...args] = argv;
  switch (cmd) {
    case 'new':
      return newCommand(args, deps);
    case 'grill':
      return grillCommand(args, deps);
    case 'spec':
      return specCommand(args, deps);
    case 'tickets':
      return ticketsCommand(args, deps);
    case 'config':
      return configCommand(args, deps);
    case 'implement':
    case 'review':
      return placeholderCommand(deps);
    case 'status':
      return statusCommand(args, deps);
    default:
      return { code: 1, lines: [`未知命令：${cmd ?? '（空）'}`, USAGE] };
  }
}

// 命令行入口由 bin 包装层调用；命令层测试直接使用 runCli。
export async function cliMain(argv: string[], deps: CliDeps): Promise<number> {
  const result = await runCli(argv, deps);
  for (const line of result.lines) console.log(line);
  return result.code;
}
