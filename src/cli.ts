#!/usr/bin/env node

import { parseArgs } from "node:util";
import path from "node:path";

import { canonicalPreset, CANONICAL_PRESETS, PRESETS, type CanonicalPreset } from "./catalog/presets.js";
import { packageRootFrom } from "./catalog/upstream.js";
import { applyPlan } from "./core/apply.js";
import { asMattpackError, MattpackError } from "./core/errors.js";
import { resolveProjectRoot } from "./core/paths.js";
import {
  detectHarnesses,
  doctorProject,
  installProject,
  listCatalog,
  removeProject,
  selectAdditionalSkills,
  skillSelectionCatalog,
  updateProject
} from "./core/service.js";
import { readConfig, readPackageVersion } from "./core/state.js";
import type { HarnessPromptOption } from "./output/prompts.js";
import { HARNESS_ADAPTERS, selectHarnesses } from "./harnesses/registry.js";
import { errorJson, operationData, renderList, renderOperation, successJson } from "./output/render.js";
import {
  confirmPlan,
  isInteractive,
  isPromptCancellation,
  selectPresetAndHarnesses
} from "./output/prompts.js";

type Command = "init" | "inspect" | "list" | "update" | "doctor" | "remove";
const COMMANDS = new Set<Command>(["init", "inspect", "list", "update", "doctor", "remove"]);

const HELP = `mattpack — project-local Matt Pocock skill presets

Usage:
  mattpack [init] [preset] [options]
  mattpack inspect [preset] [options]
  mattpack list [--json]
  mattpack update [options]
  mattpack doctor [options]
  mattpack remove [options]

Options:
  --dir <path>       Project directory
  --tools <ids>      Comma-separated tool ids; use "all" for every tool
  --skills <ids>     Comma-separated skill ids to add to the preset
  --yes              Use defaults and approve writes without prompting
  --dry-run          Return the real plan without applying it
  --json             Write one JSON value to stdout
  --no-color         Disable color output
  --force            Back up and replace conflicting bytes
  --no-deps          Install preset roots without dependencies
  --help              Show help
  --version           Show version
`;

interface Parsed {
  command: Command;
  preset?: string;
  values: {
    dir?: string;
    tools?: string;
    skills?: string;
    yes?: boolean;
    "dry-run"?: boolean;
    json?: boolean;
    "no-color"?: boolean;
    force?: boolean;
    "no-deps"?: boolean;
    help?: boolean;
    version?: boolean;
  };
}

function parse(argv: readonly string[]): Parsed {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        dir: { type: "string" },
        tools: { type: "string" },
        skills: { type: "string" },
        yes: { type: "boolean" },
        "dry-run": { type: "boolean" },
        json: { type: "boolean" },
        "no-color": { type: "boolean" },
        force: { type: "boolean" },
        "no-deps": { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" }
      }
    });
  } catch (error) {
    throw new MattpackError("INVALID_ARGUMENT", error instanceof Error ? error.message : String(error));
  }
  const positionals = parsed.positionals;
  let command: Command = "init";
  let preset: string | undefined;
  const first = positionals[0];
  if (first && COMMANDS.has(first as Command)) {
    command = first as Command;
    preset = positionals[1];
    if (positionals.length > 2) throw new MattpackError("INVALID_ARGUMENT", "Too many positional arguments");
  } else {
    preset = first;
    if (positionals.length > 1) throw new MattpackError("INVALID_ARGUMENT", "Too many positional arguments");
  }
  if (preset && command !== "init" && command !== "inspect") {
    throw new MattpackError("INVALID_ARGUMENT", `${command} does not accept a preset`);
  }
  const values = parsed.values;
  const invalidOptions: string[] = [];
  if (command === "list") {
    for (const key of ["dir", "tools", "skills", "yes", "dry-run", "force", "no-deps"] as const) {
      if (values[key] !== undefined) invalidOptions.push(`--${key}`);
    }
  } else if (command === "doctor") {
    for (const key of ["tools", "skills", "yes", "dry-run", "force", "no-deps"] as const) {
      if (values[key] !== undefined) invalidOptions.push(`--${key}`);
    }
  } else if (command === "remove") {
    for (const key of ["tools", "skills", "force", "no-deps"] as const) {
      if (values[key] !== undefined) invalidOptions.push(`--${key}`);
    }
  } else if (command === "update") {
    for (const key of ["tools", "skills", "no-deps"] as const) {
      if (values[key] !== undefined) invalidOptions.push(`--${key}`);
    }
  }
  if (invalidOptions.length > 0) throw new MattpackError("INVALID_ARGUMENT", `Unsupported options for ${command}: ${invalidOptions.join(", ")}`);
  const result: Parsed = { command, values };
  if (preset) result.preset = preset;
  return result;
}

