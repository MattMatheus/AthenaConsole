<!-- AUDIENCE: Engineer/SDK -->

# Run Templates, Harness Profiles, and Directives

**Route families**: `run-templates`, `harness-profiles`, `directives`

These three families support the decoupled execution model:

- A **Directive** captures task input and optional context references (files, repos) separately from the runner config.
- A **Harness Profile** defines provider, model, tools, and verification policies.
- A **Run Template** combines a directive and harness profile into a reusable template that can be triggered without repeating the full request.

Combine them in `POST /api/v1/runs` via `directiveId` and `harnessProfileId`, or store the combination in a run template.

---

## Run Templates

### `GET /api/v1/run-templates`

List run templates.

**Required role**: `Operator` or `Admin`
**Query params**: `cursor`, `limit` (standard pagination)

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "tmpl-001",
        "displayName": "CI Triage",
        "harnessProfileId": "hp_ops_v1",
        "createdAt": "2026-06-15T10:00:00.000Z"
      }
    ],
    "nextCursor": null
  }
}
```

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/run-templates
```

---

### `POST /api/v1/run-templates`

Create a run template.

**Required role**: `Operator` or `Admin`
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `displayName` | string | yes | Human-readable name |
| `harnessProfileId` | string | no | Harness profile to use |
| `directiveId` | string | no | Directive to bind |
| `params` | object | no | Default parameter overrides |

**Response** (`200`): Created run template object.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"displayName": "CI Triage", "harnessProfileId": "hp_ops_v1"}' \
  http://127.0.0.1:8787/api/v1/run-templates
```

---

### `POST /api/v1/templates/:id/run`

Execute a run template.

**Required role**: `Operator` or `Admin`
**Path params**: `id` — run template ID
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `provider` | string | no | Override provider |
| `model` | string | no | Override model |
| `params` | object | no | Runtime parameter overrides |

**Response** (`200`): Run result including `runId`, `sessionId`, `provider`, `model`.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8787/api/v1/templates/tmpl-001/run
```

---

## Harness Profiles

### `GET /api/v1/harness-profiles`

List harness profiles.

**Required role**: `Operator` or `Admin`
**Query params**: `cursor`, `limit` (standard pagination)

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "hp_ops_v1",
        "displayName": "Ops Profile",
        "version": "v1",
        "config": {
          "provider": "mock",
          "model": "default",
          "tools": ["shell", "memory"]
        },
        "policies": {
          "timeoutMs": 60000,
          "retryLimit": 2,
          "budgetUsd": 0
        },
        "createdAt": "2026-06-15T10:00:00.000Z"
      }
    ]
  }
}
```

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/harness-profiles
```

---

### `POST /api/v1/harness-profiles`

Create a harness profile.

**Required role**: `Operator` or `Admin`
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `displayName` | string | yes | Human-readable name |
| `version` | string | yes | Version string (e.g. `v1`) |
| `config` | object | yes | `{ provider, model, tools: string[] }` |
| `policies` | object | no | `{ timeoutMs, retryLimit, budgetUsd }` |
| `verificationPolicies` | array | no | Verification policy records |

**Response** (`200`): Created harness profile.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Ops Profile",
    "version": "v1",
    "config": {"provider": "mock", "model": "default", "tools": ["shell"]},
    "policies": {"timeoutMs": 60000, "retryLimit": 2, "budgetUsd": 0}
  }' \
  http://127.0.0.1:8787/api/v1/harness-profiles
```

---

## Directives

### `GET /api/v1/directives`

List directives. Scoped: token holders can restrict to agent-scoped directives via `x-athena-scope-agents`.

**Required role**: `Operator` or `Admin`
**Query params**: `cursor`, `limit` (standard pagination)

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "dir_triage",
        "input": "Collect failures from latest CI run",
        "contextRefs": ["planning/archive/handoff.md"],
        "metadata": {"owner": "platform"},
        "createdAt": "2026-06-15T10:00:00.000Z"
      }
    ]
  }
}
```

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/directives
```

---

### `POST /api/v1/directives`

Create a directive.

**Required role**: `Operator` or `Admin`
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `input` | string | yes | Natural language task description |
| `contextRefs` | string[] | no | File/path references to include as context |
| `metadata` | object | no | Arbitrary key-value metadata |

**Response** (`200`): Created directive.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"input": "Create remediation plan", "contextRefs": ["TODO.md"], "metadata": {"priority": "high"}}' \
  http://127.0.0.1:8787/api/v1/directives
```
