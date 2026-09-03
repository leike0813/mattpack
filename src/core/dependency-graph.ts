import type { SkillDependency } from "../catalog/dependencies.js";
import { MattpackError } from "./errors.js";

export type DependencyKind = "requires" | "setupCompanion";

export interface DependencyAddition {
  name: string;
  kind: DependencyKind;
  chain: readonly string[];
}

export interface ResolvedSkills {
  roots: readonly string[];
  dependencies: readonly DependencyAddition[];
  skills: readonly string[];
}

interface Edge {
  name: string;
  kind: DependencyKind;
}

function edges(name: string, graph: Readonly<Record<string, SkillDependency>>): Edge[] {
  const dependency = graph[name];
  return [
    ...(dependency?.requires ?? []).map((child) => ({ name: child, kind: "requires" as const })),
    ...(dependency?.setupCompanions ?? []).map((child) => ({ name: child, kind: "setupCompanion" as const }))
  ].sort((left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name));
}

export function resolveSkillSet(
  selectedRoots: readonly string[],
  availableSkills: ReadonlySet<string>,
  graph: Readonly<Record<string, SkillDependency>>,
  includeDependencies = true
): ResolvedSkills {
  const roots = [...new Set(selectedRoots)].sort();
  for (const root of roots) {
    if (!availableSkills.has(root)) throw new MattpackError("MISSING_SKILL", `Missing root skill: ${root}`);
  }
  if (!includeDependencies) return { roots, dependencies: [], skills: roots };

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];
  function visit(name: string): void {
    if (visiting.has(name)) {
      const start = stack.indexOf(name);
      const cycle = [...stack.slice(start), name];
      throw new MattpackError("DEPENDENCY_CYCLE", `Dependency cycle: ${cycle.join(" -> ")}`, { cycle });
    }
    if (visited.has(name)) return;
    visiting.add(name);
    stack.push(name);
    for (const edge of edges(name, graph)) {
      if (!availableSkills.has(edge.name)) {
        throw new MattpackError("MISSING_SKILL", `Missing dependency: ${edge.name}`, {
          parent: name,
          dependency: edge.name
        });
      }
      visit(edge.name);
    }
    stack.pop();
    visiting.delete(name);
    visited.add(name);
  }
  for (const root of roots) visit(root);

  const discovered = new Set(roots);
  const additions = new Map<string, DependencyAddition>();
  const queue = roots.map((root) => ({ name: root, chain: [root] as readonly string[] }));
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (!current) continue;
    for (const edge of edges(current.name, graph)) {
      if (discovered.has(edge.name)) continue;
      discovered.add(edge.name);
      const chain = [...current.chain, edge.name];
      additions.set(edge.name, { name: edge.name, kind: edge.kind, chain });
      queue.push({ name: edge.name, chain });
    }
  }

  const dependencies = [...additions.values()].sort((left, right) => left.name.localeCompare(right.name));
  return { roots, dependencies, skills: [...discovered].sort() };
}
