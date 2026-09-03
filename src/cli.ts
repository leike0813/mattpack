#!/usr/bin/env node

import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";

import { canonicalPreset, CANONICAL_PRESETS, type CanonicalPreset } from "./catalog/presets.js";
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
  updateProject
} from "./core/service.js";
import { readConfig, readPackageVersion } from "./core/state.js";
import { HARNESS_ADAPTERS, selectHarnesses } from "./harnesses/registry.js";
import { errorJson, operationData, renderList, renderOperation, successJson } from "./output/render.js";

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
  --harness <id>     Repeatable harness id; use "all" for every harness
  --yes              Accept the default preset and skip confirmation
  --dry-run          Return the real plan without applying it
  --json             Write one JSON value to stdout
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
    harness?: string[];
    yes?: boolean;
    "dry-run"?: boolean;
    json?: boolean;
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
        harness: { type: "string", multiple: true },
        yes: { type: "boolean" },
        "dry-run": { type: "boolean" },
        json: { type: "boolean" },
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
    for (const key of ["dir", "harness", "yes", "dry-run", "force", "no-deps"] as const) {
      if (values[key] !== undefined) invalidOptions.push(`--${key}`);
    }
  } else if (command === "doctor") {
    for (const key of ["harness", "yes", "dry-run", "force", "no-deps"] as const) {
      if (values[key] !== undefined) invalidOptions.push(`--${key}`);
    }
  } else if (command === "remove") {
    for (const key of ["harness", "yes", "force", "no-deps"] as const) {
      if (values[key] !== undefined) invalidOptions.push(`--${key}`);
    }
  } else if (command === "update") {
    for (const key of ["harness", "yes", "no-deps"] as const) {
      if (values[key] !== undefined) invalidOptions.push(`--${key}`);
    }
  }
  if (invalidOptions.length > 0) throw new MattpackError("INVALID_ARGUMENT", `Unsupported options for ${command}: ${invalidOptions.join(", ")}`);
  const result: Parsed = { command, values };
  if (preset) result.preset = preset;
  return result;
}

async function promptChoices(projectRoot: string, parsed: Parsed, persisted?: Awaited<ReturnType<typeof readConfig>>): Promise<{
  preset: CanonicalPreset;
  harnesses: readonly string[];
}> {
  let preset = parsed.preset ? canonicalPreset(parsed.preset) : persisted?.preset;
  let harnesses = parsed.values.harness ?? persisted?.harnesses;
  const canPrompt = Boolean(process.stdin.isTTY && process.stdout.isTTY && !parsed.values.json && !parsed.values.yes);
  if (parsed.values.yes && !preset) preset = "default";
  if (preset && harnesses && harnesses.length > 0) return { preset, harnesses: selectHarnesses(harnesses).map((item) => item.id) };
  if (!canPrompt) throw new MattpackError("NON_INTERACTIVE_INPUT_REQUIRED", "Preset and harness selection are required");

  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (!preset) {
      process.stdout.write(`Presets: ${CANONICAL_PRESETS.join(", ")}\n`);
      const answer = (await readline.question("Preset [default]: ")).trim();
      preset = canonicalPreset(answer || "default");
    }
    if (!harnesses || harnesses.length === 0) {
      const detected = await detectHarnesses(projectRoot);
      const evidence = new Map(detected.map((entry) => [entry.id, entry.result.evidence]));
      process.stdout.write("Harnesses:\n");
      for (const harness of HARNESS_ADAPTERS) {
        const hint = evidence.get(harness.id);
        process.stdout.write(`  ${harness.id}${hint ? ` (detected: ${hint.join(", ")})` : ""}\n`);
      }
      const answer = (await readline.question("Harness ids (comma-separated): ")).trim();
      if (!answer) throw new MattpackError("NON_INTERACTIVE_INPUT_REQUIRED", "Select at least one harness");
      harnesses = answer.split(",").map((item) => item.trim()).filter(Boolean);
    }
  } finally {
    readline.close();
  }
  return { preset, harnesses: selectHarnesses(harnesses).map((item) => item.id) };
}

async function confirm(): Promise<boolean> {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^(?:y|yes)$/iu.test((await readline.question("Apply this plan? [y/N]: ")).trim());
  } finally {
    readline.close();
  }
}

async function main(argv = process.argv.slice(2)): Promise<number> {
  const parsed = parse(argv);
  const json = Boolean(parsed.values.json);
  const packageRoot = packageRootFrom();
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
    const choices = await promptChoices(projectRoot, parsed, persisted);
    const dryRun = parsed.command === "inspect" || Boolean(parsed.values["dry-run"]);
    const includeDependencies = parsed.values["no-deps"] ? false : (persisted?.includeDependencies ?? true);
    const result = await installProject({
      command: parsed.command,
      projectRoot,
      packageRoot,
      preset: choices.preset,
      harnesses: choices.harnesses,
      includeDependencies,
      dryRun: true,
      ...(parsed.values.force === undefined ? {} : { force: parsed.values.force })
    });
    if (!dryRun) {
      if (json && !parsed.values.yes) throw new MattpackError("NON_INTERACTIVE_INPUT_REQUIRED", "--json mutation requires --yes");
      if (!json && !parsed.values.yes) {
        process.stdout.write(renderOperation(result));
        if (!(await confirm())) return 0;
      }
      result.applied = await applyPlan(projectRoot, result.plan, parsed.values.force);
    }
    if (parsed.values["no-deps"]) process.stderr.write("Warning: --no-deps may produce an unusable installation.\n");
    process.stdout.write(json ? successJson(parsed.command, projectRoot, operationData(result)) : renderOperation(result));
    return 0;
  }

  let result;
  if (parsed.command === "update") {
    result = await updateProject({
      projectRoot,
      packageRoot,
      ...(parsed.values["dry-run"] === undefined ? {} : { dryRun: parsed.values["dry-run"] }),
      ...(parsed.values.force === undefined ? {} : { force: parsed.values.force })
    });
  } else if (parsed.command === "doctor") {
    result = await doctorProject(projectRoot, packageRoot);
  } else {
    result = await removeProject({
      projectRoot,
      ...(parsed.values["dry-run"] === undefined ? {} : { dryRun: parsed.values["dry-run"] })
    });
  }
  process.stdout.write(json ? successJson(parsed.command, projectRoot, operationData(result)) : renderOperation(result));
  return result.command === "doctor" && !result.healthy ? 1 : 0;
}

const wantsJson = process.argv.includes("--json");
try {
  process.exitCode = await main();
} catch (error) {
  const normalized = asMattpackError(error);
  if (wantsJson) process.stdout.write(errorJson(normalized));
  else {
    process.stderr.write(`Error [${normalized.code}]: ${normalized.message}\n`);
    if (["INVALID_ARGUMENT", "UNKNOWN_PRESET", "UNKNOWN_HARNESS"].includes(normalized.code)) {
      process.stderr.write('Run "mattpack --help" for usage.\n');
    }
  }
  process.exitCode = normalized.code === "INVALID_ARGUMENT" ? 2 : 1;
}
