<!-- AUDIENCE: Internal/Technical -->

# OpenClaw Agent Runtime Design Notes

## 1) Agent Loop And Subagent Management

### 1.1 Primary execution loop (embedded Pi)

- Entry point: `runEmbeddedPiAgent()` in `/Users/foundry/Source/openclaw/src/agents/pi-embedded-runner/run.ts`.
- Concurrency model:
  - Per-session lane (`resolveSessionLane(...)`) serializes turns for a session key / session id.
  - Global lane (`resolveGlobalLane(...)`) provides broader command-lane ordering.
  - Actual run wraps as `enqueueSession(() => enqueueGlobal(async () => ...))`.
- High-level loop semantics:
  - Resolve workspace, model, provider, auth profile order.
  - Build/reuse session transcript manager (`SessionManager`) backed by JSONL transcript file.
  - Build tool set + system prompt.
  - Execute one attempt (`runEmbeddedAttempt(...)`).
  - Inspect result/error class; perform controlled retries/fallback actions.
  - Return structured payloads + usage/metadata.

### 1.2 Attempt lifecycle (`runEmbeddedAttempt`)

- Session prep:
  - Acquire session write lock (`acquireSessionWriteLock`) before transcript mutation.
  - Repair transcript if needed (`repairSessionFileIfNeeded`), preload file pages (`prewarmSessionFile`), initialize manager state (`prepareSessionManagerForRun`).
  - Apply transcript sanitation + turn validation + history limiting before prompt.
- Prompt lifecycle:
  - Build runtime/system prompt sections (tools, memory, sandbox, heartbeat hints, skills, docs, runtime metadata).
  - Create session via `createAgentSession(...)`.
  - Subscribe to streaming events via `subscribeEmbeddedPiSession(...)`.
  - Prompt model (`activeSession.prompt(...)`) with optional detected images.
- Timeout/abort lifecycle:
  - Run-scoped `AbortController`; hard timeout schedules `abortRun(true)`.
  - Abort path marks `timedOut` and, if compaction in-flight, marks `timedOutDuringCompaction`.
- Completion lifecycle:
  - Wait for compaction retries to settle.
  - Snapshot message state (with timeout-aware snapshot selection).
  - Flush pending tool results after idle (`flushPendingToolResultsAfterIdle`) to avoid orphaned tool result state.
  - Dispose session, release lock, clear active-run registry entry.

### 1.3 Retry/fallback state machine (inside `runEmbeddedPiAgent`)

- Retry dimensions:
  - Auth profile rotation: if profile-specific auth/rate-limit/failover signatures detected.
  - Thinking-level downgrade: if provider/model rejects current think level.
  - Context overflow handling:
    - Retry after in-attempt compaction.
    - Explicit direct compaction (`compactEmbeddedPiSessionDirect`).
    - Oversized tool-result truncation fallback.
- Terminal failure classes:
  - Context overflow (after bounded compaction/truncation attempts).
  - Prompt/assistant hard errors not eligible for fallback.
  - Role ordering conflict (returns user-facing retry/new-session hint).
- Model fallback:
  - Outer orchestration (`runWithModelFallback`) in reply runners and cron isolated runner can switch provider/model when `FailoverError` is surfaced.

### 1.4 Active run control plane (session-local steering/abort)

- Registry in `/Users/foundry/Source/openclaw/src/agents/pi-embedded-runner/runs.ts`:
  - `ACTIVE_EMBEDDED_RUNS: Map<sessionId, handle>`.
  - Handle contains: `queueMessage`, `isStreaming`, `isCompacting`, `abort`.
- Runtime controls:
  - `queueEmbeddedPiMessage(sessionId, text)` steers active run if streaming and not compacting.
  - `abortEmbeddedPiRun(sessionId)` aborts run.
  - `waitForEmbeddedPiRunEnd(sessionId, timeoutMs)` resolves when cleared from active map.

### 1.5 Subagent management model

