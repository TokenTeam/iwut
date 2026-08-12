import {
  BASE_LOCALE,
  LOCALES_PATH,
  extractPlaceholders,
  loadProject,
  type LocaleEntries,
  type ProjectContext,
} from "./project";

export type Severity = "error" | "warning";

interface CheckResult {
  issues: string[];
  advice?: string;
  details?: string[];
}

interface Check {
  description: string;
  requires?: "base" | "source";
  severity: Severity;
  run(context: ProjectContext): CheckResult;
}

export interface CheckJob {
  check: Check;
  result: CheckResult;
  error?: Error;
}

const checks = [
  {
    description: "Check locale files for common issues",
    severity: "error",
    run(context) {
      const issues = [...context.localeIssues];
      if (issues.length === 0 && context.locales.size === 0) {
        issues.push(`No locale JSON files found in ${LOCALES_PATH}.`);
      }
      if (context.locales.size > 0 && !context.base) {
        issues.push(`The base locale ${BASE_LOCALE}.json was not found.`);
      }
      return result(
        issues,
        "Fix invalid locale files before running other checks.",
      );
    },
  },
  {
    description: "Check that locale files use the same translation keys",
    requires: "base",
    severity: "error",
    run({ base, locales }) {
      if (!base) return result();

      const issues: string[] = [];
      const baseKeys = new Set(base.keys());
      for (const [locale, entries] of otherLocales(locales)) {
        for (const key of baseKeys) {
          if (!entries.has(key))
            issues.push(`${locale}.json is missing "${key}".`);
        }
        for (const key of entries.keys()) {
          if (!baseKeys.has(key))
            issues.push(`${locale}.json has an extra key "${key}".`);
        }
      }
      return result(
        issues,
        `Keep every locale structurally aligned with ${BASE_LOCALE}.json.`,
      );
    },
  },
  {
    description: "Check that translation placeholders match",
    requires: "base",
    severity: "error",
    run({ base, locales }) {
      if (!base) return result();

      const issues: string[] = [];
      for (const [locale, entries] of otherLocales(locales)) {
        for (const [key, baseValue] of base) {
          const translatedValue = entries.get(key);
          if (translatedValue === undefined) continue;

          const expected = extractPlaceholders(baseValue);
          const actual = extractPlaceholders(translatedValue);
          if (!sameArray(expected, actual)) {
            issues.push(
              `${locale}.json "${key}" uses [${displayList(actual)}], ` +
                `but ${BASE_LOCALE}.json uses [${displayList(expected)}].`,
            );
          }
        }
      }
      return result(
        issues,
        "Use the same {placeholder} names in every locale.",
      );
    },
  },
  {
    description: "Check that translation calls use valid keys and variables",
    requires: "source",
    severity: "error",
    run({ source }) {
      return result(
        source?.referenceIssues,
        "Fix the key or make its literal variables match the translation placeholders.",
        source?.dynamicCalls,
      );
    },
  },
  {
    description: "Check for possibly unused translation keys",
    requires: "source",
    severity: "warning",
    run({ base, source }) {
      const issues =
        base && source
          ? [...base.keys()]
              .filter((key) => !source.mentionedKeys.has(key))
              .sort()
          : [];
      return result(
        issues,
        "Remove confirmed unused keys from every locale, or keep dynamic references explicit.",
      );
    },
  },
] satisfies Check[];

function result(
  issues: string[] = [],
  advice?: string,
  details?: string[],
): CheckResult {
  return { issues, advice: issues.length > 0 ? advice : undefined, details };
}

function* otherLocales(
  locales: Map<string, LocaleEntries>,
): Generator<[string, LocaleEntries]> {
  for (const entry of locales) {
    if (entry[0] !== BASE_LOCALE) yield entry;
  }
}

function sameArray(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function displayList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

export async function runChecks(projectRoot: string): Promise<CheckJob[]> {
  const context = await loadProject(projectRoot);
  return checks
    .filter((check) => !check.requires || context[check.requires])
    .map((check) => {
      try {
        return { check, result: check.run(context) };
      } catch (error) {
        return {
          check,
          error: error instanceof Error ? error : new Error(String(error)),
          result: result(),
        };
      }
    });
}
