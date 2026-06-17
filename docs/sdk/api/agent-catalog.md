<!-- AUDIENCE: Engineer/SDK -->

# Agent Catalog

**Route family**: `agent-catalog`
**No role check** — these endpoints are publicly readable (no `assertAllowed` call in route handlers; authorization.ts has no `AuthorizedAgentCatalogService`).

---

## Endpoints

### `GET /api/v1/agent-catalog/plugins`

List all loaded plugins with their catalog diagnostics and loaded agent counts.

**Required role**: `Viewer`, `Operator`, or `Admin`
**Query params**: none

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "my-plugin",
        "displayName": "My Plugin",
        "version": "1.0.0",
        "agentCount": 2,
        "diagnostics": []
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
  http://127.0.0.1:8787/api/v1/agent-catalog/plugins
```

---

### `GET /api/v1/agent-catalog/agents`

List available agents, optionally filtered by capability.

**Required role**: `Viewer`, `Operator`, or `Admin`
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `capability` | string (repeatable) | Filter to agents declaring this capability. Can be specified multiple times or as a comma-separated list via the `capabilities` param. |
| `capabilities` | string | Comma-separated list of capability names (alternative to repeated `capability`) |

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "my-plugin/my-agent",
        "displayName": "My Agent",
        "pluginId": "my-plugin",
        "capabilities": ["shell", "memory"],
        "inputContract": []
      }
    ]
  }
}
```

**curl** — list all agents:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/agent-catalog/agents
```

**curl** — filter by capability:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  "http://127.0.0.1:8787/api/v1/agent-catalog/agents?capability=shell&capability=memory"
```

---

### `GET /api/v1/agent-catalog/connectors/readiness`

List connector readiness status for all loaded connector packs.

**Required role**: `Viewer`, `Operator`, or `Admin`
**Query params**: none

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "connectorId": "github",
        "ready": true,
        "reason": null
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
  http://127.0.0.1:8787/api/v1/agent-catalog/connectors/readiness
```
