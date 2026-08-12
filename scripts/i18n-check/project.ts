import fs from "node:fs";
import path from "node:path";
import { file as bunFile, Glob } from "bun";
import ts from "typescript";

export const BASE_LOCALE = "zh";
export const LOCALES_PATH = "lib/i18n/locales";

const CHECKER_DIRECTORY = import.meta.dir;
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const IGNORED_DIRECTORIES = new Set([
  ".expo",
  ".git",
  "android",
  "dist",
  "ios",
  "node_modules",
]);

export type LocaleEntries = Map<string, string>;

export interface ProjectContext {
  locales: Map<string, LocaleEntries>;
  localeIssues: string[];
  base?: LocaleEntries;
  source?: SourceAnalysis;
}

interface SourceAnalysis {
  dynamicCalls: string[];
  mentionedKeys: Set<string>;
  referenceIssues: string[];
}

interface SourceInput {
  file: string;
  text: string;
}

interface LoadedLocale {
  entries?: LocaleEntries;
  issues: string[];
  locale: string;
}

export async function loadProject(
  projectRoot: string,
): Promise<ProjectContext> {
  const locales = new Map<string, LocaleEntries>();
  const localeIssues: string[] = [];
  const directory = path.join(projectRoot, LOCALES_PATH);

  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    return {
      locales,
      localeIssues: [`Locale directory ${LOCALES_PATH} does not exist.`],
    };
  }

  const files = [
    ...new Glob("*.json").scanSync({ cwd: directory, onlyFiles: true }),
  ].sort();
  const loadedLocales = await Promise.all(
    files.map(async (file): Promise<LoadedLocale> => {
      const locale = path.basename(file, ".json");
      const absoluteFile = path.join(directory, file);
      try {
        const text = await bunFile(absoluteFile).text();
        const json: unknown = JSON.parse(text);
        const issues = findDuplicateKeys(file, text);
        return {
          locale,
          issues,
          entries: flattenLocale(locale, json, issues),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          locale,
          issues: [`${file} is not valid JSON: ${message}`],
        };
      }
    }),
  );
  for (const locale of loadedLocales) {
    localeIssues.push(...locale.issues);
    if (locale.entries) locales.set(locale.locale, locale.entries);
  }

  const base = locales.get(BASE_LOCALE);
  return {
    locales,
    localeIssues,
    base,
    source: base ? await scanSources(projectRoot, base) : undefined,
  };
}

function findDuplicateKeys(file: string, text: string): string[] {
  const sourceFile = ts.parseJsonText(file, text);
  const issues: string[] = [];

  function visitObject(node: ts.ObjectLiteralExpression, prefix = ""): void {
    const seen = new Set<string>();
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) continue;

      const segment = getPropertyName(property.name);
      if (segment === undefined) continue;
      const key = prefix ? `${prefix}.${segment}` : segment;
      if (seen.has(segment)) {
        issues.push(
          `${sourceLocation("", sourceFile, property.name)} duplicates key "${key}".`,
        );
      }
      seen.add(segment);

      if (ts.isObjectLiteralExpression(property.initializer)) {
        visitObject(property.initializer, key);
      }
    }
  }

  const expression = sourceFile.statements[0];
  if (expression && ts.isExpressionStatement(expression)) {
    const root = expression.expression;
    if (ts.isObjectLiteralExpression(root)) visitObject(root);
  }
  return issues;
}

function flattenLocale(
  locale: string,
  value: unknown,
  issues: string[],
  prefix = "",
  entries: LocaleEntries = new Map(),
): LocaleEntries {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push(
      `${locale}.json "${prefix || "<root>"}" must be an object or string.`,
    );
    return entries;
  }

  for (const [segment, child] of Object.entries(value)) {
    const key = prefix ? `${prefix}.${segment}` : segment;
    if (!segment || segment.includes(".")) {
      issues.push(`${locale}.json has invalid key segment "${segment}".`);
    }

    if (typeof child === "string") {
      entries.set(key, child);
    } else if (child && typeof child === "object" && !Array.isArray(child)) {
      flattenLocale(locale, child, issues, key, entries);
    } else {
      issues.push(`${locale}.json "${key}" must be an object or string.`);
    }
  }
  return entries;
}

function* walkSourceFiles(directory: string): Generator<string> {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;

    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* walkSourceFiles(file);
    } else if (
      SOURCE_EXTENSIONS.has(path.extname(file)) &&
      !isWithin(CHECKER_DIRECTORY, file)
    ) {
      yield file;
    }
  }
}

function isWithin(directory: string, file: string): boolean {
  const relative = path.relative(directory, file);
  return (
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
  );
}