- Spawn tool: `sessions_spawn` in `/Users/foundry/Source/openclaw/src/agents/tools/sessions-spawn-tool.ts`.
  - Creates isolated child session key: `agent:<targetAgentId>:subagent:<uuid>`.
  - Patches child session metadata (spawn depth, model/thinking overrides).
  - Calls gateway `agent` method with lane `AGENT_LANE_SUBAGENT`.
  - Registers run in subagent registry.
- Policy gates:
  - Depth limit (`maxSpawnDepth`).
  - Max active children per requester (`maxChildrenPerAgent`).
  - Allowed target agents (`subagents.allowAgents`).
- Registry: `/Users/foundry/Source/openclaw/src/agents/subagent-registry.ts`.
  - Persistent run records (`runId`, `childSessionKey`, requester linkage, lifecycle timestamps, outcome).
  - Restore-on-start behavior and resume of incomplete cleanup/announce flow.
  - Lifecycle event listener (`onAgentEvent`) updates start/end/error state.
- Completion/announce flow:
  - `runSubagentAnnounceFlow(...)` generates completion message routed back to requester session.
  - If requester run is active, system can steer or queue announcement depending on queue mode.
- Operator control:
  - `subagents` tool supports `list|kill|steer`.
  - Kill path aborts active child run + clears queued followups + marks terminated in registry.

## 2) Work Queue And Management Systems

### 2.1 Queue architecture

- Core queue module: `/Users/foundry/Source/openclaw/src/auto-reply/reply/queue/*`.
- Data model:
  - Keyed queue (`FOLLOWUP_QUEUES`) per logical conversation/session key.
  - Queue items are `FollowupRun` objects with prompt + routing metadata + run config snapshot.
- Queue insertion:
  - `enqueueFollowupRun(...)` applies dedupe (`message-id`/`prompt`/none) and drop policy.
  - Drop policies: keep old, keep new, summarize dropped.

### 2.2 Queue operating modes

- `steer`:
  - If current run is streaming, inject prompt via `queueEmbeddedPiMessage`.
  - No separate follow-up turn required when steering succeeds.
- `followup`:
  - Buffer while active; run later as separate turn.
- `collect`:
  - Aggregate queued prompts into one synthesized prompt for batch processing.
  - Falls back to per-item processing when cross-channel routing would be ambiguous.
- `steer-backlog` / `interrupt`:
  - Hybrid strategies combining immediate steering with backlog retention semantics.

### 2.3 Drain pipeline

- `scheduleFollowupDrain(...)`:
  - Single drain coroutine per queue (re-entrant safe via `draining` flag).
  - Debounce waits between runs.
  - Builds summary prompts for dropped/collected items where applicable.
  - Calls `runFollowup(...)` for each executable item.
- Follow-up runner (`followup-runner.ts`):
  - Executes `runEmbeddedPiAgent` under fallback wrapper.
  - Persists usage/model/session metadata post-run.
  - Applies payload de-duplication with messaging-tool sent text/target suppression logic.

### 2.4 Queue + active-run integration

- In `runReplyAgent(...)`:
  - If active + mode supports steer: attempt `queueEmbeddedPiMessage`.
  - If active + followup needed: enqueue and return without running immediate turn.
  - Otherwise execute immediate run.
- This yields:
  - Backpressure safety (avoid uncontrolled concurrent model turns per session).
  - Latency optimization (steer when possible).
  - Lossless deferred execution (queued followups when busy).

### 2.5 Event-driven continuation and wake mechanisms

- System event queue (`infra/system-events.ts`):
  - Session-scoped ephemeral FIFO (`MAX_EVENTS=20`), dedupes consecutive identical text.
  - Drained at turn start and prepended as `System: [timestamp] ...` lines.
- Heartbeat wake scheduler (`infra/heartbeat-wake.ts`):
  - Coalesces wake requests with priority semantics.
  - Retries when skipped due to in-flight main-lane workload.
- Heartbeat runner (`infra/heartbeat-runner.ts`):
  - Runs synthetic heartbeat turns in main/target session.
  - Handles ack suppression (`HEARTBEAT_OK`), duplicate suppression, visibility policies.
