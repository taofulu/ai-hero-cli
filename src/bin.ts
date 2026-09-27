#!/usr/bin/env node
import { cliMain } from './cli.js';

process.exit(cliMain(process.argv.slice(2), { cwd: process.cwd() }));
