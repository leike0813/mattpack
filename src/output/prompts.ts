import { emitKeypressEvents } from "node:readline";

import type { CanonicalPreset, PresetDefinition } from "../catalog/presets.js";
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
  harnesses: readonly string[];
}

function exitPromptError(): Error {
  const error = new Error("User cancelled the prompt");
  error.name = "ExitPromptError";
  return error;
}

function renderSetupPrompt(
  step: 0 | 1,
  presets: readonly PresetDefinition[],
  presetIndex: number,
  harnessChoices: readonly HarnessPromptChoice[],
  harnessIndex: number,
  selectedHarnesses: ReadonlySet<string>,
  errorMessage: string | undefined
): number {
  const steps = step === 0
    ? `${style(36, "[1 Preset]")} → ${style(2, "2 Harnesses")}`
    : `${style(2, "1 Preset")} → ${style(36, "[2 Harnesses]")}`;
  const terminalWidth = process.stdout.columns ?? 80;
  const presetColumnWidth = Math.max(0, ...presets.map((preset) => preset.name.length)) + 3;
  const presetDescriptionWidth = Math.max(0, ...presets.map((preset) => preset.purpose.length));
  const narrowPresetLayout = terminalWidth < 2 + presetColumnWidth + presetDescriptionWidth;
  const harnessColumnWidth = Math.max(0, ...harnessChoices.map((choice) => choice.name.length)) + 3;
  const harnessDescriptionWidth = Math.max(0, ...harnessChoices.map((choice) => choice.description.length));
  const narrowHarnessLayout = terminalWidth < 4 + harnessColumnWidth + harnessDescriptionWidth;
  const selectedPreset = presets[presetIndex];
  const selectedHarness = harnessChoices[harnessIndex];
  const choices = step === 0
    ? presets.map((preset, index) => {
      const active = index === presetIndex;
      const cursor = active ? style(36, "❯") : " ";
      const name = active ? style(33, preset.name) : preset.name;
      if (narrowPresetLayout) return `${cursor} ${name}`;
      const paddedName = `${name}${" ".repeat(presetColumnWidth - preset.name.length)}`;
      const description = active ? style(36, preset.purpose) : preset.purpose;
      return `${cursor} ${paddedName}${description}`;
    })
    : harnessChoices.map((choice, index) => {
      const active = index === harnessIndex;
      const cursor = active ? style(36, "❯") : " ";
      const checkbox = selectedHarnesses.has(choice.value) ? style(32, "◉") : "◯";
      const name = active ? style(33, choice.name) : choice.name;
      if (narrowHarnessLayout) return `${cursor} ${checkbox} ${name}`;
      const paddedName = `${name}${" ".repeat(harnessColumnWidth - choice.name.length)}`;
      const description = active ? style(36, choice.description) : choice.description;
      return `${cursor} ${checkbox} ${paddedName}${description}`;
    });
  const instructions = step === 0
    ? "↑↓ navigate · → next · Enter continue"
    : "↑↓ navigate · Space toggle · ← back · Enter submit";
  const lines = [
    "",
    `${style(34, "?")} ${style(1, "Mattpack setup")}`,
    steps,
    "",
    style(1, step === 0 ? "Select a preset" : "Select agent harnesses"),
    ...choices,
    ...(step === 0 && narrowPresetLayout && selectedPreset ? ["", style(36, selectedPreset.purpose)] : []),
    ...(step === 1 && narrowHarnessLayout && selectedHarness ? ["", style(36, selectedHarness.description)] : []),
    ...(errorMessage ? ["", style(31, `> ${errorMessage}`)] : []),
    "",
    style(2, instructions)
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  return lines.length;
}

export async function selectPresetAndHarnesses(
  presets: readonly PresetDefinition[],
  initial: CanonicalPreset,
  options: readonly HarnessPromptOption[]
): Promise<PresetAndHarnessPromptResult> {
  const harnessChoices = harnessPromptChoices(options);
  const selectedHarnesses = new Set(
    harnessChoices.filter((choice) => choice.checked).map((choice) => choice.value)
  );
  let step: 0 | 1 = 0;
  let presetIndex = Math.max(0, presets.findIndex((preset) => preset.name === initial));
  let harnessIndex = 0;
  let errorMessage: string | undefined;

  emitKeypressEvents(process.stdin);

  return new Promise((resolve, reject) => {
    let renderedLines = 0;
    const cleanup = () => {
      process.stdin.off("keypress", onKeypress);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    const render = (initial = false): void => {
      if (!initial && renderedLines > 0) process.stdout.write(`\x1b[${renderedLines}A\x1b[0J`);
      renderedLines = renderSetupPrompt(
        step,
        presets,
        presetIndex,
        harnessChoices,
        harnessIndex,
        selectedHarnesses,
        errorMessage
      );
    };
    const onKeypress = (_input: string, key: { name?: string; ctrl?: boolean }) => {
      if ((key.ctrl && key.name === "c") || key.name === "escape") {
        cleanup();
        reject(exitPromptError());
        return;
      }
      if (key.name === "up" || key.name === "down") {
        const delta = key.name === "up" ? -1 : 1;
        if (step === 0) {
          presetIndex = Math.max(0, Math.min(presets.length - 1, presetIndex + delta));
        } else {
          harnessIndex = Math.max(0, Math.min(harnessChoices.length - 1, harnessIndex + delta));
        }
        errorMessage = undefined;
        render();
        return;
      }
      if (key.name === "left" && step === 1) {
        step = 0;
        errorMessage = undefined;
        render();
        return;
      }
      if ((key.name === "right" || key.name === "tab") && step === 0) {
        step = 1;
        errorMessage = undefined;
        render();
        return;
      }
      if (step === 1 && key.name === "space") {
        const choice = harnessChoices[harnessIndex];
        if (choice) {
          if (selectedHarnesses.has(choice.value)) selectedHarnesses.delete(choice.value);
          else selectedHarnesses.add(choice.value);
        }
        errorMessage = undefined;
        render();
        return;
      }
      if (key.name !== "return" && key.name !== "enter") return;
      if (step === 0) {
        step = 1;
        errorMessage = undefined;
        render();
        return;
      }
      if (selectedHarnesses.size === 0) {
        errorMessage = "Select at least one harness.";
        render();
        return;
      }
      const selectedPreset = presets[presetIndex];
      if (!selectedPreset) {
        cleanup();
        reject(new Error("No presets available"));
        return;
      }
      cleanup();
      process.stdout.write("\n");
      resolve({
        preset: selectedPreset.name,
        harnesses: harnessChoices
          .filter((choice) => selectedHarnesses.has(choice.value))
          .map((choice) => choice.value)
      });
    };

    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("keypress", onKeypress);
    render(true);
  });
}

export async function selectPreset(
  presets: readonly PresetDefinition[],
  initial: CanonicalPreset
): Promise<CanonicalPreset> {
  const { default: select } = await import("@inquirer/select");
  return select({
    message: "Select a preset",
    choices: presets.map((preset) => ({
      name: `${preset.name} — ${preset.purpose}`,
      value: preset.name,
      short: preset.name
    })),
    default: initial,
    loop: false
  });
}

export async function selectHarnesses(options: readonly HarnessPromptOption[]): Promise<readonly string[]> {
  const { default: checkbox } = await import("@inquirer/checkbox");
  return checkbox({
    message: "Select agent harnesses",
    choices: harnessPromptChoices(options),
    pageSize: 13,
    loop: false,
    required: true
  });
}

export async function confirmPlan(message: string): Promise<boolean> {
  const { default: confirm } = await import("@inquirer/confirm");
  return confirm({ message, default: true });
}
