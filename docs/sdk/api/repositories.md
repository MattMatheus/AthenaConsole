<!-- AUDIENCE: Engineer/SDK -->

# Repositories

**Route family**: `repositories`

Connected repositories provide the file system context that agents can read and write. Repositories are workspace-scoped.

> ⚠️ **Preview — not yet enforced in the current build.**
> This describes the **target** behavior. As of this build, workspace/multi-user
> isolation is **not enforced**: workspace scope is client-asserted
> (`x-athena-scope-workspaces` header), there is no membership model, and
> cross-workspace reads are not blocked at the data layer. Tracking: epic
> 2026.44 stories .02–.04. **Do not expose a shared/multi-user deployment to
> untrusted users until these land.**

---

## Endpoints

### `GET /api/v1/repositories`

List connected repositories. Results filtered to accessible workspaces.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Query params**: none

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "repositories": [
      {
        "id": "repo-main",
        "displayName": "Main App",
        "path": "/home/user/projects/app",
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
  http://127.0.0.1:8787/api/v1/repositories
```

---

### `POST /api/v1/repositories`

Create a connected repository.

**Required role**: `Operator` or `Admin`  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `displayName` | string | yes | Human-readable name |
| `path` | string | yes | Absolute filesystem path |
| `workspaceId` | string | no | Workspace to scope this repository to |

**Response** (`200`): Created repository.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"displayName": "Main App", "path": "/home/user/projects/app"}' \
  http://127.0.0.1:8787/api/v1/repositories
```

---

### `POST /api/v1/repositories/inspect`

Inspect a path by workspace-relative path (without requiring a repository ID).

**Required role**: `Operator` or `Admin`  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `workspacePath` | string | yes | Workspace-relative path to inspect |

**Response** (`200`): Directory/file listing and metadata.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"workspacePath": "src/"}' \
  http://127.0.0.1:8787/api/v1/repositories/inspect
```

---

### `GET /api/v1/repositories/:id`

Get a repository by ID.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Path params**: `id` — repository ID

**Response** (`200`): Repository record.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/repositories/repo-main
```

---

### `DELETE /api/v1/repositories/:id`

Delete a connected repository (removes the record; does not delete the filesystem directory).

**Required role**: `Operator` or `Admin`  
**Path params**: `id` — repository ID

**Response** (`200`): `{ id: "...", deleted: true }`

**curl**:

```bash
curl -X DELETE \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/repositories/repo-main
```

---

### `POST /api/v1/repositories/:id/inspect`

Inspect the contents of a connected repository.

**Required role**: `Operator` or `Admin`  
**Path params**: `id` — repository ID  
**Request body**: `{}` (empty, or with optional `subPath`)

**Response** (`200`): File listing and metadata for the repository root or sub-path.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8787/api/v1/repositories/repo-main/inspect
```
