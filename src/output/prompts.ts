import { emitKeypressEvents } from "node:readline";

import {
  CANONICAL_PRESETS,
  type CanonicalPreset,
  type PresetDefinition,
  type SkillCatalogEntry
} from "../catalog/presets.js";
import { style } from "./render.js";

export interface HarnessPromptOption {
  id: string;
  displayName: string;
  root: string;
  evidence: readonly string[];
  configured: boolean;
}

export interface HarnessPromptChoice {
  name: string;
  value: string;
  description: string;
  checked: boolean;
}

export function harnessPromptChoices(options: readonly HarnessPromptOption[]): HarnessPromptChoice[] {
  const hasConfigured = options.some((option) => option.configured);
  return [...options]
    .sort((left, right) =>
      Number(right.configured) - Number(left.configured)
      || Number(right.evidence.length > 0) - Number(left.evidence.length > 0)
      || left.displayName.localeCompare(right.displayName)
    )
    .map((option) => ({
      name: `${option.displayName} (${option.id})`,
      value: option.id,
      description: option.evidence.length > 0
        ? `${option.root} · detected: ${option.evidence.join(", ")}`
        : option.root,
      checked: option.configured || (!hasConfigured && option.evidence.length > 0)
    }));
}

export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY && !("CI" in process.env));
}

export function isPromptCancellation(error: unknown): boolean {
  return error instanceof Error && error.name === "ExitPromptError";
}

export interface PresetAndHarnessPromptResult {
  preset: CanonicalPreset;
  additionalSkills: readonly string[];
  harnesses: readonly string[];
}

export type SetupView = "preset" | "skills" | "tools";

export interface SetupState {
  view: SetupView;
  presetIndex: number;
  skillIndex: number;
  harnessIndex: number;
  additionalSkills: readonly string[];
  harnesses: readonly string[];
  errorMessage: string | undefined;
}

interface SetupTransitionContext {
  presetCount: number;
  skills: readonly SkillCatalogEntry[];
  harnesses: readonly HarnessPromptChoice[];
  skillPageSize: number;
  harnessPageSize: number;
}

export interface PageBounds {
  start: number;
  end: number;
  page: number;
  pageCount: number;
}

export function pageBounds(index: number, count: number, pageSize: number): PageBounds {
  const size = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(count / size));
  const page = Math.min(pageCount - 1, Math.max(0, Math.floor(index / size)));
  const start = page * size;
  return { start, end: Math.min(count, start + size), page, pageCount };
}

function clamp(index: number, count: number): number {
  return Math.max(0, Math.min(Math.max(0, count - 1), index));
}

function toggle(values: readonly string[], value: string | undefined): string[] {
  if (!value) return [...values];
  const result = new Set(values);
  if (result.has(value)) result.delete(value);
  else result.add(value);
  return [...result].sort();
}

export function transitionSetup(
  state: SetupState,
  key: string,
  context: SetupTransitionContext
): { state: SetupState; submit: boolean } | undefined {
  const next: SetupState = { ...state, errorMessage: undefined };
  if (key === "up" || key === "down") {
    const delta = key === "up" ? -1 : 1;
    if (state.view === "preset") next.presetIndex = clamp(state.presetIndex + delta, context.presetCount);
    else if (state.view === "skills") next.skillIndex = clamp(state.skillIndex + delta, context.skills.length);
    else next.harnessIndex = clamp(state.harnessIndex + delta, context.harnesses.length);
    return { state: next, submit: false };
  }
  if ((key === "pageup" || key === "pagedown") && state.view !== "preset") {
    const pageSize = state.view === "skills" ? context.skillPageSize : context.harnessPageSize;
    const count = state.view === "skills" ? context.skills.length : context.harnesses.length;
    const delta = key === "pageup" ? -pageSize : pageSize;
    if (state.view === "skills") next.skillIndex = clamp(state.skillIndex + delta, count);
    else next.harnessIndex = clamp(state.harnessIndex + delta, count);
    return { state: next, submit: false };
  }
  if (key === "s" && state.view === "preset") {
    next.view = "skills";
    return { state: next, submit: false };
  }
  if (key === "left" || (key === "escape" && state.view === "skills")) {
    if (state.view === "preset") return undefined;
    next.view = "preset";
    return { state: next, submit: false };
  }
  if ((key === "right" || key === "tab") && state.view === "preset") {
    next.view = "tools";
    return { state: next, submit: false };
  }
  if (key === "space") {
    if (state.view === "skills") {
      next.additionalSkills = toggle(state.additionalSkills, context.skills[state.skillIndex]?.name);
      return { state: next, submit: false };
    }
    if (state.view === "tools") {
      next.harnesses = toggle(state.harnesses, context.harnesses[state.harnessIndex]?.value);
      return { state: next, submit: false };
    }
    return undefined;
  }
  if (key !== "return" && key !== "enter") return undefined;
  if (state.view === "preset") {
    next.view = "tools";
    return { state: next, submit: false };
  }
  if (state.view === "skills") {
    next.view = "preset";
    return { state: next, submit: false };
  }
  if (state.harnesses.length === 0) {
    next.errorMessage = "Select at least one tool.";
    return { state: next, submit: false };
  }
  return { state: next, submit: true };
}

