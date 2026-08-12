import process from "node:process";

import type { CheckJob, Severity } from "./checks";

type Status = "pass" | "warning" | "error";

interface ReportOptions {
  strict: boolean;
  verbose: boolean;
}

const style = {
  bold: (value: string) => decorate(1, value),
  dim: (value: string) => decorate(2, value),
  green: (value: string) => decorate(32, value),
  red: (value: string) => decorate(31, value),
  yellow: (value: string) => decorate(33, value),
};

const supportsColor = (() => {
  if (process.env.FORCE_COLOR === "0") return false;
  if (process.env.FORCE_COLOR !== undefined) return true;
  return (
    process.env.NO_COLOR === undefined &&
    process.env.TERM !== "dumb" &&
    process.stdout.isTTY
  );
})();

function groupJobs(
  jobs: CheckJob[],
  strict: boolean,
): {
  groups: Record<Status, CheckJob[]>;
  statuses: Map<CheckJob, Status>;
} {
  const groups: Record<Status, CheckJob[]> = {
    pass: [],
    warning: [],
    error: [],
  };
  const statuses = new Map<CheckJob, Status>();
  for (const job of jobs) {
    const status = getStatus(job, strict);
    groups[status].push(job);
    statuses.set(job, status);
  }
  return { groups, statuses };
}

function getStatus(job: CheckJob, strict: boolean): Status {
  if (!job.error && job.result.issues.length === 0) return "pass";
  if (job.error || job.check.severity === "error" || strict) return "error";
  return "warning";
}

function decorate(code: number, value: string): string {
  return supportsColor ? `\u001B[${code}m${value}\u001B[0m` : value;
}

function statusLabel(status: Status): string {
  if (status === "pass") return style.green("PASS");
  if (status === "warning") return style.yellow("WARN");
  return style.red("FAIL");
}

function printSection(title: string): void {
  console.log(style.bold(title));
}

function printCheckStatus(job: CheckJob, status: Status): void {
  console.log(`  ${statusLabel(status)}  ${job.check.description}`);
}

function printCheckDetails(job: CheckJob, severity: Severity): void {
  const colorize = severity === "error" ? style.red : style.yellow;
  console.log(`  ${colorize(job.check.description)}`);

  if (job.error) {
    console.log(`    ${style.red(`Unexpected error: ${job.error.message}`)}`);
    return;
  }

  console.log();
  for (const issue of job.result.issues) console.log(`    - ${issue}`);
  if (job.result.advice) {
    console.log();
    console.log(`    ${style.bold("Advice")}`);
    console.log(`      ${job.result.advice}`);
  }
}

function summaryCount(count: number, label: string, status: Status): string {
  const value = `${count} ${label}${label === "warning" && count !== 1 ? "s" : ""}`;
  if (status === "pass") return style.green(value);
  if (status === "warning") return style.yellow(value);
  return count > 0 ? style.red(value) : style.dim(value);
}

export function printSummary(jobs: CheckJob[], options: ReportOptions): number {
  const { groups, statuses } = groupJobs(jobs, options.strict);
  const issues = [...groups.error, ...groups.warning];

  if (options.verbose) {
    printSection("Checks");
    for (const job of jobs) {
      printCheckStatus(job, statuses.get(job)!);
    }
    console.log();
  }

  printSection("Summary");
  console.log(
    `  ${summaryCount(groups.pass.length, "passed", "pass")}   ` +
      `${summaryCount(groups.error.length, "failed", "error")}   ` +
      `${summaryCount(groups.warning.length, "warning", "warning")}`,
  );

  if (issues.length > 0) {
    console.log();
    printSection(groups.error.length > 0 ? "Issues" : "Warnings");
    issues.forEach((job, index) => {
      if (index > 0) console.log();
      printCheckDetails(
        job,
        statuses.get(job) === "error" ? "error" : "warning",
      );
    });
  }

  if (options.verbose) {
    const details = jobs.flatMap((job) => job.result.details ?? []);
    if (details.length > 0) {
      console.log();
      printSection(`Dynamic calls (${details.length})`);
      for (const detail of details) console.log(`  ${style.dim(detail)}`);
    }
  }

  return groups.error.length > 0 ? 1 : 0;
}
