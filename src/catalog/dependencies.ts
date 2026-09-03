export interface SkillDependency {
  requires?: readonly string[];
  setupCompanions?: readonly string[];
}

export const SKILL_DEPENDENCIES: Readonly<Record<string, SkillDependency>> = {
  "grill-me": { requires: ["grilling"] },
  "grill-with-docs": { requires: ["grilling", "domain-modeling"] },
  triage: {
    requires: ["grilling", "domain-modeling"],
    setupCompanions: ["setup-matt-pocock-skills"]
  },
  "improve-codebase-architecture": {
    requires: ["codebase-design", "grilling", "domain-modeling"]
  },
  tdd: { requires: ["codebase-design"] },
  wayfinder: {
    requires: ["grilling", "domain-modeling", "prototype", "research"],
    setupCompanions: ["setup-matt-pocock-skills"]
  },
  implement: { requires: ["tdd", "code-review"] },
  "to-spec": { setupCompanions: ["setup-matt-pocock-skills"] },
  "to-tickets": { setupCompanions: ["setup-matt-pocock-skills"] },
  "code-review": { setupCompanions: ["setup-matt-pocock-skills"] },
  "loop-me": { requires: ["grilling"] },
  "writing-fragments": { requires: ["grilling"] },
  "setup-ts-deep-modules": { requires: ["codebase-design"] },
  "implement-spec": { requires: ["code-review"] },
  retro: { requires: ["writing-for-agents"] }
};
