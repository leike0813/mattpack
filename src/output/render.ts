import type { ListResult, OperationResult } from "../core/service.js";
import type { ReconciliationPlan } from "../core/plan.js";
import type { MattpackError } from "../core/errors.js";

function publicPlan(plan: ReconciliationPlan): unknown {
  return {
    command: plan.command,
    actions: plan.actions.map(({ kind, key, preserveFiles }) => ({ kind, key, preserveFiles })),
    unchanged: plan.unchanged,
    conflicts: plan.conflicts,
    divergences: plan.divergences,
    stateNeedsWrite: plan.stateNeedsWrite
  };
}

export function operationData(result: OperationResult): unknown {
  return {
    plan: publicPlan(result.plan),
    ...(result.resolution ? { resolution: result.resolution } : {}),
    ...(result.targets ? {
      targets: result.targets.map(({ root, consumers }) => ({ root, consumers }))
    } : {}),
    ...(result.applied ? { applied: result.applied } : {}),
    ...(result.healthy !== undefined ? { healthy: result.healthy } : {})
  };
}

export function successJson(command: string, projectRoot: string, result: unknown): string {
  return `${JSON.stringify({ ok: true, command, projectRoot, result }, null, 2)}\n`;
}

export function errorJson(error: MattpackError): string {
  return `${JSON.stringify({
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details })
    }
  }, null, 2)}\n`;
}

const colorEnabled = (): boolean => Boolean(process.stdout.isTTY && !("NO_COLOR" in process.env));
export const style = (code: number, value: string): string => colorEnabled() ? `\u001B[${code}m${value}\u001B[0m` : value;
const bold = (value: string): string => style(1, value);
const green = (value: string): string => style(32, value);
const yellow = (value: string): string => style(33, value);
const red = (value: string): string => style(31, value);

function actionLines(plan: ReconciliationPlan): string[] {
  const lines: string[] = [];
  for (const [kind, label, symbol] of [
    ["add", "Add", green("+")],
    ["replace", "Replace", yellow("~")],
    ["remove", "Remove", red("-")]
  ] as const) {
    const byRoot = new Map<string, string[]>();
    for (const action of plan.actions.filter((item) => item.kind === kind)) {
      byRoot.set(action.root, [...(byRoot.get(action.root) ?? []), action.name]);
    }
    for (const [root, names] of byRoot) {
      lines.push(`  ${symbol} ${label} ${root} (${names.length}): ${names.join(", ")}`);
    }
  }
  if (plan.stateNeedsWrite) lines.push("  ~ Update .mattpack/config.json and .mattpack/lock.json");
  if (lines.length === 0) lines.push("  No changes");
  if (plan.unchanged.length > 0) lines.push(`  = Keep ${plan.unchanged.length} managed skill(s) unchanged`);
  return lines;
}

function issueLines(label: string, issues: ReconciliationPlan["conflicts"], marker: string): string[] {
  if (issues.length === 0) return [];
  return [
    "",
    bold(`${label} (${issues.length})`),
    ...issues.map((issue) => `  ${marker} ${issue.code}: ${issue.key} (${issue.paths.join(", ")})`)
  ];
}

function renderPlan(result: OperationResult): string {
  const lines = [
    bold(`Mattpack ${result.command} plan`),
    `Project: ${result.projectRoot}`
  ];
  if (result.resolution) {
    lines.push(
      `Skills: ${result.resolution.roots.length} roots + ${result.resolution.dependencies.length} dependencies = ${result.resolution.skills.length} total`
    );
  }
  if (result.targets?.length) {
    lines.push("Targets:", ...result.targets.map((target) => `  ${target.root} (${target.consumers.join(", ")})`));
  }
  lines.push("", bold("Changes"), ...actionLines(result.plan));
  lines.push(...issueLines("Conflicts", result.plan.conflicts, red("!")));
  lines.push(...issueLines("Preserved drift", result.plan.divergences, yellow("!")));
  if (result.command === "inspect") lines.push("", "Inspection only; no files were changed.");
  return `${lines.join("\n")}\n`;
}

export function renderOperation(result: OperationResult): string {
  if (result.healthy !== undefined) {
    if (result.healthy) return `${green("✓")} ${bold("Mattpack installation is healthy")}\nProject: ${result.projectRoot}\n`;
    return `${yellow("!")} ${bold("Mattpack drift detected")}\n${renderPlan(result)}\nNext: run mattpack update --dry-run to inspect repairs.\n`;
  }
  if (!result.applied) return renderPlan(result);
  if (!result.applied.changed) return `${green("✓")} ${bold("Already up to date")}\nProject: ${result.projectRoot}\n`;

  const counts = { add: 0, replace: 0, remove: 0 };
  for (const action of result.plan.actions) counts[action.kind] += 1;
  const lines = [
    `${green("✓")} ${bold(`Mattpack ${result.command} complete`)}`,
    `Project: ${result.projectRoot}`,
    `Changed: ${counts.add} added, ${counts.replace} replaced, ${counts.remove} removed`
  ];
  if (result.plan.divergences.length > 0) lines.push(`Preserved: ${result.plan.divergences.length} drift item(s)`);
  if (result.applied.backupPath) lines.push(`Backup: ${result.applied.backupPath}`);
  return `${lines.join("\n")}\n`;
}

export function renderList(result: ListResult): string {
  const lines = [bold("Presets")];
  for (const preset of result.presets) {
    const aliases = preset.aliases.length > 0 ? ` (${preset.aliases.join(", ")})` : "";
    lines.push(`  ${preset.name}${aliases}`, `    ${preset.rootCount} roots → ${preset.resolvedCount} installed · ${preset.purpose}`);
  }
  lines.push("", bold("Harnesses"));
  for (const harness of result.harnesses) lines.push(`  ${harness.displayName} (${harness.id})`, `    ${harness.root}`);
  return `${lines.join("\n")}\n`;
}
