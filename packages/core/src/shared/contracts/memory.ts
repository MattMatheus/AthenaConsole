export interface MemoryRecord {
  id: string;
  sourcePath: string;
  content: string;
  lineStart?: number;
  lineEnd?: number;
  createdAt: string;
}

export interface MemorySearchResult {
  id: string;
  sourcePath: string;
  snippet: string;
  score: number;
  lineStart?: number;
  lineEnd?: number;
  citation?: string;
}
