# Model Provider Smoke Test Plugin

This sample plugin proves that Team Orchestrator can pass a configured model provider into a local-command agent.

It includes one read-only agent:

- Agent id: `model.prompt.smoke`
- Capability: `model.prompt`
- Provider requirement: OpenAI-compatible model provider
- Runtime backend: `local-process`

## Configure A Provider

In the console, open Settings and add an OpenAI-compatible provider.

For DeepSeek:

- Base URL: `https://api.deepseek.com`
- Default model: the model id you want to test
- Secret kind: `env`
- Secret name: `DEEPSEEK_API_KEY`

The API resolves env-style secrets from the running process environment or from the workspace `.env` file.

## Run The Smoke Agent

1. Restart the API after adding this plugin or changing `.env`.
2. Open Agents and confirm `Model Prompt Smoke Agent` is available.
3. Open Tasks.
4. Choose `Model Prompt Smoke Agent`.
5. Enter a short prompt and run the task.
6. Inspect the task run output and the `Model Response` artifact metadata.

The runner calls the configured provider's `/chat/completions` endpoint and returns the first assistant message. It never writes the API key to output, events, artifacts, or metadata.

To copy this sample into your own agent, follow the "Starting from a sample" section of the [Agent Developer Kit guide](../../../docs/sdk/agent-developer-kit.md#starting-from-a-sample).
