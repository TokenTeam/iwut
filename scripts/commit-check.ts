#!/usr/bin/env bun

import process from "node:process";

const expected = "Expected: :emoji: type(scope?): subject";
const types = "build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test";
const message = process.argv[2];
if (!message) {
  console.error(expected);
  process.exit(1);
}

const subject = (await Bun.file(message).text()).split(/\r?\n/, 1)[0].trim();
const pattern = new RegExp(
  `^:[a-z0-9_+-]+:\\s+(?:${types})(?:\\([^)]*\\))?!?:\\s+\\S`,
);

if (!pattern.test(subject)) {
  console.error(expected);
  process.exit(1);
}
