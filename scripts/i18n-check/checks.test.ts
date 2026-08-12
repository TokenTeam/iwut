import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runChecks, type CheckJob } from "./checks";

const temporaryProjects: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryProjects.splice(0).map((project) =>
      fs.rm(project, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

describe("i18n-check", () => {
  test("recognizes aliases and property calls, and validates literal variables", async () => {
    const project = await createProject({
      zh: `{"greeting":"Hello {name}"}`,
      en: `{"greeting":"Hello {name}"}`,
      source: `
        import { t as translate, useT } from "@/lib/i18n/index";
        translate("missing");
        const localT = useT();
        localT("greeting", { wrong: "Codex" });
        const context = { t: localT };
        context.t("greeting", { name: "Codex" });
      `,
    });

    const job = findJob(await runChecks(project), "valid keys and variables");
    expect(job.result.issues).toHaveLength(2);
    expect(job.result.issues[0]).toContain('unknown key "missing"');
    expect(job.result.issues[1]).toContain("missing [name]; extra [wrong]");
  });

  test("ignores unrelated functions named t", async () => {
    const project = await createProject({
      zh: `{"used":"Used"}`,
      en: `{"used":"Used"}`,
      source: `
        const t = (value: string) => value;
        t("not.an.i18n.key");
        const used = "used";
      `,
    });

    const job = findJob(await runChecks(project), "valid keys and variables");
    expect(job.result.issues).toEqual([]);
  });

  test("detects duplicate JSON keys without treating repeated placeholders as different", async () => {
    const project = await createProject({
      zh: `{"message":"{name} {name}","duplicate":"first","duplicate":"second"}`,
      en: `{"message":"{name}","duplicate":"second"}`,
      source: `const message = "message"; const duplicate = "duplicate";`,
    });

    const jobs = await runChecks(project);
    expect(findJob(jobs, "locale files").result.issues[0]).toContain(
      'duplicates key "duplicate"',
    );
    expect(findJob(jobs, "placeholders").result.issues).toEqual([]);
  });

  test("reports dynamic calls while conservatively preserving mentioned keys", async () => {
    const project = await createProject({
      zh: `{"used":"Used","unused":"Unused"}`,
      en: `{"used":"Used","unused":"Unused"}`,
      source: `
        import { useT } from "@/lib/i18n";
        const t = useT();
        const keys = ["used"];
        t(keys[0]);
      `,
    });

    const jobs = await runChecks(project);
    const references = findJob(jobs, "valid keys and variables");
    const unused = findJob(jobs, "possibly unused");
    expect(references.result.details?.[0]).toContain("keys[0]");
    expect(unused.result.issues).toEqual(["unused"]);
  });

  test("does not report dependent checks as passed when locales cannot load", async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), "i18n-check-"));
    temporaryProjects.push(project);

    const jobs = await runChecks(project);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].result.issues[0]).toContain("Locale directory");
  });
});

async function createProject(input: {
  zh: string;
  en: string;
  source: string;
}): Promise<string> {
  const project = await fs.mkdtemp(path.join(os.tmpdir(), "i18n-check-"));
  temporaryProjects.push(project);

  const locales = path.join(project, "lib", "i18n", "locales");
  await fs.mkdir(locales, { recursive: true });
  await Promise.all([
    Bun.write(path.join(locales, "zh.json"), input.zh),
    Bun.write(path.join(locales, "en.json"), input.en),
    Bun.write(path.join(project, "app.ts"), input.source),
  ]);
  return project;
}

function findJob(jobs: CheckJob[], description: string): CheckJob {
  const job = jobs.find((candidate) =>
    candidate.check.description.includes(description),
  );
  if (!job) throw new Error(`Check not found: ${description}`);
  return job;
}
