import type { ContextCompileStats, ContextStrategy, TranscriptEntry } from "../shared/contracts.js";

export interface ContextCompileRequest {
  strategy: ContextStrategy;
  messages: ContextMessage[];
  maxChars: number;
  reserveChars: number;
  summaryMaxChars: number;
}

export interface ContextCompileResult {
  strategy: ContextStrategy;
  content: string;
  stats: ContextCompileStats;
  notes?: string;
}

export interface ContextMessage {
  role: TranscriptEntry["role"];
  content: string;
  kind?: TranscriptEntry["kind"];
  toolCallId?: string;
  toolName?: string;
}

const SUMMARY_HEADER = "system: Prior conversation summary";
const TOOL_TRUNCATION_SUFFIX =
  "\n\n[tool result truncated to fit context budget; request narrower output for full details]";

export function estimateContextChars(messages: ContextMessage[]): number {
  return serializeMessages(messages).length;
}

export function compileContext(request: ContextCompileRequest): ContextCompileResult {
  const effectiveMaxChars = resolveEffectiveMaxChars(request.maxChars, request.reserveChars);
  const inputChars = estimateContextChars(request.messages);

  if (request.strategy === "distill") {
    const content = serializeMessages(request.messages);
    return {
      strategy: request.strategy,
      content,
      stats: {
        inputChars,
        outputChars: content.length,
        effectiveMaxChars,
        overflow: content.length > effectiveMaxChars
      },
      notes:
        "Distill placeholder: strategy hook is wired but not implemented yet. Using raw assembly until distill implementation lands."
    };
  }

  if (request.strategy === "summary") {
    const summaryContent = compileSummaryContent(request.messages, effectiveMaxChars, request.summaryMaxChars);
    return {
      strategy: request.strategy,
      content: summaryContent,
      stats: {
        inputChars,
        outputChars: summaryContent.length,
        effectiveMaxChars,
        overflow: summaryContent.length > effectiveMaxChars
      }
    };
  }

  const content = serializeMessages(request.messages);
  return {
    strategy: request.strategy,
    content,
    stats: {
      inputChars,
      outputChars: content.length,
      effectiveMaxChars,
      overflow: content.length > effectiveMaxChars
    }
  };
}

export function truncateOversizedToolResults(
  messages: ContextMessage[],
  maxToolResultChars: number
): { messages: ContextMessage[]; truncatedCount: number } {
  if (maxToolResultChars <= TOOL_TRUNCATION_SUFFIX.length) {
    return { messages, truncatedCount: 0 };
  }

  let truncatedCount = 0;
  const nextMessages = messages.map((message) => {
    const isToolResult = message.role === "tool" || message.kind === "tool-result";
    if (!isToolResult || message.content.length <= maxToolResultChars) {
      return message;
    }

    truncatedCount += 1;
    const budget = Math.max(64, maxToolResultChars - TOOL_TRUNCATION_SUFFIX.length);
    return {
      ...message,
      content: `${message.content.slice(0, budget)}${TOOL_TRUNCATION_SUFFIX}`
    };
  });

  return { messages: nextMessages, truncatedCount };
}

function serializeMessages(messages: ContextMessage[]): string {
  return messages.map((message) => `${message.role}: ${message.content}`).join("\n\n");
}

function compileSummaryContent(messages: ContextMessage[], effectiveMaxChars: number, summaryMaxChars: number): string {
  const raw = serializeMessages(messages);
  if (raw.length <= effectiveMaxChars) {
    return raw;
  }

  const tailBudget = Math.max(256, Math.floor(effectiveMaxChars * 0.55));
  const tailMessages: ContextMessage[] = [];
  const minTailMessages = Math.min(2, messages.length);
  const mandatoryTailCount = Math.max(1, minTailMessages);
  let tailChars = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (!candidate) {
      continue;
    }
    const rendered = `${candidate.role}: ${candidate.content}`;
    const nextTailChars = tailChars + rendered.length + (tailMessages.length > 0 ? 2 : 0);
    if (nextTailChars > tailBudget && tailMessages.length >= minTailMessages) {
      break;
    }
    tailMessages.unshift(candidate);
    tailChars = nextTailChars;
  }

  const headMessages = messages.slice(0, Math.max(0, messages.length - tailMessages.length));
  const summaryBudget = Math.max(128, Math.min(summaryMaxChars, Math.floor(effectiveMaxChars * 0.35)));
  const summary = summarizeMessages(headMessages, summaryBudget);

  const parts: string[] = [];
  if (summary) {
    parts.push(`${SUMMARY_HEADER}\n${summary}`);
  }
  if (tailMessages.length > 0) {
    parts.push(serializeMessages(tailMessages));
  }

  let composed = parts.join("\n\n");
  if (composed.length <= effectiveMaxChars) {
    return composed;
  }

  const reducedTail = [...tailMessages];
  while (reducedTail.length > mandatoryTailCount) {
    reducedTail.shift();
    const nextParts: string[] = [];
    if (summary) {
      nextParts.push(`${SUMMARY_HEADER}\n${summary}`);
    }
    if (reducedTail.length > 0) {
      nextParts.push(serializeMessages(reducedTail));
    }
    composed = nextParts.join("\n\n");
    if (composed.length <= effectiveMaxChars) {
      return composed;
    }
  }

  const finalParts: string[] = [];
  if (summary) {
    finalParts.push(`${SUMMARY_HEADER}\n${summary}`);
  }
  if (reducedTail.length > 0) {
    finalParts.push(serializeMessages(reducedTail));
  }
  composed = finalParts.join("\n\n");
  return composed;
}

function summarizeMessages(messages: ContextMessage[], maxChars: number): string {
  if (messages.length === 0 || maxChars <= 0) {
    return "";
  }

  const lines: string[] = [];
  let remaining = maxChars;
  for (const message of messages) {
    const candidate = `[${message.role}] ${message.content.replace(/\s+/g, " ").trim()}`;
    if (!candidate) {
      continue;
    }
    if (candidate.length + 1 > remaining) {
      const clipped = candidate.slice(0, Math.max(0, remaining - 2)).trim();
      if (clipped) {
        lines.push(`${clipped}…`);
      }
      break;
    }
    lines.push(candidate);
    remaining -= candidate.length + 1;
  }
  return lines.join("\n");
}

function resolveEffectiveMaxChars(maxChars: number, reserveChars: number): number {
  const max = Math.max(1_024, Math.floor(maxChars));
  const reserve = Math.max(0, Math.floor(reserveChars));
  return Math.max(256, max - reserve);
}
