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

export function renderOperation(result: OperationResult): string {
  const lines = [
    `${result.command}: ${result.projectRoot}`,
    `Actions: ${result.plan.actions.length}; unchanged: ${result.plan.unchanged.length}; conflicts: ${result.plan.conflicts.length}; divergences: ${result.plan.divergences.length}`
  ];
  if (result.resolution) {
    lines.push(`Preset skills: ${result.resolution.roots.length} roots, ${result.resolution.dependencies.length} dependencies, ${result.resolution.skills.length} total`);
  }
  for (const target of result.targets ?? []) lines.push(`Target ${target.root}: ${target.consumers.join(", ")}`);
  for (const conflict of result.plan.conflicts) lines.push(`Conflict ${conflict.code}: ${conflict.key} (${conflict.paths.join(", ")})`);
  for (const divergence of result.plan.divergences) lines.push(`Divergence ${divergence.code}: ${divergence.key} (${divergence.paths.join(", ")})`);
  if (result.applied) lines.push(result.applied.changed ? "Applied." : "No changes.");
  if (result.applied?.backupPath) lines.push(`Backup: ${result.applied.backupPath}`);
  if (result.healthy !== undefined) lines.push(result.healthy ? "Healthy." : "Drift detected.");
  return `${lines.join("\n")}\n`;
}

export function renderList(result: ListResult): string {
  const lines = ["Presets:"];
  for (const preset of result.presets) {
    const aliases = preset.aliases.length > 0 ? ` (${preset.aliases.join(", ")})` : "";
    lines.push(`  ${preset.name}${aliases}: ${preset.rootCount} roots, ${preset.resolvedCount} resolved — ${preset.purpose}`);
  }
  lines.push("", "Harnesses:");
  for (const harness of result.harnesses) lines.push(`  ${harness.id}: ${harness.root} — ${harness.displayName}`);
  return `${lines.join("\n")}\n`;
}
