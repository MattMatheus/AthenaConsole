<!-- AUDIENCE: Internal/Technical -->

# Chroma Semantic Memory Adapter

Team Orchestrator treats Chroma as an optional semantic index adapter for durable memory. Chroma is not the canonical durable memory record store.

Canonical durable memory records, namespace/provenance checks, proposals, archive/delete, snapshots, cache status, and audit behavior remain owned by Team Orchestrator durable-memory services. The Chroma adapter stores searchable document text and bounded metadata needed to resolve semantic matches back to canonical memory record ids.

## Local Smoke Shape

1. Run a local Chroma server using the deployment mode selected for your environment.
2. Configure the adapter with:
   - `baseUrl`: Chroma server URL.
   - `collectionName`: semantic index collection, for example `team_orchestrator_memory`.
3. Upsert canonical durable-memory records into the collection through the adapter.
4. Query by namespace using canonical `namespace_scope` and `namespace_id` filters.
5. Treat adapter unavailability or unsupported filters as degraded semantic retrieval and fall back to durable-memory keyword retrieval.

The adapter must not store provider credentials, connector secrets, raw transcript bodies, raw artifact payloads, or raw vectors in Team Orchestrator API responses.

## Expected Metadata

The adapter writes bounded metadata:

- `memory_id`
- `namespace_scope`
- `namespace_id`
- `source_kind`
- `memory_type`
- `sensitivity`
- `status`
- `updated_at`

This metadata is used for filtering and lookup only. It is not the product memory model.
