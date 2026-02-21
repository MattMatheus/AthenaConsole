export interface WorkItem {
  id: string;
  sessionId: string;
  payload: string;
  mode: "followup" | "collect";
  dedupeKey?: string;
  createdAt: string;
}

export interface WorkQueueState {
  schemaVersion?: number;
  sessionId: string;
  items: WorkItem[];
  draining: boolean;
  updatedAt: string;
}

export type WorkDedupeMode = "dedupe-key" | "payload" | "none";
export type WorkDropPolicy = "keep-old" | "keep-new";
