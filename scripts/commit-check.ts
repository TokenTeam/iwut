#!/usr/bin/env bun

import process from "node:process";

const expected = "Expected: :emoji: type(scope?): subject";
const types = "build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test";
const pattern = new RegExp(
  `^:[a-z0-9_+-]+:\\s+(?:${types})(?:\\([^)]*\\))?!?:\\s+\\S`,
);
const gitSubject =
  /^(?:(?:fixup|squash|amend)!\s+\S|Merge (?:branch|branches|remote-tracking branch|remote-tracking branches|tag|commit|pull request)\s+\S|Revert ".+")/;

export function isValid(message: string): boolean {
  const subject = message.split(/\r?\n/, 1)[0].trim();
  return pattern.test(subject) || gitSubject.test(subject);
}

if (import.meta.main) {
  const message = process.argv[2];
  if (!message || !isValid(await Bun.file(message).text())) {
    console.error(expected);
    process.exit(1);
  }
}