function parseIds(value: string, option: "tools" | "skills"): string[] {
  const ids = value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (ids.length === 0) throw new MattpackError("INVALID_ARGUMENT", `--${option} requires at least one id`);
  return ids;
}

async function promptChoices(
  projectRoot: string,
  packageRoot: string,
  parsed: Parsed,
  persisted?: Awaited<ReturnType<typeof readConfig>>
): Promise<{
  preset: CanonicalPreset;
  additionalSkills: readonly string[];
  harnesses: readonly string[];
}> {
  const explicitTools = parsed.values.tools !== undefined;
  let preset = parsed.preset ? canonicalPreset(parsed.preset) : explicitTools ? "default" : persisted?.preset;
  let harnesses = explicitTools ? parseIds(parsed.values.tools ?? "", "tools") : persisted?.harnesses;
  let additionalSkills = [...new Set([
    ...(persisted?.additionalSkills ?? []),
    ...(parsed.values.skills === undefined ? [] : parseIds(parsed.values.skills, "skills"))
  ])].sort();
  const canPrompt = !parsed.values.json && !parsed.values.yes && isInteractive();
  if (!canPrompt && !preset) preset = "default";

  const promptHarness = !explicitTools;
  const promptMissing = parsed.command === "init" || !preset || !harnesses?.length;
  if (canPrompt && promptMissing && promptHarness) {
    if (parsed.command === "init") {
      process.stdout.write("\nWelcome to Mattpack\nInstall curated skills into this project.\n\n");
    }
    let harnessOptions: HarnessPromptOption[] | undefined;
    if (promptHarness) {
      const detected = await detectHarnesses(projectRoot);
      const evidence = new Map(detected.map((entry) => [entry.id, entry.result.evidence]));
      const configured = new Set(persisted?.harnesses ?? []);
      harnessOptions = HARNESS_ADAPTERS.map((harness) => ({
        id: harness.id,
        displayName: harness.displayName,
        root: path.relative(projectRoot, harness.getSkillRoot(projectRoot)).split(path.sep).join("/"),
        evidence: evidence.get(harness.id) ?? [],
        configured: configured.has(harness.id)
      }));
    }
    const skillOptions = await skillSelectionCatalog(packageRoot);
    additionalSkills = selectAdditionalSkills(
      additionalSkills,
      new Set(skillOptions.map((skill) => skill.name))
    );
    const selected = await selectPresetAndHarnesses(
      CANONICAL_PRESETS.map((name) => PRESETS[name]),
      preset ?? "default",
      harnessOptions ?? [],
      skillOptions,
      additionalSkills,
      Boolean(parsed.preset)
    );
    preset = selected.preset;
    additionalSkills = [...selected.additionalSkills];
    harnesses = selected.harnesses;
  }
  if (!preset || !harnesses?.length) {
    throw new MattpackError(
      "NON_INTERACTIVE_INPUT_REQUIRED",
      "Tool selection is required; pass --tools all or a comma-separated list of tool ids"
    );
  }
  return {
    preset,
    additionalSkills,
    harnesses: selectHarnesses(harnesses).map((item) => item.id)
  };
}

function planChanges(result: Awaited<ReturnType<typeof installProject>>): boolean {
  return result.plan.actions.length > 0 || result.plan.stateNeedsWrite;
}

