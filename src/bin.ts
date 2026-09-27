#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { cliMain } from './cli.js';

const rl = createInterface({ input: process.stdin });

// 行队列 + 等待者：管道/TTY 下都不丢行（rl.question 在管道快速输入时会丢行）
const queue: string[] = [];
const waiters: ((v: string | undefined) => void)[] = [];
let closed = false;

rl.on('line', (line) => {
  const w = waiters.shift();
  if (w) w(line);
  else queue.push(line);
});
rl.on('close', () => {
  closed = true;
  while (waiters.length) waiters.shift()!(undefined);
});

const input = async (prompt: string): Promise<string | undefined> => {
  if (queue.length > 0) return queue.shift();
  if (closed) return undefined;
  process.stdout.write(prompt);
  return new Promise<string | undefined>((resolve) => waiters.push(resolve));
};

const out = (line: string) => console.log(line);

const code = await cliMain(process.argv.slice(2), {
  cwd: process.cwd(),
  input,
  out,
});
rl.close();
process.exit(code);
