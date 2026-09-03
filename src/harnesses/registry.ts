import { stat } from "node:fs/promises";
import path from "node:path";

import { MattpackError } from "../core/errors.js";
import type { DetectionResult, HarnessAdapter, HarnessTarget } from "./types.js";

interface HarnessDefinition {
  id: string;
  displayName: string;
  root: string;
  detectionPaths: readonly string[];
  aliases?: readonly string[];
}

const DEFINITIONS: readonly HarnessDefinition[] = [
  { id: "agents", displayName: "Shared .agents skills", root: ".agents/skills", detectionPaths: [".agents/skills"] },
  { id: "codex", displayName: "Codex", root: ".agents/skills", detectionPaths: [".agents/skills", ".codex/skills"] },
  { id: "zed", displayName: "Zed Agent", root: ".agents/skills", detectionPaths: [".zed", ".agents/skills"] },
  { id: "claude", displayName: "Claude Code", root: ".claude/skills", detectionPaths: [".claude"] },
  { id: "opencode", displayName: "OpenCode", root: ".opencode/skills", detectionPaths: [".opencode"] },
  { id: "pi", displayName: "Pi", root: ".pi/skills", detectionPaths: [".pi"] },
  { id: "oh-my-pi", displayName: "Oh My Pi", root: ".omp/skills", detectionPaths: [".omp"] },
  { id: "gemini", displayName: "Gemini CLI", root: ".gemini/skills", detectionPaths: [".gemini"] },
  { id: "cursor", displayName: "Cursor", root: ".cursor/skills", detectionPaths: [".cursor"] },
  {
    id: "github-copilot",
    displayName: "GitHub Copilot",
    root: ".github/skills",
    detectionPaths: [
      ".github/copilot-instructions.md",
      ".github/instructions",
      ".github/workflows/copilot-setup-steps.yml",
      ".github/prompts",
      ".github/agents",
      ".github/skills",
      ".github/.mcp.json"
    ]
  },
  { id: "kimi", displayName: "Kimi Code", root: ".kimi-code/skills", detectionPaths: [".kimi-code", ".kimi"] },
  { id: "qwen", displayName: "Qwen Code", root: ".qwen/skills", detectionPaths: [".qwen"] },
  { id: "kilocode", displayName: "Kilo Code", root: ".kilocode/skills", detectionPaths: [".kilocode"] }
];

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

function adapter(definition: HarnessDefinition): HarnessAdapter {
  return {
    id: definition.id,
    displayName: definition.displayName,
    aliases: definition.aliases ?? [],
    async detect(projectRoot: string): Promise<DetectionResult> {
      const evidence: string[] = [];
      for (const candidate of definition.detectionPaths) {
        if (await exists(path.join(projectRoot, candidate))) evidence.push(candidate);
      }
      return { detected: evidence.length > 0, evidence };
    },
    getSkillRoot(projectRoot: string): string {
      return path.join(projectRoot, definition.root);
    }
  };
}

export const HARNESS_ADAPTERS: readonly HarnessAdapter[] = DEFINITIONS.map(adapter);

export function harnessById(id: string): HarnessAdapter {
  const found = HARNESS_ADAPTERS.find((candidate) => candidate.id === id || candidate.aliases.includes(id));
  if (!found) {
    throw new MattpackError("UNKNOWN_HARNESS", `Unknown harness: ${id}`, {
      harnesses: HARNESS_ADAPTERS.map((candidate) => candidate.id)
    });
  }
  return found;
}

export function selectHarnesses(ids: readonly string[]): HarnessAdapter[] {
  if (ids.includes("all")) {
    if (ids.length !== 1) throw new MattpackError("INVALID_ARGUMENT", "--harness all cannot be combined with other harnesses");
    return [...HARNESS_ADAPTERS];
  }
  return [...new Map(ids.map((id) => {
    const resolved = harnessById(id);
    return [resolved.id, resolved] as const;
  })).values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function deduplicateTargets(projectRoot: string, harnesses: readonly HarnessAdapter[]): HarnessTarget[] {
  const targets = new Map<string, { absoluteRoot: string; consumers: string[] }>();
  for (const harness of harnesses) {
    const absoluteRoot = path.resolve(harness.getSkillRoot(projectRoot));
    const root = path.relative(projectRoot, absoluteRoot).split(path.sep).join("/");
    const current = targets.get(root) ?? { absoluteRoot, consumers: [] };
    current.consumers.push(harness.id);
    targets.set(root, current);
  }
  return [...targets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([root, target]) => ({
      root,
      absoluteRoot: target.absoluteRoot,
      consumers: [...target.consumers].sort()
    }));
}
