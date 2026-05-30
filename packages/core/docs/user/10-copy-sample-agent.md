# Copy The Model Provider Smoke Agent

This guide shows the exact copy-and-rename path for turning `sample-plugins/model-provider-smoke` into your own local model-backed agent.

Use this when you want a working OpenAI-compatible agent quickly and you are comfortable editing files directly.

## 1. Copy The Sample Directory

From the repository root:

```bash
cp -R sample-plugins/model-provider-smoke sample-plugins/local-user-test
```

Use your own directory name if you are not recreating the local test sample. Keep it lowercase and stable, because artifact URIs and docs should use the same namespace.

## 2. Rename The Plugin

Open `sample-plugins/local-user-test/plugin.yaml`.

Change these fields:

| Field | Before | After example |
| --- | --- | --- |
| `plugin.id` | `team-orchestrator.samples.model-provider-smoke` | `team-orchestrator.samples.local-user-test` |
| `plugin.name` | `Model Provider Smoke Test` | `Local User Test` |
| `plugin.agents[0].id` | `model.prompt.smoke` | `local.user.test` |

The plugin id and agent id must be unique across every configured plugin path. If either value is duplicated, the API keeps the colliding package out of the usable catalog and the Agents page shows duplicate-id validation diagnostics.

## 3. Rename The Agent

Open `sample-plugins/local-user-test/agents/model-prompt.agent.yaml`.

Change these fields:

| Field | Before | After example |
| --- | --- | --- |
| `agent.id` | `model.prompt.smoke` | `local.user.test` |
| `agent.name` | `Model Prompt Smoke Agent` | `Local User Test Agent` |
| `agent.description` | Smoke-test wording | Your agent purpose |

The `plugin.yaml` agent entry and the agent manifest must agree on id and version:

```yaml
plugin:
  agents:
    - path: agents/model-prompt.agent.yaml
      id: local.user.test
      version: 0.1.0
```

```yaml
agent:
  id: local.user.test
  version: 0.1.0
```

## 4. Rename The Artifact Namespace

Open `sample-plugins/local-user-test/agents/model-prompt-runner.mjs`.

Change the memory artifact URI namespace:

```js
storageUri: `memory://model-provider-smoke/${encodeURIComponent(envelope.run.id)}/response.md`,
```

to:

```js
storageUri: `memory://local-user-test/${encodeURIComponent(envelope.run.id)}/response.md`,
```

This keeps run artifacts readable and makes copied agents easier to identify in run detail.

## 5. Update The Plugin README

Open `sample-plugins/local-user-test/docs/README.md`.

Update:

- Heading
- Agent id
- Agent display name
- Any copy that still says smoke test if your agent is no longer just a smoke test

## 6. Confirm Provider Configuration

The copied sample still requires an OpenAI-compatible model provider.

For DeepSeek in Settings:

- Provider kind: `openai-compatible`
- Base URL: `https://api.deepseek.com`
- Default model: the model id you want to test
- Secret kind: `env`
- Secret name: `DEEPSEEK_API_KEY`

The API resolves `env` secrets from the running process environment and from the workspace `.env` file.

## 7. Restart The API

Restart the API after adding or renaming plugin files:

```bash
ATHENA_WORKSPACE_ROOT="$PWD" npm --workspace @athena/api run dev
```

If you use the root launcher:

```bash
./dev.sh
```

## 8. Verify The Catalog

Open the console Agents page and confirm your new agent is available.

You can also check through the API:

```bash
curl "http://127.0.0.1:8787/api/v1/agent-catalog/agents"
curl "http://127.0.0.1:8787/api/v1/agent-catalog/plugins"
```

If the copied agent does not appear, look for:

- Duplicate plugin id/version
- Duplicate agent id/version
- A mismatch between `plugin.agents[0].id` and `agent.id`
- A stale runner artifact namespace that still points at the old sample
- A missing or invalid provider configuration

## 9. Run A Positive Test

In the console:

1. Open Tasks.
2. Create a ready task assigned to your copied agent.
3. Enter a short prompt, such as `Reply with one sentence confirming this copied agent is running.`
4. Run the task.
5. Open the run detail page.
6. Confirm the Model Result panel has a response.
7. Open the `Model Response` artifact and confirm the markdown preview renders.

The successful run proves the provider, agent manifest, runner, artifact metadata, and task-run inspection path are all wired correctly.

## Related Guides

- [Build Your First Agent](07-pdk-guide.md)
- [Team Orchestrator Documentation Map](../../../../docs/README.md)
