export interface DetectionResult {
  detected: boolean;
  evidence: readonly string[];
}

export interface HarnessAdapter {
  id: string;
  displayName: string;
  aliases: readonly string[];
  detect(projectRoot: string): Promise<DetectionResult>;
  getSkillRoot(projectRoot: string): string;
  getInvocationHint?(skillName: string): string;
}

export interface HarnessTarget {
  root: string;
  absoluteRoot: string;
  consumers: readonly string[];
}
