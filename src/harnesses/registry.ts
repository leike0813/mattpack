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
  { id: "amp", displayName: "Amp", root: ".agents/skills", detectionPaths: [".agents/skills"] },
  { id: "antigravity", displayName: "Antigravity", root: ".agents/skills", detectionPaths: [".agent", ".agents/workflows"] },
  { id: "autohand", displayName: "AutoHand", root: ".autohand/skills", detectionPaths: [".autohand"] },
  { id: "auggie", displayName: "Auggie (Augment CLI)", root: ".augment/skills", detectionPaths: [".augment"] },
  { id: "bob", displayName: "Bob Shell", root: ".bob/skills", detectionPaths: [".bob"] },
  { id: "claude", displayName: "Claude Code", root: ".claude/skills", detectionPaths: [".claude"] },
  { id: "cline", displayName: "Cline", root: ".cline/skills", detectionPaths: [".cline"] },
  { id: "codebuff", displayName: "Codebuff", root: ".agents/skills", detectionPaths: [".agents/skills"] },
  { id: "codeartsagent", displayName: "CodeArts", root: ".codeartsdoer/skills", detectionPaths: [".codeartsdoer"] },
  { id: "codebuddy", displayName: "CodeBuddy Code (CLI)", root: ".codebuddy/skills", detectionPaths: [".codebuddy"] },
  { id: "codex", displayName: "Codex", root: ".agents/skills", detectionPaths: [".agents/skills", ".codex/skills"] },
  { id: "command-code", displayName: "Command Code", root: ".commandcode/skills", detectionPaths: [".commandcode"] },
  { id: "continue", displayName: "Continue", root: ".continue/skills", detectionPaths: [".continue"] },
  { id: "costrict", displayName: "CoStrict", root: ".costrict/skills", detectionPaths: [".costrict"] },
  { id: "crush", displayName: "Crush", root: ".crush/skills", detectionPaths: [".crush"] },
  { id: "cursor", displayName: "Cursor", root: ".cursor/skills", detectionPaths: [".cursor"] },
  { id: "deep-agents", displayName: "Deep Agents", root: ".deepagents/skills", detectionPaths: [".deepagents"] },
  { id: "deepseek-harness", displayName: "DeepSeek Harness", root: ".dsh/skills", detectionPaths: [".dsh"] },
  { id: "devin", displayName: "Devin Desktop (formerly Windsurf)", root: ".devin/skills", detectionPaths: [".devin", ".windsurf"] },
  { id: "factory", displayName: "Factory Droid", root: ".factory/skills", detectionPaths: [".factory"] },
  { id: "forgecode", displayName: "ForgeCode", root: ".forge/skills", detectionPaths: [".forge"] },
  { id: "gemini", displayName: "Gemini CLI", root: ".gemini/skills", detectionPaths: [".gemini"] },
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
  { id: "goose", displayName: "Goose", root: ".goose/skills", detectionPaths: [".goose"] },
  { id: "grok", displayName: "Grok", root: ".grok/skills", detectionPaths: [".grok"] },
  { id: "hermes", displayName: "Hermes Agent", root: ".hermes/skills", detectionPaths: [".hermes", "HERMES.md", ".hermes.md"] },
  { id: "iflow", displayName: "iFlow", root: ".iflow/skills", detectionPaths: [".iflow"] },
  { id: "junie", displayName: "Junie", root: ".junie/skills", detectionPaths: [".junie"] },
  { id: "kilocode", displayName: "Kilo Code", root: ".kilo/skills", detectionPaths: [".kilo", ".kilocode"] },
  { id: "kimi", displayName: "Kimi Code", root: ".kimi-code/skills", detectionPaths: [".kimi-code", ".kimi"] },
  { id: "kiro", displayName: "Kiro", root: ".kiro/skills", detectionPaths: [".kiro"] },
  { id: "lingma", displayName: "Lingma", root: ".lingma/skills", detectionPaths: [".lingma"] },
  { id: "minimax-code", displayName: "MiniMax Code", root: ".minimax/skills", detectionPaths: [".minimax"] },
  { id: "openhands", displayName: "OpenHands", root: ".openhands/skills", detectionPaths: [".openhands"] },
  { id: "oh-my-pi", displayName: "Oh My Pi", root: ".omp/skills", detectionPaths: [".omp"] },
  { id: "opencode", displayName: "OpenCode", root: ".opencode/skills", detectionPaths: [".opencode"] },
  { id: "pi", displayName: "Pi", root: ".pi/skills", detectionPaths: [".pi"] },
  { id: "prime-agent", displayName: "Prime Agent", root: ".prime/agent/skills", detectionPaths: [".prime"] },
  { id: "qoder", displayName: "Qoder", root: ".qoder/skills", detectionPaths: [".qoder"] },
  { id: "qwen", displayName: "Qwen Code", root: ".qwen/skills", detectionPaths: [".qwen"] },
  { id: "replit-agent", displayName: "Replit Agent", root: ".agents/skills", detectionPaths: [".agents/skills"] },
  { id: "roocode", displayName: "Roo Code", root: ".roo/skills", detectionPaths: [".roo"] },
  { id: "rovodev", displayName: "Rovo Dev CLI", root: ".rovodev/skills", detectionPaths: [".rovodev/skills", ".rovodev"] },
  { id: "sourcecraft-code-assistant", displayName: "SourceCraft Code Assistant", root: ".codeassistant/skills", detectionPaths: [".codeassistant"] },
  { id: "trae", displayName: "Trae", root: ".trae/skills", detectionPaths: [".trae"] },
  { id: "vibe", displayName: "Mistral Vibe", root: ".vibe/skills", detectionPaths: [".vibe"] },
  { id: "warp", displayName: "Warp", root: ".agents/skills", detectionPaths: [".agents/skills", "WARP.md"] },
  { id: "zcode", displayName: "ZCode", root: ".zcode/skills", detectionPaths: [".zcode"] },
  { id: "zed", displayName: "Zed Agent", root: ".agents/skills", detectionPaths: [".zed", ".agents/skills"] },
  { id: "zoo-code", displayName: "Zoo Code", root: ".roo/skills", detectionPaths: [".roo"] }
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
    throw new MattpackError("UNKNOWN_TOOL", `Unknown tool: ${id}`, {
      tools: HARNESS_ADAPTERS.map((candidate) => candidate.id)
    });
  }
  return found;
}

export function selectHarnesses(ids: readonly string[]): HarnessAdapter[] {
  if (ids.includes("all")) {
    if (ids.length !== 1) throw new MattpackError("INVALID_ARGUMENT", "--tools all cannot be combined with other tools");
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
