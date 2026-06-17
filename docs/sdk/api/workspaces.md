<!-- AUDIENCE: Engineer/SDK -->

# Workspaces

**Route family**: `workspaces`

Workspaces are the top-level organizational unit for multi-user deployments. Tasks, providers, and repositories are scoped to a workspace. Workspace administration requires `Admin` role, and workspace membership controls per-workspace access for non-admin subjects.

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

---

### `GET /api/v1/workspaces/:id/members`

List workspace members.

**Required role**: `Admin`
**Path params**: `id` — workspace ID

**Response** (`200`): `{ members: [...], total: 1 }`

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/workspaces/ws-default/members
```

---

### `PUT /api/v1/workspaces/:id/members/:subject`

Add or update a workspace member.

**Required role**: `Admin`
**Path params**: `id` — workspace ID; `subject` — normalized identity subject
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `role` | `Viewer` \| `Operator` \| `Admin` | yes | Workspace-local role |

**Response** (`200`): Workspace member object.

**curl**:

```bash
curl -X PUT \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"role": "Operator"}' \
  http://127.0.0.1:8787/api/v1/workspaces/ws-default/members/alice
```

---

### `DELETE /api/v1/workspaces/:id/members/:subject`

Remove a workspace member.

**Required role**: `Admin`
**Path params**: `id` — workspace ID; `subject` — normalized identity subject

**Response** (`200`): `{ workspaceId: "...", subject: "...", deleted: true }`

**curl**:

```bash
curl -X DELETE \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/workspaces/ws-default/members/alice
```
