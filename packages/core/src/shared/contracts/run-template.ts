export interface RunTemplate {
  id: string;
  harnessProfileId: string;
  directiveTemplate: string;
  defaultParams: Record<string, string>;
  createdAt: string;
}

export interface RunTemplateCreateRequest {
  harnessProfileId: string;
  directiveTemplate: string;
  defaultParams: Record<string, string>;
}

export interface RunTemplateListQuery {
  cursor?: string;
  limit?: number;
}

export interface RunTemplateListResult {
  items: RunTemplate[];
  nextCursor?: string;
}

export interface TemplateRunRequest {
  sessionId?: string;
  params?: Record<string, string>;
}
