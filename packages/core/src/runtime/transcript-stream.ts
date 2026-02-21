import type { TranscriptEntry } from "../shared/contracts.js";

export type TranscriptListener = (entry: TranscriptEntry) => void;

export interface TranscriptSubscription {
  close(): void;
}

class TranscriptStreamBroker {
  private readonly listenersBySession = new Map<string, Set<TranscriptListener>>();

  publish(sessionId: string, entries: TranscriptEntry[]): void {
    const listeners = this.listenersBySession.get(sessionId);
    if (!listeners || listeners.size === 0) {
      return;
    }
    for (const entry of entries) {
      for (const listener of listeners) {
        queueMicrotask(() => {
          try {
            listener(entry);
          } catch {
            // Stream listeners are best-effort and must not break transcript append semantics.
          }
        });
      }
    }
  }

  subscribe(sessionId: string, listener: TranscriptListener): TranscriptSubscription {
    const listeners = this.listenersBySession.get(sessionId) ?? new Set<TranscriptListener>();
    listeners.add(listener);
    this.listenersBySession.set(sessionId, listeners);
    return {
      close: () => {
        const current = this.listenersBySession.get(sessionId);
        if (!current) {
          return;
        }
        current.delete(listener);
        if (current.size === 0) {
          this.listenersBySession.delete(sessionId);
        }
      }
    };
  }
}

export const transcriptStreamBroker = new TranscriptStreamBroker();
