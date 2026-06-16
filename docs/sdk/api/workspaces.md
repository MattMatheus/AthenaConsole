<!-- AUDIENCE: Engineer/SDK -->

# Workspaces

**Route family**: `workspaces`

Workspaces are the top-level organizational unit for multi-user deployments. Tasks, providers, and repositories are scoped to a workspace. All workspace operations require `Admin` role.

> ⚠️ **Preview — not yet enforced in the current build.**
> This describes the **target** behavior. As of this build, workspace/multi-user
> isolation is **not enforced**: workspace scope is client-asserted
> (`x-athena-scope-workspaces` header), there is no membership model, and
> cross-workspace reads are not blocked at the data layer. Tracking: epic
> 2026.44 stories .02–.04. **Do not expose a shared/multi-user deployment to
> untrusted users until these land.**

Epic 2026.44.01 (workspace CRUD and Admin RBAC) is built and committed. Stories .02–.04 (server-derived scope, membership tables, cross-workspace isolation) are designed but not yet enforced.

---

## Endpoints

### `GET /api/v1/workspaces`

List all workspaces.

**Required role**: `Admin`  
**Query params**: none

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "ws-default",
        "name": "Default",
        "description": "Default workspace",
        "createdAt": "2026-06-15T10:00:00.000Z",
        "updatedAt": "2026-06-15T10:00:00.000Z"
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
  http://127.0.0.1:8787/api/v1/workspaces
```

---

### `POST /api/v1/workspaces`

Create a workspace.

**Required role**: `Admin`  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | yes | Workspace name |
| `description` | string | no | Workspace description |

**Response** (`200`): Created workspace.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"name": "Platform Team", "description": "Platform engineering workspace"}' \
  http://127.0.0.1:8787/api/v1/workspaces
```

---

### `GET /api/v1/workspaces/:id`

Get a workspace by ID.

**Required role**: `Admin`  
**Path params**: `id` — workspace ID

**Response** (`200`): Workspace object.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/workspaces/ws-default
```

---

### `PUT /api/v1/workspaces/:id`

Update a workspace.

**Required role**: `Admin`  
**Path params**: `id` — workspace ID  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | no | New name |
| `description` | string | no | New description |

**Response** (`200`): Updated workspace.

**curl**:

```bash
curl -X PUT \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated description"}' \
  http://127.0.0.1:8787/api/v1/workspaces/ws-default
```

---

### `DELETE /api/v1/workspaces/:id`

Delete a workspace.

**Required role**: `Admin`  
**Path params**: `id` — workspace ID

**Response** (`200`): `{ id: "...", deleted: true }`

**curl**:

```bash
curl -X DELETE \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/workspaces/ws-old
```
