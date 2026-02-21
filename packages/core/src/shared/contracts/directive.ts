export interface Directive {
  id: string;
  input: string;
  contextRefs?: string[];
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface DirectiveCreateRequest {
  input: string;
  contextRefs?: string[];
  metadata?: Record<string, string>;
}

export interface DirectiveListQuery {
  cursor?: string;
  limit?: number;
}

export interface DirectiveListResult {
  items: Directive[];
  nextCursor?: string;
}
