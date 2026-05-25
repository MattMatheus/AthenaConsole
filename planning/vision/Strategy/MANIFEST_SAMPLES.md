<!-- AUDIENCE: Internal/Technical -->

# Team Orchestrator: Manifest Samples

These examples illustrate the new manifest-first model. The canonical v1 schemas and runnable examples live in:

- `packages/core/schemas/team-orchestrator/manifests/v1/`

## Single-Agent Plugin

```yaml
schemaVersion: 1
plugin:
  id: team-orchestrator.examples.news
  name: News Workflow Examples
  version: 0.1.0
  agents:
    - path: agents/news-digest.agent.yaml
      id: news.digest.local
      version: 0.1.0
```

```yaml
schemaVersion: 1
agent:
  id: news.digest.local
  name: News Digest
  version: 0.1.0
  capabilities:
    - news.aggregate
    - text.summarize
  inputs:
    topic:
      type: string
      required: true
    lookbackHours:
      type: number
      default: 24
  outputs:
    mode: flexible
    artifacts:
      - key: digest
        format: markdown
  implementation:
    type: local-command
    command: npm
    args: ["run", "agent:news-digest"]
  runtime:
    preferredBackend: local-process
  permissions:
    network: read
    filesystem: scoped
    shell: allow
  limits:
    maxToolCalls: 40
    maxRuntimeSeconds: 600
  observability:
    mode: black-box
```

## Software Task Agent

```yaml
schemaVersion: 1
agent:
  id: software.task.local
  name: Software Task
  version: 0.1.0
  capabilities:
    - code.modify
    - tests.run
  inputs:
    repositoryPath:
      type: string
      required: true
    taskBrief:
      type: markdown
      required: true
  outputs:
    mode: flexible
    artifacts:
      - key: summary
        format: markdown
      - key: patch
        format: patch
        optional: true
  implementation:
    type: local-command
    command: node
    args: ["agents/software-task/run.js"]
  runtime:
    preferredBackend: local-process
  permissions:
    network: read
    filesystem: scoped
    shell: allow
    approvalRequiredFor:
      - destructive-filesystem
      - network-write
  limits:
    maxRuntimeSeconds: 900
    maxToolCalls: 80
    maxRepeatedActions: 3
    maxRetries: 2
    maxFollowUpTasks: 5
  observability:
    mode: inspectable
```

## Mission Template

```yaml
workflowTemplate:
  id: podcast.weekly-briefing
  name: Weekly Podcast Briefing
  version: 0.1.0
  tasks:
    - id: ingest
      title: Ingest source episodes
      capability: media.ingest
    - id: transcribe
      title: Transcribe episode audio
      capability: audio.transcribe
      dependsOn: ["ingest"]
    - id: summarize
      title: Summarize transcript
      capability: text.summarize
      dependsOn: ["transcribe"]
    - id: showNotes
      title: Draft show notes
      capability: content.draft
      dependsOn: ["summarize"]
```

## Notes

- A plugin can contain one agent or many agents.
- A task is normally assigned to a compatible agent.
- A mission can begin as an ordered list while preserving dependency metadata for future DAG execution.
- Outputs remain flexible at first, with optional schemas added where they improve reliability.
