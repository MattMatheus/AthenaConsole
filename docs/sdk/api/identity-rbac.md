<!-- AUDIENCE: Engineer/SDK -->

# Identity and RBAC

**Route family**: `identity-rbac`

These endpoints manage role assignments for subjects (users, API tokens, agent identities), list available roles, simulate permissions, and access the governance audit trail.

---

## RBAC

### `GET /api/v1/rbac/roles`

List all defined RBAC roles and their permissions.

**Required role**: `Admin`  
**Query params**: none

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "role": "Viewer",
        "permissions": ["sessions.list", "sessions.get", "taskWorkbench.list", "..."]
      },
      {
        "role": "Operator",
        "permissions": ["sessions.list", "sessions.get", "runs.create", "..."]
      },
      {
        "role": "Admin",
        "permissions": ["workspaces.create", "modelProviders.create", "policy.put", "..."]
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
  http://127.0.0.1:8787/api/v1/rbac/roles
```

---

### `GET /api/v1/rbac/simulate`

Simulate what permissions a given role would have.

**Required role**: `Admin`  
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `role` | string | Role to simulate (`Viewer`, `Operator`, `Admin`) |

**Response** (`200`): Simulation result with allowed operations list.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  "http://127.0.0.1:8787/api/v1/rbac/simulate?role=Operator"
```

---

### `GET /api/v1/rbac/assignments`

List all identity role assignments.

**Required role**: `Admin`  
**Query params**: none

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "subject": "alice",
        "subjectType": "user",
        "role": "Admin",
        "updatedAt": "2026-06-15T10:00:00.000Z",
        "updatedBy": "bootstrap"
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
  http://127.0.0.1:8787/api/v1/rbac/assignments
```

---

### `PUT /api/v1/rbac/assignments/:subject`

Create or update a role assignment for a subject.

**Required role**: `Admin`  
**Path params**: `subject` — identity subject (URL-encoded)  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `role` | string | yes | Role to assign (`Viewer`, `Operator`, `Admin`) |
| `subjectType` | string | yes | Subject type (e.g. `user`, `api-key`) |
| `updatedBy` | string | no | Auditor identity |

**Response** (`200`): Updated assignment.

**curl**:

```bash
curl -X PUT \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"role": "Operator", "subjectType": "user"}' \
  http://127.0.0.1:8787/api/v1/rbac/assignments/bob
```

---

### `DELETE /api/v1/rbac/assignments/:subject`

Remove a role assignment, reverting the subject to the default role.

**Required role**: `Admin`  
**Path params**: `subject` — identity subject (URL-encoded)

**Response** (`200`): `{ subject: "...", removed: true }`

**curl**:

```bash
curl -X DELETE \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/rbac/assignments/bob
```

---

### `GET /api/v1/rbac/audit/:subject`

Audit the effective permissions for a subject, including role and all allowed operations.

**Required role**: `Admin`  
**Path params**: `subject` — identity subject (URL-encoded)

**Response** (`200`): Audit result with role, assignment source, and effective permissions.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/rbac/audit/alice
```

---

## Governance Audit Trail

### `GET /api/v1/governance/audit-trail`

List governance audit records (sensitive operations: policy changes, role mutations, etc.).

**Required role**: `Admin`  
**Query params**:

| Parameter | Type | Description |
| --- | --- | --- |
| `cursor` | string | Pagination cursor |
| `limit` | integer | Page size (default 50, max 500) |
| `after` | string | ISO timestamp filter |
| `before` | string | ISO timestamp filter |
| `subject` | string | Filter by subject |
| `type` | string | Filter by audit event type |

**Response** (`200`): Paginated audit records.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/governance/audit-trail
```

---

### `GET /api/v1/governance/audit-trail/export.jsonl`

Export governance audit records as NDJSON.

**Required role**: `Admin`  
**Query params**: Same as `audit-trail`  
**Response**: `application/x-ndjson` body

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -o audit.jsonl \
  http://127.0.0.1:8787/api/v1/governance/audit-trail/export.jsonl
```

---

### `GET /api/v1/governance/audit-trail/export.csv`

Export governance audit records as CSV.

**Required role**: `Admin`  
**Query params**: Same as `audit-trail`  
**Response**: `text/csv` body

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -o audit.csv \
  http://127.0.0.1:8787/api/v1/governance/audit-trail/export.csv
```