async function applyMutation(
  result: Awaited<ReturnType<typeof installProject>>,
  parsed: Parsed
): Promise<boolean> {
  const json = Boolean(parsed.values.json);
  const force = Boolean(parsed.values.force);
  if (result.plan.conflicts.length > 0 && !force) {
    if (!json) process.stdout.write(renderOperation(result));
    result.applied = await applyPlan(result.projectRoot, result.plan, false);
    return true;
  }
  if (planChanges(result) && !parsed.values.yes) {
    if (json || !isInteractive()) {
      throw new MattpackError("NON_INTERACTIVE_INPUT_REQUIRED", `mattpack ${result.command} requires --yes when it will write`);
    }
    process.stdout.write(renderOperation(result));
    if (!(await confirmPlan(result.command === "remove" ? "Remove these managed skills?" : "Apply this plan?"))) {
      process.stdout.write("Cancelled. No changes were made.\n");
      return false;
    }
  }
  result.applied = await applyPlan(result.projectRoot, result.plan, force);
  return true;
}

async function main(argv = process.argv.slice(2)): Promise<number> {
  const parsed = parse(argv);
  if (parsed.values["no-color"]) process.env.NO_COLOR = "1";
  const json = Boolean(parsed.values.json);
  const packageRoot = packageRootFrom(new URL("./catalog/upstream.js", import.meta.url).href);
  if (parsed.values.help) {
    process.stdout.write(json ? successJson("help", process.cwd(), { help: HELP }) : HELP);
    return 0;
  }
  if (parsed.values.version) {
    const version = await readPackageVersion(packageRoot);
    process.stdout.write(json ? successJson("version", process.cwd(), { version }) : `${version}\n`);
    return 0;
  }
  if (parsed.command === "list") {
    const result = await listCatalog(packageRoot);
    process.stdout.write(json ? successJson("list", process.cwd(), result) : renderList(result));
    return 0;
  }

  const projectRoot = await resolveProjectRoot({ ...(parsed.values.dir ? { dir: parsed.values.dir } : {}) });
  if (parsed.command === "init" || parsed.command === "inspect") {
    const persisted = await readConfig(projectRoot, true);
    const choices = await promptChoices(projectRoot, packageRoot, parsed, persisted);
    const dryRun = parsed.command === "inspect" || Boolean(parsed.values["dry-run"]);
    const includeDependencies = parsed.values["no-deps"] ? false : (persisted?.includeDependencies ?? true);
    const result = await installProject({
      command: parsed.command,
      projectRoot,
      packageRoot,
      preset: choices.preset,
      additionalSkills: choices.additionalSkills,
      harnesses: choices.harnesses,
      includeDependencies,
      dryRun: true,
      ...(parsed.values.force === undefined ? {} : { force: parsed.values.force })
    });
    if (!dryRun && !(await applyMutation(result, parsed))) return 0;
    if (parsed.values["no-deps"]) process.stderr.write("Warning: --no-deps may produce an unusable installation.\n");
    process.stdout.write(json ? successJson(parsed.command, projectRoot, operationData(result)) : renderOperation(result));
    return 0;
  }

  let result;
  if (parsed.command === "update") {
    result = await updateProject({
      projectRoot,
      packageRoot,
      dryRun: true,
      ...(parsed.values.force === undefined ? {} : { force: parsed.values.force })
    });
  } else if (parsed.command === "doctor") {
    result = await doctorProject(projectRoot, packageRoot);
  } else {
    result = await removeProject({
      projectRoot,
      dryRun: true
    });
  }
  if (parsed.command !== "doctor" && !parsed.values["dry-run"] && !(await applyMutation(result, parsed))) return 0;
  process.stdout.write(json ? successJson(parsed.command, projectRoot, operationData(result)) : renderOperation(result));
  return result.command === "doctor" && !result.healthy ? 1 : 0;
}

const wantsJson = process.argv.includes("--json");
try {
  process.exitCode = await main();
} catch (error) {
  if (isPromptCancellation(error)) {
    process.stderr.write("Cancelled.\n");
    process.exitCode = 130;
  } else {
    const normalized = asMattpackError(error);
    if (wantsJson) process.stdout.write(errorJson(normalized));
    else {
      process.stderr.write(`Error [${normalized.code}]: ${normalized.message}\n`);
      if (["INVALID_ARGUMENT", "UNKNOWN_PRESET", "UNKNOWN_SKILL", "UNKNOWN_TOOL"].includes(normalized.code)) {
        process.stderr.write('Run "mattpack --help" for usage.\n');
      }
    }
    process.exitCode = normalized.code === "INVALID_ARGUMENT" ? 2 : 1;
  }
}
