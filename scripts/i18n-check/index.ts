#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

import { runChecks } from "./checks";
import { printSummary } from "./reporter";

interface Options {
  projectRoot: string;
  strict: boolean;
  verbose: boolean;
}

function printHelp(): void {
  console.log(`
Usage: bun run i18n-check [path] [options]

Diagnose issues with project translations.

Checks:
  Locale files       Validate JSON, duplicate keys, values, and key segments
  Translation keys   Find keys missing from or extra in other locales
  Placeholders       Compare {placeholder} names across locales
  References         Validate keys and literal variable objects passed to t()
  Unused keys        Find keys not mentioned in source files (warning)

Dynamic t() calls are handled conservatively: any known key mentioned as a
string in source code counts as used. Use --verbose to review dynamic calls.

Options:
  -h, --help       Show this help
  --strict         Treat warnings as failed checks
  --verbose        Show every check and list dynamic t() calls`);
}

function parseOptions(): Options | undefined {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      strict: { type: "boolean" },
      verbose: { type: "boolean" },
    },
  });

  if (values.help) {
    printHelp();
    return;
  }
  if (positionals.length > 1)
    throw new Error("Expected at most one project path.");

  return {
    projectRoot: path.resolve(positionals[0] ?? process.cwd()),
    strict: values.strict ?? false,
    verbose: values.verbose ?? false,
  };
}

async function main(): Promise<void> {
  const options = parseOptions();
  if (!options) return;
  if (
    !fs.existsSync(options.projectRoot) ||
    !fs.statSync(options.projectRoot).isDirectory()
  ) {
    throw new Error(
      `Project directory ${options.projectRoot} does not exist or is not a directory.`,
    );
  }

  process.exitCode = printSummary(
    await runChecks(options.projectRoot),
    options,
  );
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`i18n-check: ${message}`);
    process.exitCode = 1;
  }
}
