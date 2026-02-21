import type { ContextStrategy } from "./base.js";

export interface ContextCompileStats {
  inputChars: number;
  outputChars: number;
  effectiveMaxChars: number;
  overflow: boolean;
}

export interface ContextRecoveryStep {
  kind: "summary" | "tool-result-truncation";
  applied: boolean;
  beforeChars?: number;
  afterChars?: number;
  details?: string;
}

export interface ContextCompactionMetadata {
  initialStrategy: ContextStrategy;
  finalStrategy: ContextStrategy;
  overflowRecovered: boolean;
  overflowAttempts: number;
  initialChars: number;
  finalChars: number;
  effectiveMaxChars: number;
  steps: ContextRecoveryStep[];
}
