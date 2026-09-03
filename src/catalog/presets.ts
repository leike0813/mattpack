import { MattpackError } from "../core/errors.js";
import type { UpstreamCatalog } from "./upstream.js";

export const CANONICAL_PRESETS = ["default", "general", "full", "beta-only", "everything"] as const;
export type CanonicalPreset = (typeof CANONICAL_PRESETS)[number];
export type PresetRelation = "root" | "dependency" | "none";

export interface SkillCatalogEntry {
  name: string;
  description: string;
  relations: readonly { preset: CanonicalPreset; relation: PresetRelation }[];
}

export interface PresetDefinition {
  name: CanonicalPreset;
  aliases: readonly string[];
  purpose: string;
}

const DEFAULT_ROOTS = [
  "setup-matt-pocock-skills",
  "grill-with-docs",
  "to-spec",
  "to-tickets",
  "prototype",
  "diagnosing-bugs",
  "tdd",
  "improve-codebase-architecture",
  "code-review",
  "resolving-merge-conflicts",
  "handoff",
  "wait-what",
  "writing-for-agents"
] as const;

const GENERAL_ROOTS = [
  "grill-me",
  "handoff",
  "to-questionnaire",
  "wait-what",
  "writing-for-agents"
] as const;

export const PRESETS: Readonly<Record<CanonicalPreset, PresetDefinition>> = {
  default: {
    name: "default",
    aliases: ["developing", "dev"],
    purpose: "Curated day-to-day software development"
  },
  general: {
    name: "general",
    aliases: [],
    purpose: "Lightweight general planning and agent workflow support"
  },
  full: {
    name: "full",
    aliases: [],
    purpose: "All promoted stable skills"
  },
  "beta-only": {
    name: "beta-only",
    aliases: ["in-progress"],
    purpose: "All beta roots plus required stable dependencies"
  },
  everything: {
    name: "everything",
    aliases: ["beta", "experimental"],
    purpose: "All promoted, in-progress, and misc skills"
  }
};

export function canonicalPreset(input: string): CanonicalPreset {
  for (const preset of CANONICAL_PRESETS) {
    if (input === preset || PRESETS[preset].aliases.includes(input)) return preset;
  }
  throw new MattpackError("UNKNOWN_PRESET", `Unknown preset: ${input}`, {
    presets: CANONICAL_PRESETS
  });
}

export function presetRoots(preset: CanonicalPreset, catalog: UpstreamCatalog): string[] {
  switch (preset) {
    case "default":
      return [...DEFAULT_ROOTS].sort();
    case "general":
      return [...GENERAL_ROOTS].sort();
    case "full":
      return [...catalog.byBucket.engineering, ...catalog.byBucket.productivity].sort();
    case "beta-only":
      return [...catalog.byBucket["in-progress"]].sort();
    case "everything":
      return [...catalog.skills.keys()].sort();
  }
}
