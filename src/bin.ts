#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { cliMain } from './cli.js';

const rl = createInterface({ input: process.stdin, output: process.stdout });

const input = async (prompt: string): Promise<string | undefined> => {
  try {
    return await rl.question(prompt);
  } catch {
    return undefined;
  }
};

const out = (line: string) => console.log(line);

const code = await cliMain(process.argv.slice(2), {
  cwd: process.cwd(),
  input,
  out,
});
rl.close();
process.exit(code);
