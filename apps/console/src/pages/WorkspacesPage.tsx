import { useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  useCreateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useUpdateWorkspaceMutation,
  useWorkspacesQuery,
  type Workspace,
} from "../features/workspaces";
import { ApiClientError } from "../services";
import { resolveAdvancedSurfaceNotice } from "./advancedSurfaceState";
import styles from "./PageScaffold.module.css";

type WorkspaceDraft = {
  id: string;
  name: string;
  slug: string;
};

const EMPTY_DRAFT: WorkspaceDraft = {
  id: "",
  name: "",
  slug: "",
};

function draftFromWorkspace(workspace: Workspace): WorkspaceDraft {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
  };
}

function createRequestFromDraft(draft: WorkspaceDraft): { id?: string; name: string; slug?: string } | undefined {
  const name = draft.name.trim();
  if (!name) {
    return undefined;
  }
  const id = draft.id.trim();
  const slug = draft.slug.trim();
  return {
    ...(id ? { id } : {}),
    name,
    ...(slug ? { slug } : {}),
  };
}

function updateRequestFromDraft(original: Workspace, draft: WorkspaceDraft): { name?: string; slug?: string } {
  const name = draft.name.trim();
  const slug = draft.slug.trim();
  return {
    ...(name && name !== original.name ? { name } : {}),
    ...(slug && slug !== original.slug ? { slug } : {}),
  };
}

export function WorkspacesPage() {
  const workspacesQuery = useWorkspacesQuery();
  const createMutation = useCreateWorkspaceMutation();
  const updateMutation = useUpdateWorkspaceMutation();
  const deleteMutation = useDeleteWorkspaceMutation();

  const [createDraft, setCreateDraft] = useState<WorkspaceDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<WorkspaceDraft>(EMPTY_DRAFT);
  const [message, setMessage] = useState<string | null>(null);

  const adminDenied = workspacesQuery.error instanceof ApiClientError && workspacesQuery.error.status === 403;
  const unavailableNotice = resolveAdvancedSurfaceNotice(workspacesQuery.error, "workspaces");
  const workspaces = useMemo(() => workspacesQuery.data?.workspaces ?? [], [workspacesQuery.data]);

  async function handleCreate(): Promise<void> {
    const request = createRequestFromDraft(createDraft);
    if (!request) {
      setMessage("Workspace name is required.");
      return;
    }
    try {
      const created = await createMutation.mutateAsync(request);
      setCreateDraft(EMPTY_DRAFT);
      setMessage(`Created workspace ${created.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create workspace.");
    }
  }

  function startEdit(workspace: Workspace): void {
    setEditingId(workspace.id);
    setEditDraft(draftFromWorkspace(workspace));
    setMessage(null);
  }

  async function handleSave(workspace: Workspace): Promise<void> {
    const request = updateRequestFromDraft(workspace, editDraft);
    if (!request.name && !request.slug) {
      setEditingId(null);
      return;
    }
    try {
      const updated = await updateMutation.mutateAsync({ id: workspace.id, request });
      setEditingId(null);
      setMessage(`Updated workspace ${updated.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update workspace.");
    }
  }

  async function handleDelete(workspace: Workspace): Promise<void> {
    try {
      const result = await deleteMutation.mutateAsync(workspace.id);
      setMessage(result.deleted ? `Deleted workspace ${workspace.name}.` : `Workspace ${workspace.name} was already removed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete workspace.");
    }
  }

  return (
    <section className={styles.page}>
      <p className={styles.lead}>
        Create and rename workspaces before assigning members and enforcing workspace-scoped access.
      </p>

      {unavailableNotice ? (
        <div className={styles.advancedNotice}>
          <h3>{unavailableNotice.title}</h3>
          <p>{unavailableNotice.body}</p>
          <p>{unavailableNotice.detail}</p>
        </div>
      ) : null}
      {adminDenied && !unavailableNotice ? <p>Workspace lifecycle management is restricted to administrators.</p> : null}

      {!unavailableNotice ? (
        <div className={styles.settingsPanel}>
          <div className={styles.settingsHeader}>
            <h3>Create Workspace</h3>
          </div>
          <div className={styles.inlineForm}>
            <label className={styles.policyField}>
              <span>Name</span>
              <input
                className={styles.settingsInput}
                value={createDraft.name}
                onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Platform Team"
              />
            </label>
            <label className={styles.policyField}>
              <span>Slug</span>
              <input
                className={styles.settingsInput}
                value={createDraft.slug}
                onChange={(event) => setCreateDraft((current) => ({ ...current, slug: event.target.value }))}
                placeholder="platform-team"
              />
            </label>
            <label className={styles.policyField}>
              <span>ID</span>
              <input
                className={styles.settingsInput}
                value={createDraft.id}
                onChange={(event) => setCreateDraft((current) => ({ ...current, id: event.target.value }))}
                placeholder="workspace-platform"
              />
            </label>
            <button
              type="button"
              className={styles.settingsButtonPrimary}
              onClick={() => {
                void handleCreate();
              }}
              disabled={adminDenied || createMutation.isPending}
              title="Create workspace"
            >
              <Plus size={16} aria-hidden />
              Create
            </button>
          </div>
          {message ? <p className={styles.settingsMuted}>{message}</p> : null}
        </div>
      ) : null}

      {!unavailableNotice ? (
        <div className={styles.settingsPanel}>
          <div className={styles.settingsHeader}>
            <h3>Workspaces</h3>
            <p className={styles.settingsMuted}>{workspacesQuery.data?.total ?? 0} total</p>
          </div>
          {workspacesQuery.isLoading ? <p>Loading workspaces...</p> : null}
          {workspacesQuery.error instanceof Error && !adminDenied ? <p>{workspacesQuery.error.message}</p> : null}
          <div className={styles.tableWrapper}>
            <table className={styles.settingsTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>ID</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {workspaces.map((workspace) => {
                  const isEditing = editingId === workspace.id;
                  const protectedDefault = workspace.id === "default";
                  return (
                    <tr key={workspace.id}>
                      <td>
                        {isEditing ? (
                          <input
                            className={styles.settingsInput}
                            value={editDraft.name}
                            onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))}
                          />
                        ) : (
                          workspace.name
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            className={styles.settingsInput}
                            value={editDraft.slug}
                            onChange={(event) => setEditDraft((current) => ({ ...current, slug: event.target.value }))}
                            disabled={protectedDefault}
                          />
                        ) : (
                          <span className={styles.mono}>{workspace.slug}</span>
                        )}
                      </td>
                      <td className={styles.mono}>{workspace.id}</td>
                      <td className={styles.mono}>{workspace.updatedAt}</td>
                      <td>
                        <div className={styles.settingsActionsStart}>
                          {isEditing ? (
                            <button
                              type="button"
                              className={styles.settingsButtonPrimary}
                              onClick={() => {
                                void handleSave(workspace);
                              }}
                              disabled={updateMutation.isPending}
                              title="Save workspace"
                            >
                              <Save size={16} aria-hidden />
                              Save
                            </button>
                          ) : (
                            <button type="button" className={styles.settingsButton} onClick={() => startEdit(workspace)}>
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.settingsButton}
                            onClick={() => {
                              void handleDelete(workspace);
                            }}
                            disabled={protectedDefault || deleteMutation.isPending}
                            title={protectedDefault ? "Default workspace is protected" : "Delete workspace"}
                          >
                            <Trash2 size={16} aria-hidden />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
