<!-- AUDIENCE: Engineer/SDK -->

# Durable Memory

**Route family**: `durable-memory`

Durable memory stores persistent, versioned knowledge records that agents read and write across runs. It supports proposals (suggested writes requiring review), snapshots (point-in-time backups), and semantic search.

All operations use `POST` with JSON body for queries — this allows complex filter expressions without encoding issues.

---

## Records

### `GET /api/v1/durable-memory/health`

Check durable memory service health.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Query params**: none (parsed but unused)

**Response** (`200`): Health status object.

**curl**:

```bash
curl \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  http://127.0.0.1:8787/api/v1/durable-memory/health
```

---

### `POST /api/v1/durable-memory/records`

Write (create or update) a durable memory record.

**Required role**: `Operator` or `Admin`  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | no | Record ID (server-generated if omitted) |
| `namespace` | string | yes | Namespace for the record |
| `key` | string | yes | Unique key within the namespace |
| `value` | any | yes | Record value |
| `metadata` | object | no | Arbitrary metadata |

**Response** (`201`): Written record with `id`, `namespace`, `key`, `createdAt`, `updatedAt`.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"namespace": "team", "key": "coding-standards", "value": {"style": "functional", "maxLineLength": 100}}' \
  http://127.0.0.1:8787/api/v1/durable-memory/records
```

---

### `POST /api/v1/durable-memory/records/get`

Get a durable memory record by namespace + key.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `namespace` | string | yes | Record namespace |
| `key` | string | yes | Record key |

**Response** (`200`): Record or `null`.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"namespace": "team", "key": "coding-standards"}' \
  http://127.0.0.1:8787/api/v1/durable-memory/records/get
```

---

### `POST /api/v1/durable-memory/records/list`

List durable memory records with optional filters.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `namespace` | string | no | Filter by namespace |
| `cursor` | string | no | Pagination cursor |
| `limit` | integer | no | Page size (default 50, max 500) |
| `includeArchived` | boolean | no | Include archived records |

**Response** (`200`): `{ items: [...], nextCursor? }`

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"namespace": "team"}' \
  http://127.0.0.1:8787/api/v1/durable-memory/records/list
```

---

### `POST /api/v1/durable-memory/records/search`

Semantic search over durable memory records.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `query` | string | yes | Search query |
| `namespace` | string | no | Scope search to a namespace |
| `limit` | integer | no | Max results |

**Response** (`200`): Ranked search results.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"query": "coding style guidelines", "limit": 5}' \
  http://127.0.0.1:8787/api/v1/durable-memory/records/search
```

---

### `POST /api/v1/durable-memory/records/:id/archive`

Archive a record (soft-delete, preserves history).

**Required role**: `Operator` or `Admin`  
**Path params**: `id` — record ID  
**Request body**: `{}` (or with optional `reason`)

**Response** (`200`): Updated record.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8787/api/v1/durable-memory/records/rec-001/archive
```

---

### `POST /api/v1/durable-memory/records/:id/delete`

Permanently delete a record.

**Required role**: `Operator` or `Admin`  
**Path params**: `id` — record ID  
**Request body**: `{}` (or with optional `reason`)

**Response** (`200`): `{ id: "...", deleted: true }`

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8787/api/v1/durable-memory/records/rec-001/delete
```

---

## Proposals

### `POST /api/v1/durable-memory/proposals`

Create a memory write proposal (a suggested change pending operator approval).

**Required role**: `Operator` or `Admin`  
**Request body**: Same as `POST /api/v1/durable-memory/records`

**Response** (`201`): Created proposal.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"namespace": "team", "key": "coding-standards", "value": {"style": "oop"}}' \
  http://127.0.0.1:8787/api/v1/durable-memory/proposals
```

---

### `POST /api/v1/durable-memory/proposals/list`

List proposals.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Request body**: Same filters as `records/list`

**Response** (`200`): `{ items: [...], nextCursor? }`

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8787/api/v1/durable-memory/proposals/list
```

---

### `POST /api/v1/durable-memory/proposals/:id/approve`

Approve and apply a proposal.

**Required role**: `Operator` or `Admin`  
**Path params**: `id` — proposal ID  
**Request body**: `{}` (or with `comment`)

**Response** (`200`): Applied record.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"comment": "Approved by platform team"}' \
  http://127.0.0.1:8787/api/v1/durable-memory/proposals/prop-001/approve
```

---

### `POST /api/v1/durable-memory/proposals/:id/reject`

Reject a proposal (does not apply the change).

**Required role**: `Operator` or `Admin`  
**Path params**: `id` — proposal ID  
**Request body**: `{}` (or with `comment`)

**Response** (`200`): Updated proposal.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"comment": "Outdated"}' \
  http://127.0.0.1:8787/api/v1/durable-memory/proposals/prop-001/reject
```

---

### `POST /api/v1/durable-memory/proposals/:id/archive`

Archive a proposal (without approving or rejecting).

**Required role**: `Operator` or `Admin`  
**Path params**: `id` — proposal ID  
**Request body**: `{}` (or with `comment`)

**Response** (`200`): Updated proposal.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8787/api/v1/durable-memory/proposals/prop-001/archive
```

---

## Snapshots

### `POST /api/v1/durable-memory/snapshots`

Create a snapshot of all current durable memory records.

**Required role**: `Operator` or `Admin`  
**Request body**:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `label` | string | no | Human-readable snapshot label |

**Response** (`201`): Created snapshot record.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{"label": "Pre-migration backup"}' \
  http://127.0.0.1:8787/api/v1/durable-memory/snapshots
```

---

### `POST /api/v1/durable-memory/snapshots/list`

List snapshots.

**Required role**: `Viewer`, `Operator`, or `Admin`  
**Request body**: `{ cursor?, limit? }`

**Response** (`200`): `{ items: [...], nextCursor? }`

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8787/api/v1/durable-memory/snapshots/list
```

---

### `POST /api/v1/durable-memory/snapshots/:id/restore`

Restore durable memory to a snapshot. Replaces all current records with the snapshot contents.

**Required role**: `Operator` or `Admin`  
**Path params**: `id` — snapshot ID  
**Request body**: `{}` (or with `dryRun: true` to preview)

**Response** (`200`): Restore result with count of restored records.

**curl**:

```bash
curl -X POST \
  -H "Authorization: Bearer $ATHENA_AUTH_API_TOKEN" \
  -H "x-athena-identity: $USER" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:8787/api/v1/durable-memory/snapshots/snap-001/restore
```
