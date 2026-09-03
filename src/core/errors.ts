export type ErrorCode =
  | "INVALID_ARGUMENT"
  | "NON_INTERACTIVE_INPUT_REQUIRED"
  | "UNKNOWN_PRESET"
  | "UNKNOWN_HARNESS"
  | "INVALID_STATE"
  | "PATH_OUTSIDE_PROJECT"
  | "INVALID_UPSTREAM"
  | "MISSING_SKILL"
  | "DEPENDENCY_CYCLE"
  | "CONFLICT"
  | "APPLY_FAILED"
  | "NOT_INITIALIZED";

export class MattpackError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "MattpackError";
  }
}

export function asMattpackError(error: unknown): MattpackError {
  if (error instanceof MattpackError) return error;
  return new MattpackError("APPLY_FAILED", error instanceof Error ? error.message : String(error));
}
