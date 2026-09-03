import type { CanonicalPreset, PresetDefinition } from "../catalog/presets.js";

export interface HarnessPromptOption {
  id: string;
  displayName: string;
  root: string;
  evidence: readonly string[];
  configured: boolean;
}

export function harnessPromptChoices(options: readonly HarnessPromptOption[]) {
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

export async function selectPreset(
  presets: readonly PresetDefinition[],
  initial: CanonicalPreset
): Promise<CanonicalPreset> {
  const { default: select } = await import("@inquirer/select");
  return select({
    message: "Select a preset",
    choices: presets.map((preset) => ({
      name: preset.name,
      value: preset.name,
      description: preset.purpose
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
  return confirm({ message, default: false });
}
