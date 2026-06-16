<!-- AUDIENCE: Engineer/SDK -->

# Model Providers

**Route family**: `model-providers`

Model providers configure the LLM backends the platform can use for runs. All operations require `Admin` role — provider configs may contain API credentials.

> ⚠️ **Preview — not yet enforced in the current build.**
> This describes the **target** behavior. As of this build, workspace/multi-user
> isolation is **not enforced**: workspace scope is client-asserted
> (`x-athena-scope-workspaces` header), there is no membership model, and
> cross-workspace reads are not blocked at the data layer. Tracking: epic
> 2026.44 stories .02–.04. **Do not expose a shared/multi-user deployment to
> untrusted users until these land.**

Provider configs are workspace-scoped: workspace filtering applies via `x-athena-scope-workspaces`.

---

## Endpoints

### `GET /api/v1/model-providers`

List configured model providers. Results filtered to accessible workspaces.

**Required role**: `Admin`  
**Query params**: none

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "providers": [
      {
        "id": "openai-main",
        "type": "openai-compatible",
        "displayName": "OpenAI Main",
        "baseUrl": "https://api.openai.com/v1",
        "models": ["gpt-4o", "gpt-4o-mini"],
        "workspaceId": "ws-default",
        "createdAt": "2026-06-15T10:00:00.000Z"
      }
    ],
    "total": 1
  }
}
```

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/model-providers
```

---

### `POST /api/v1/model-providers`

Create a model provider configuration.

**Required role**: `Admin`  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | string | yes | Provider type (`openai-compatible`) |
| `displayName` | string | yes | Human-readable name |
| `baseUrl` | string | yes | API base URL |
| `models` | string[] | yes | Available model identifiers |
| `apiKeySource` | object | yes | Key source (`{ kind: "env", envVar: "..." }` or `{ kind: "local-file", path: "..." }`) |
| `workspaceId` | string | no | Workspace to scope this provider to |

**Response** (`200`): Created provider record (API key value is never returned).

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "openai-compatible",
    "displayName": "OpenAI Main",
    "baseUrl": "https://api.openai.com/v1",
    "models": ["gpt-4o", "gpt-4o-mini"],
    "apiKeySource": {"kind": "env", "envVar": "OPENAI_API_KEY"}
  }' \
  http://127.0.0.1:8787/api/v1/model-providers
```

---

### `GET /api/v1/model-providers/:id`

Get a model provider by ID.

**Required role**: `Admin`  
**Path params**: `id` — provider ID

**Response** (`200`): Provider record (no API key value).

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/model-providers/openai-main
```

---

### `PUT /api/v1/model-providers/:id`

Update a model provider.

**Required role**: `Admin`  
**Path params**: `id` — provider ID  
**Request body**: Same optional fields as `POST`. Note: `id` in the body cannot differ from the path param.

**Response** (`200`): Updated provider record.

**curl**:

```bash
curl -X PUT \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"displayName": "OpenAI Main (updated)", "models": ["gpt-4o", "gpt-4o-mini", "o1"]}' \
  http://127.0.0.1:8787/api/v1/model-providers/openai-main
```

---

### `DELETE /api/v1/model-providers/:id`

Delete a model provider.

**Required role**: `Admin`  
**Path params**: `id` — provider ID

**Response** (`200`): `{ id: "...", deleted: true }`

**curl**:

```bash
curl -X DELETE \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/model-providers/openai-main
```

---

### `POST /api/v1/model-providers/:id/test`

Test a model provider by sending a minimal completion request.

**Required role**: `Admin`  
**Path params**: `id` — provider ID  
**Request body**: `{}` (empty)

**Response** (`200`): Test result with `success` flag and optional error details.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8787/api/v1/model-providers/openai-main/test
```
