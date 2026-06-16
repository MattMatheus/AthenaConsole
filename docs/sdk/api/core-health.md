<!-- AUDIENCE: Engineer/SDK -->

# Core and Health

**Route family**: `core`  
**No authentication required** for any endpoint in this family.

---

## Endpoints

### `GET /api/v1/health`

Liveness probe. Returns `{ status: "ok", now: "<ISO timestamp>" }`.

**Required role**: none  
**Query params**: none

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "now": "2026-06-15T12:00:00.000Z"
  }
}
```

**curl**:

```bash
curl http://127.0.0.1:8787/api/v1/health
```

---

### `GET /api/v1/readiness`

Readiness probe. Returns the server's readiness state including backing store status.

**Required role**: none  
**Query params**: none

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "ready": true
  }
}
```

**curl**:

```bash
curl http://127.0.0.1:8787/api/v1/readiness
```

---

### `GET /api/v1/admin/health`

Health plus state-store diagnostics. Intended for operators monitoring backing store status.

**Required role**: none  
**Query params**: none

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "now": "2026-06-15T12:00:00.000Z",
    "stateStores": {
      "sqlite": "ok"
    }
  }
}
```

**curl**:

```bash
curl http://127.0.0.1:8787/api/v1/admin/health
```

---

### `GET /api/v1/capabilities`

Returns server capability flags indicating which optional backends are active.

**Required role**: none  
**Query params**: none

**Response** (`200`):

```json
{
  "ok": true,
  "data": {
    "executionBackend": "local",
    "stateStore": "file",
    "supportsPods": false,
    "supportsCpuMemMetrics": false,
    "supportsSandbox": false,
    "supportsA2ABus": false
  }
}
```

**curl**:

```bash
curl http://127.0.0.1:8787/api/v1/capabilities
```