- Cron timer (`cron/service/timer.ts`):
  - Main-session jobs: enqueue system event + wake now/next heartbeat.
  - Isolated jobs: run isolated agent turn, optionally deliver direct output, optionally enqueue summary event.

## 3) Memory Management And History Management

### 3.1 Memory planes

- Plane A: conversational session memory (JSONL transcript + in-memory context window management).
- Plane B: explicit retrievable memory index (`memory_search`, `memory_get`) over memory markdown and optional transcripts.

### 3.2 Session history lifecycle (Plane A)

- Persistent substrate:
  - Session entries in session store (`SessionEntry`) track ids, token stats, compaction counts, model/provider, heartbeat dedupe markers, etc.
  - Transcript file per session id (`resolveSessionTranscriptPath` + `SessionManager` JSONL entries).
- Pre-run history pipeline:
  - Session file repair.
  - Transcript sanitation/ordering fixes (provider-specific constraints).
  - History truncation by DM/session limits.
  - Tool use/result pairing repair after truncation to avoid orphaned tool results.
- In-run history mutations:
  - New messages streamed by agent.
  - Compaction may rewrite summarized context boundaries.
  - Cache-TTL marker append for pruning heuristics.
- Post-run accounting:
  - Usage normalization and session token metadata persisted.
  - Compaction counters and freshness flags updated.

### 3.3 Context budget management

- Compaction:
  - Triggered by SDK/runtime when context pressure is high.
  - Optional safeguard extension (`pi-extensions/compaction-safeguard`) adds staged summarization and aggressive pruning logic under configured bounds.
- Overflow recovery sequence:
  - Detect likely overflow errors.
  - Bound retry loop with explicit compaction attempts.
  - If dominated by oversized tool results, truncate large tool-result payloads in transcript and retry.
- Context pruning (cache-ttl mode):
  - Optional extension (`pi-extensions/context-pruning`) prunes in-memory context according to tool-aware heuristics and last cache-touch timestamps.
  - Explicitly does not rewrite persistent history by design.

### 3.4 Retrievable memory subsystem (Plane B)

- Tool interface:
  - `memory_search(query, maxResults, minScore)` returns semantically ranked snippets.
  - `memory_get(path, from, lines)` fetches bounded snippet segments.
- Manager selection:
  - `getMemorySearchManager(...)` chooses backend (QMD wrapper or builtin manager fallback).
  - Manager caches by resolved config + agent id.
- Builtin manager (`memory/manager.ts`):
  - SQLite index with vector table (`chunks_vec`) and optional FTS table (`chunks_fts`) + hybrid merge.
  - Embedding provider abstraction (openai/local/gemini/voyage/auto) with fallback pathways.
  - Watchers for memory files + session transcript updates.
  - Sync triggers: on session start, on search (if dirty), file watch debounce, optional interval.
- Session transcript indexing:
  - Session files enumerated from per-agent transcript dir.
  - Extracts user/assistant textual content only; redacts sensitive text before indexing.
  - Stores line map to support file#line citation references.

### 3.5 Memory source and scope controls

- Config resolution:
  - Merged defaults + per-agent overrides in `resolveMemorySearchConfig(...)`.
  - Source set includes `memory` and optional `sessions` (behind `experimental.sessionMemory` gate).
- Citation behavior:
  - Auto/on/off modes; can append `Source: <path#line>` to snippets depending on mode and chat type.
- Injection budgeting:
  - Memory search tool can clamp returned snippet chars to configured injected-char budget (QMD path).

### 3.6 End-to-end history management process (concise flow)

1. Session selected; store entry loaded/updated.
2. System events drained and prepended to user body.
3. Session transcript manager opened with lock + repair/init.
4. Historical messages sanitized/validated/limited/repaired.
5. Agent turn runs with tools; may compact/prune/retry on failures.
6. Post-turn metadata persisted (usage, context token estimates, compaction/memory flush markers).
7. Background queues, cron, heartbeat, subagent completion events can enqueue future system events/followups.
8. Next turn resumes from persisted transcript + queued events + updated session metadata.

