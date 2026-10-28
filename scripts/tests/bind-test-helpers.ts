import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

/** Evaluate production declarations without importing the native app runtime. */
export function loadTsDeclarations<T>(
  relativePath: string,
  names: string[],
  globals: Record<string, unknown> = {},
): T {
  if (names.some((name) => !/^[A-Za-z_$][\w$]*$/.test(name))) {
    throw new Error("Expected declaration names, not expressions");
  }
  const file = new URL(`../../${relativePath}`, import.meta.url);
  const source = ts.createSourceFile(
    file.pathname,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const declarations = ts.factory.updateSourceFile(
    source,
    source.statements.filter((statement) => !ts.isImportDeclaration(statement)),
  );
  // Transpile the complete AST, including template substitutions and escapes.
  // Taking raw template text would execute different JavaScript in the WebView.
  const compiled = ts.transpileModule(
    ts.createPrinter().printFile(declarations),
    {
      fileName: file.pathname,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
      },
    },
  ).outputText;
  return runInNewContext(
    `${compiled}\n({${names.map((name) => `${name}: typeof ${name} !== 'undefined' ? ${name} : exports.${name}`).join(",")}});`,
    { exports: {}, URL, encodeURIComponent, ...globals },
    { filename: file.pathname },
  ) as T;
}

export function loadBindDeclarations<T>(
  names: string[],
  globals: Record<string, unknown> = {},
): T {
  return loadTsDeclarations<T>("app/browser/bind.tsx", names, globals);
}