async function scanSources(
  projectRoot: string,
  base: LocaleEntries,
): Promise<SourceAnalysis> {
  const inputs = await Promise.all(
    [...walkSourceFiles(projectRoot)]
      .sort()
      .map(async (file): Promise<SourceInput> => ({
        file,
        text: await bunFile(file).text(),
      })),
  );

  const dynamicCalls: string[] = [];
  const mentionedKeys = new Set<string>();
  const referenceIssues: string[] = [];

  for (const { file, text } of inputs) {
    const sourceFile = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      getScriptKind(file),
    );
    const translationFunctions = findTranslationFunctions(sourceFile);

    function visit(node: ts.Node): void {
      const value = getStringValue(node);
      if (value !== undefined && base.has(value)) mentionedKeys.add(value);

      if (
        ts.isCallExpression(node) &&
        isTranslationCall(node.expression, translationFunctions)
      ) {
        inspectTranslationCall(
          projectRoot,
          sourceFile,
          node,
          base,
          dynamicCalls,
          referenceIssues,
        );
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return { dynamicCalls, mentionedKeys, referenceIssues };
}

function findTranslationFunctions(sourceFile: ts.SourceFile): Set<string> {
  const functions = new Set<string>();
  const hooks = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !/(^|\/)i18n(?:\/index)?$/.test(statement.moduleSpecifier.text) ||
      !statement.importClause?.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue;
    }

    for (const specifier of statement.importClause.namedBindings.elements) {
      const imported = specifier.propertyName?.text ?? specifier.name.text;
      if (imported === "t") functions.add(specifier.name.text);
      if (imported === "useT") hooks.add(specifier.name.text);
    }
  }

  function visit(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      hooks.has(node.initializer.expression.text)
    ) {
      functions.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return functions;
}

function isTranslationCall(
  expression: ts.Expression,
  functions: Set<string>,
): boolean {
  return (
    (ts.isIdentifier(expression) && functions.has(expression.text)) ||
    (ts.isPropertyAccessExpression(expression) && expression.name.text === "t")
  );
}

function inspectTranslationCall(
  projectRoot: string,
  sourceFile: ts.SourceFile,
  call: ts.CallExpression,
  base: LocaleEntries,
  dynamicCalls: string[],
  issues: string[],
): void {
  const keyNode = call.arguments[0];
  if (!keyNode) return;

  const location = sourceLocation(projectRoot, sourceFile, keyNode);
  const key = getStringValue(keyNode);
  if (key === undefined) {
    dynamicCalls.push(
      `${location} ${keyNode.getText(sourceFile).replaceAll(/\s+/g, " ")}`,
    );
    return;
  }

  const template = base.get(key);
  if (template === undefined) {
    issues.push(`${location} references unknown key "${key}".`);
    return;
  }

  const variablesNode = call.arguments[1];
  if (!variablesNode || !ts.isObjectLiteralExpression(variablesNode)) return;
  const variables = getObjectKeys(variablesNode);
  if (!variables) return;

  const expected = extractPlaceholders(template);
  const missing = expected.filter((name) => !variables.has(name));
  const extra = [...variables]
    .filter((name) => !expected.includes(name))
    .sort();
  if (missing.length > 0 || extra.length > 0) {
    const differences = [
      missing.length > 0 ? `missing [${missing.join(", ")}]` : "",
      extra.length > 0 ? `extra [${extra.join(", ")}]` : "",
    ].filter(Boolean);
    issues.push(
      `${location} passes invalid variables to "${key}": ${differences.join("; ")}.`,
    );
  }
}

function getObjectKeys(
  node: ts.ObjectLiteralExpression,
): Set<string> | undefined {
  const keys = new Set<string>();
  for (const property of node.properties) {
    if (ts.isSpreadAssignment(property)) return;
    if (ts.isShorthandPropertyAssignment(property)) {
      keys.add(property.name.text);
      continue;
    }
    if (ts.isPropertyAssignment(property)) {
      const name = getPropertyName(property.name);
      if (name === undefined) return;
      keys.add(name);
    }
  }
  return keys;
}

function getPropertyName(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
    ? name.text
    : undefined;
}

export function extractPlaceholders(value: string): string[] {
  return [
    ...new Set([...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1])),
  ].sort();
}

function getScriptKind(file: string): ts.ScriptKind {
  const extension = path.extname(file);
  if (extension === ".js") return ts.ScriptKind.JS;
  if (extension === ".jsx") return ts.ScriptKind.JSX;
  if (extension === ".tsx") return ts.ScriptKind.TSX;
  return ts.ScriptKind.TS;
}

function getStringValue(node: ts.Node): string | undefined {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : undefined;
}

function sourceLocation(
  projectRoot: string,
  sourceFile: ts.SourceFile,
  node: ts.Node,
): string {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );
  const file = path
    .relative(projectRoot, sourceFile.fileName)
    .replaceAll(path.sep, "/");
  return `${file}:${line + 1}:${character + 1}`;
}