function exitPromptError(): Error {
  const error = new Error("User cancelled the prompt");
  error.name = "ExitPromptError";
  return error;
}

function truncate(value: string, width: number): string {
  if (width <= 0) return "";
  return value.length <= width ? value : `${value.slice(0, Math.max(0, width - 1))}…`;
}

function wrap(value: string, width: number): string[] {
  const limit = Math.max(1, width);
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(/\s+/u)) {
    if (!word) continue;
    if (word.length > limit) {
      if (line) lines.push(line);
      for (let offset = 0; offset < word.length; offset += limit) lines.push(word.slice(offset, offset + limit));
      line = "";
    } else if (!line) line = word;
    else if (line.length + word.length + 1 <= limit) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

const RELATION_LABELS: Readonly<Record<CanonicalPreset, string>> = {
  default: "default",
  general: "general",
  full: "full",
  "beta-only": "beta",
  everything: "everything"
};

function matrixHeader(current: CanonicalPreset): string {
  return CANONICAL_PRESETS.map((preset) => {
    const label = RELATION_LABELS[preset].padEnd(RELATION_LABELS[preset].length + 1);
    return preset === current ? style(36, label) : label;
  }).join("");
}

function matrixRow(skill: SkillCatalogEntry, current: CanonicalPreset): string {
  return skill.relations.map(({ preset, relation }) => {
    const symbol = relation === "root" ? "R" : relation === "dependency" ? "D" : "·";
    const cell = symbol.padEnd(RELATION_LABELS[preset].length + 1);
    return preset === current ? style(36, cell) : cell;
  }).join("");
}

function relationDetail(skill: SkillCatalogEntry, current: CanonicalPreset, width: number): string[] {
  const value = skill.relations.map(({ preset, relation }) => {
    const symbol = relation === "root" ? "R" : relation === "dependency" ? "D" : "·";
    const cell = `${RELATION_LABELS[preset]}:${symbol}`;
    return preset === current ? `[${cell}]` : cell;
  }).join(" ");
  return wrap(value, width);
}

interface PromptLayout {
  width: number;
  narrowPreset: boolean;
  narrowSkills: boolean;
  narrowTools: boolean;
  presetNameWidth: number;
  skillNameWidth: number;
  harnessNameWidth: number;
  skillDetail: readonly string[];
  harnessDetail: readonly string[];
  skillPageSize: number;
  harnessPageSize: number;
}

function promptLayout(
  state: SetupState,
  presets: readonly PresetDefinition[],
  skills: readonly SkillCatalogEntry[],
  harnessChoices: readonly HarnessPromptChoice[],
  currentPreset: CanonicalPreset
): PromptLayout {
  const width = Math.max(10, process.stdout.columns ?? 80);
  const rows = Math.max(10, process.stdout.rows ?? 24);
  const presetNameWidth = Math.max(0, ...presets.map((preset) => preset.name.length)) + 3;
  const skillNameWidth = Math.max(0, ...skills.map((skill) => skill.name.length)) + 3;
  const harnessNameWidth = Math.max(0, ...harnessChoices.map((choice) => choice.name.length)) + 3;
  const narrowPreset = width < 2 + presetNameWidth + Math.max(0, ...presets.map((preset) => preset.purpose.length));
  const matrixWidth = CANONICAL_PRESETS.reduce((sum, preset) => sum + RELATION_LABELS[preset].length + 1, 0);
  const narrowSkills = width < 4 + skillNameWidth + matrixWidth + 20;
  const narrowTools = width < 4 + harnessNameWidth + Math.max(0, ...harnessChoices.map((choice) => choice.description.length));
  const skill = skills[state.skillIndex];
  const harness = harnessChoices[state.harnessIndex];
  const skillDetail = narrowSkills && skill
    ? [...wrap(skill.description, width - 2), ...relationDetail(skill, currentPreset, width - 2)]
    : [];
  const harnessDetail = narrowTools && harness ? wrap(harness.description, width - 2) : [];
  return {
    width,
    narrowPreset,
    narrowSkills,
    narrowTools,
    presetNameWidth,
    skillNameWidth,
    harnessNameWidth,
    skillDetail,
    harnessDetail,
    skillPageSize: Math.max(1, rows - 11 - skillDetail.length),
    harnessPageSize: Math.max(1, rows - 10 - harnessDetail.length)
  };
}

function renderSetupPrompt(
  state: SetupState,
  presets: readonly PresetDefinition[],
  skills: readonly SkillCatalogEntry[],
  harnessChoices: readonly HarnessPromptChoice[]
): { lines: number; skillPageSize: number; harnessPageSize: number } {
  const selectedPreset = presets[state.presetIndex];
  if (!selectedPreset) throw new Error("No presets available");
  const layout = promptLayout(state, presets, skills, harnessChoices, selectedPreset.name);
  const selectedSkills = new Set(state.additionalSkills);
  const selectedHarnesses = new Set(state.harnesses);
  const skillPage = pageBounds(state.skillIndex, skills.length, layout.skillPageSize);
  const harnessPage = pageBounds(state.harnessIndex, harnessChoices.length, layout.harnessPageSize);
  const steps = state.view === "tools"
    ? `${style(2, "1 Preset")} → ${style(36, "[2 Tools]")}`
    : state.view === "skills"
      ? `${style(36, "[1 Preset / Skills]")} → ${style(2, "2 Tools")}`
      : `${style(36, "[1 Preset]")} → ${style(2, "2 Tools")}`;
  const choices = state.view === "preset"
    ? presets.map((preset, index) => {
      const active = index === state.presetIndex;
      const cursor = active ? style(36, "❯") : " ";
      const visibleName = truncate(preset.name, layout.width - 2);
      const name = active ? style(33, visibleName) : visibleName;
      if (layout.narrowPreset) return `${cursor} ${name}`;
      const paddedName = `${name}${" ".repeat(layout.presetNameWidth - preset.name.length)}`;
      const description = active ? style(36, preset.purpose) : preset.purpose;
      return `${cursor} ${paddedName}${description}`;
    })
    : state.view === "skills"
      ? skills.slice(skillPage.start, skillPage.end).map((skill, offset) => {
        const index = skillPage.start + offset;
        const active = index === state.skillIndex;
        const cursor = active ? style(36, "❯") : " ";
        const checkbox = selectedSkills.has(skill.name) ? style(32, "◉") : "◯";
        const visibleName = truncate(skill.name, layout.width - 4);
        const name = active ? style(33, visibleName) : visibleName;
        if (layout.narrowSkills) return `${cursor} ${checkbox} ${name}`;
        const paddedName = `${name}${" ".repeat(layout.skillNameWidth - skill.name.length)}`;
        const matrix = matrixRow(skill, selectedPreset.name);
        const remaining = layout.width - 4 - layout.skillNameWidth
          - CANONICAL_PRESETS.reduce((sum, preset) => sum + RELATION_LABELS[preset].length + 1, 0);
        return `${cursor} ${checkbox} ${paddedName}${matrix}${truncate(skill.description, remaining)}`;
      })
      : harnessChoices.slice(harnessPage.start, harnessPage.end).map((choice, offset) => {
      const index = harnessPage.start + offset;
      const active = index === state.harnessIndex;
      const cursor = active ? style(36, "❯") : " ";
      const checkbox = selectedHarnesses.has(choice.value) ? style(32, "◉") : "◯";
      const visibleName = truncate(choice.name, layout.width - 4);
      const name = active ? style(33, visibleName) : visibleName;
      if (layout.narrowTools) return `${cursor} ${checkbox} ${name}`;
      const paddedName = `${name}${" ".repeat(layout.harnessNameWidth - choice.name.length)}`;
      const description = active ? style(36, choice.description) : choice.description;
      return `${cursor} ${checkbox} ${paddedName}${description}`;
    });
  const instructions = state.view === "preset"
    ? layout.narrowPreset ? "↑↓ move · S skills · Enter next" : "↑↓ navigate · S skills · → next · Enter continue"
    : state.view === "skills"
      ? layout.narrowSkills ? "↑↓ move · Space toggle · Esc back" : "↑↓ navigate · PgUp/PgDn page · Space toggle · ←/Esc/Enter back"
      : layout.narrowTools ? "↑↓ move · Space toggle · ← back" : "↑↓ navigate · PgUp/PgDn page · Space toggle · ← back · Enter submit";
  const title = state.view === "preset"
    ? "Select a preset"
    : state.view === "skills"
      ? `Select additional skills (${state.additionalSkills.length} selected, page ${skillPage.page + 1}/${skillPage.pageCount})`
      : `Select agent tools (page ${harnessPage.page + 1}/${harnessPage.pageCount})`;
  const lines = [
    "",
    `${style(34, "?")} ${style(1, "Mattpack setup")}`,
    steps,
    "",
    style(1, truncate(title, layout.width)),
    ...(state.view === "skills" && !layout.narrowSkills
      ? [`  ${" ".repeat(layout.skillNameWidth)}${matrixHeader(selectedPreset.name)}description`, "  R=root · D=dependency · ·=not included"]
      : []),
    ...choices,
    ...(state.view === "preset" && layout.narrowPreset ? ["", style(36, selectedPreset.purpose)] : []),
    ...(state.view === "skills" && layout.skillDetail.length > 0
      ? ["", ...layout.skillDetail.map((line) => style(36, line))]
      : []),
    ...(state.view === "tools" && layout.harnessDetail.length > 0
      ? ["", ...layout.harnessDetail.map((line) => style(36, line))]
      : []),
    ...(state.errorMessage ? ["", style(31, `> ${state.errorMessage}`)] : []),
    "",
    style(2, truncate(instructions, layout.width))
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  return { lines: lines.length, skillPageSize: layout.skillPageSize, harnessPageSize: layout.harnessPageSize };
}

export async function selectPresetAndHarnesses(
  presets: readonly PresetDefinition[],
  initial: CanonicalPreset,
  options: readonly HarnessPromptOption[],
  skills: readonly SkillCatalogEntry[],
  initialAdditionalSkills: readonly string[] = [],
  startAtTools = false
): Promise<PresetAndHarnessPromptResult> {
  const harnessChoices = harnessPromptChoices(options);
  let state: SetupState = {
    view: startAtTools ? "tools" : "preset",
    presetIndex: Math.max(0, presets.findIndex((preset) => preset.name === initial)),
    skillIndex: 0,
    harnessIndex: 0,
    additionalSkills: [...new Set(initialAdditionalSkills)].sort(),
    harnesses: harnessChoices.filter((choice) => choice.checked).map((choice) => choice.value).sort(),
    errorMessage: undefined
  };

  emitKeypressEvents(process.stdin);

  return new Promise((resolve, reject) => {
    let renderedLines = 0;
    let skillPageSize = 1;
    let harnessPageSize = 1;
    const cleanup = () => {
      process.stdin.off("keypress", onKeypress);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    const render = (initial = false): void => {
      if (!initial && renderedLines > 0) process.stdout.write(`\x1b[${renderedLines}A\x1b[0J`);
      const rendered = renderSetupPrompt(state, presets, skills, harnessChoices);
      renderedLines = rendered.lines;
      skillPageSize = rendered.skillPageSize;
      harnessPageSize = rendered.harnessPageSize;
    };
    const onKeypress = (_input: string, key: { name?: string; ctrl?: boolean }) => {
      if ((key.ctrl && key.name === "c") || (key.name === "escape" && state.view !== "skills")) {
        cleanup();
        reject(exitPromptError());
        return;
      }
      const transition = transitionSetup(state, key.name ?? "", {
        presetCount: presets.length,
        skills,
        harnesses: harnessChoices,
        skillPageSize,
        harnessPageSize
      });
      if (!transition) return;
      state = transition.state;
      if (!transition.submit) {
        render();
        return;
      }
      const selectedPreset = presets[state.presetIndex];
      if (!selectedPreset) {
        cleanup();
        reject(new Error("No presets available"));
        return;
      }
      cleanup();
      process.stdout.write("\n");
      resolve({
        preset: selectedPreset.name,
        additionalSkills: state.additionalSkills,
        harnesses: state.harnesses
      });
    };

    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("keypress", onKeypress);
    render(true);
  });
}

export async function confirmPlan(message: string): Promise<boolean> {
  const { default: confirm } = await import("@inquirer/confirm");
  return confirm({ message, default: true });
}
