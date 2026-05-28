export type RunTemplate = {
  id: string;
  harnessProfileId: string;
  directiveTemplate: string;
  defaultParams: Record<string, string>;
  createdAt: string;
};

export type RunTemplateListResult = {
  items: RunTemplate[];
  nextCursor?: string;
};

export type RunTemplateCreateRequest = {
  harnessProfileId: string;
  directiveTemplate: string;
  defaultParams: Record<string, string>;
};

export type TemplateRunRequest = {
  sessionId?: string;
  params?: Record<string, string>;
};

export type RunTemplateResult = {
  sessionId: string;
  output: string;
  model: string;
  provider: string;
  runId?: string;
  directiveId?: string;
  harnessProfileId?: string;
  createdAt: string;
  template?: {
    id: string;
    harnessProfileId: string;
    effectiveParams: Record<string, string>;
  };
};

export type HarnessProfile = {
  id: string;
  displayName: string;
  version: "v1" | "v2";
  config: {
    provider: string;
    model: string;
    tools: string[];
  };
  createdAt: string;
};

export type HarnessProfileListResult = {
  items: HarnessProfile[];
  nextCursor?: string;
};
