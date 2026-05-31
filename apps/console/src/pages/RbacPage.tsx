import { useState } from "react";
import {
  useIdentityPermissionAuditMutation,
  useIdentityRoleAssignmentsQuery,
  useRbacRolesQuery,
  useRemoveIdentityRoleAssignmentMutation,
  useUpsertIdentityRoleAssignmentMutation
} from "../features/rbac";
import { ApiClientError } from "../services";
import styles from "./PageScaffold.module.css";

type RoleValue = "Viewer" | "Operator" | "Admin";
type SubjectTypeValue = "identity" | "service-token";

export function RbacPage() {
  const rolesQuery = useRbacRolesQuery();
  const assignmentsQuery = useIdentityRoleAssignmentsQuery();
  const upsertMutation = useUpsertIdentityRoleAssignmentMutation();
  const removeMutation = useRemoveIdentityRoleAssignmentMutation();
  const auditMutation = useIdentityPermissionAuditMutation();

  const [subject, setSubject] = useState("");
  const [subjectType, setSubjectType] = useState<SubjectTypeValue>("identity");
  const [role, setRole] = useState<RoleValue>("Viewer");
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const [auditSubject, setAuditSubject] = useState("");

  const adminDenied =
    (rolesQuery.error instanceof ApiClientError && rolesQuery.error.status === 403) ||
    (assignmentsQuery.error instanceof ApiClientError && assignmentsQuery.error.status === 403);

  async function handleAssign(): Promise<void> {
    const normalized = subject.trim();
    if (!normalized) {
      setAssignmentMessage("Subject is required.");
      return;
    }
    try {
      await upsertMutation.mutateAsync({
        subject: normalized,
        subjectType,
        role
      });
      setAssignmentMessage(`Assignment saved for ${normalized}.`);
      setSubject("");
    } catch (error) {
      setAssignmentMessage(error instanceof Error ? error.message : "Failed to save assignment.");
    }
  }

  async function handleRemove(targetSubject: string): Promise<void> {
    try {
      const result = await removeMutation.mutateAsync(targetSubject);
      setAssignmentMessage(result.removed ? `Removed assignment for ${targetSubject}.` : `No assignment found for ${targetSubject}.`);
    } catch (error) {
      setAssignmentMessage(error instanceof Error ? error.message : "Failed to remove assignment.");
    }
  }

  async function handleAudit(): Promise<void> {
    const normalized = auditSubject.trim();
    if (!normalized) {
      return;
    }
    await auditMutation.mutateAsync(normalized);
  }

  return (
    <section className={styles.page}>
      <h2>Access Control</h2>
      <p className={styles.lead}>
        Manage role-based access control (RBAC) for identities and service tokens, then audit the permissions an operator receives.
      </p>
      {adminDenied ? <p>Access control management is restricted to bootstrap or high-privilege administrators.</p> : null}

      <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h3>Roles and Permissions</h3>
        </div>
        {rolesQuery.isLoading ? <p>Loading roles...</p> : null}
        {rolesQuery.error instanceof Error && !adminDenied ? <p>{rolesQuery.error.message}</p> : null}
        <div className={styles.tableWrapper}>
          <table className={styles.settingsTable}>
            <thead>
              <tr>
                <th>Role</th>
                <th>Permission Strings</th>
              </tr>
            </thead>
            <tbody>
              {(rolesQuery.data ?? []).map((item) => (
                <tr key={item.name}>
                  <td className={styles.mono}>{item.name}</td>
                  <td>
                    <ul className={styles.permissionList}>
                      {item.permissions.map((permission) => (
                        <li key={`${item.name}-${permission}`} className={styles.permissionChip}>
                          {permission}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h3>Assignments</h3>
        </div>
        <div className={styles.inlineForm}>
          <label className={styles.policyField}>
            <span>Subject</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className={styles.settingsInput}
              placeholder="alice or svc-control"
            />
          </label>
          <label className={styles.policyField}>
            <span>Type</span>
            <select
              value={subjectType}
              onChange={(event) => setSubjectType(event.target.value as SubjectTypeValue)}
              className={styles.settingsInput}
            >
              <option value="identity">Identity</option>
              <option value="service-token">Service Token</option>
            </select>
          </label>
          <label className={styles.policyField}>
            <span>Role</span>
            <select value={role} onChange={(event) => setRole(event.target.value as RoleValue)} className={styles.settingsInput}>
              <option value="Viewer">Viewer</option>
              <option value="Operator">Operator</option>
              <option value="Admin">Admin</option>
            </select>
          </label>
          <button
            type="button"
            className={styles.settingsButtonPrimary}
            onClick={() => {
              void handleAssign();
            }}
            disabled={adminDenied || upsertMutation.isPending}
          >
            Assign
          </button>
        </div>
        {assignmentMessage ? <p className={styles.settingsMuted}>{assignmentMessage}</p> : null}
        {assignmentsQuery.isLoading ? <p>Loading assignments...</p> : null}
        {assignmentsQuery.error instanceof Error && !adminDenied ? <p>{assignmentsQuery.error.message}</p> : null}
        <div className={styles.tableWrapper}>
          <table className={styles.settingsTable}>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Type</th>
                <th>Role</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(assignmentsQuery.data ?? []).map((item) => (
                <tr key={item.subject}>
                  <td className={styles.mono}>{item.subject}</td>
                  <td>{item.subjectType}</td>
                  <td>{item.role}</td>
                  <td className={styles.mono}>{item.updatedAt}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.settingsButton}
                      onClick={() => {
                        void handleRemove(item.subject);
                      }}
                      disabled={adminDenied || removeMutation.isPending}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h3>Permission Audit</h3>
        </div>
        <div className={styles.inlineForm}>
          <label className={styles.policyField}>
            <span>Subject</span>
            <input
              value={auditSubject}
              onChange={(event) => setAuditSubject(event.target.value)}
              className={styles.settingsInput}
              placeholder="subject to resolve"
            />
          </label>
          <div />
          <div />
          <button
            type="button"
            className={styles.settingsButtonPrimary}
            onClick={() => {
              void handleAudit();
            }}
            disabled={adminDenied || auditMutation.isPending || auditSubject.trim().length === 0}
          >
            Audit
          </button>
        </div>
        {auditMutation.error instanceof Error ? <p>{auditMutation.error.message}</p> : null}
        {auditMutation.data ? (
          <>
            <p className={styles.settingsMuted}>
              Effective Role: <span className={styles.mono}>{auditMutation.data.role}</span> | Source:{" "}
              <span className={styles.mono}>{auditMutation.data.source}</span>
            </p>
            <ul className={styles.scopeList}>
              <li>
                <p className={styles.scopeLabel}>Global Scope</p>
                <p className={styles.scopeValue}>{String(auditMutation.data.scope.global)}</p>
              </li>
              <li>
                <p className={styles.scopeLabel}>Operator Profiles</p>
                <p className={styles.scopeValue}>
                  {auditMutation.data.scope.agents.length > 0 ? auditMutation.data.scope.agents.join(", ") : "none"}
                </p>
              </li>
              <li>
                <p className={styles.scopeLabel}>Sessions</p>
                <p className={styles.scopeValue}>
                  {auditMutation.data.scope.sessionIds.length > 0 ? auditMutation.data.scope.sessionIds.join(", ") : "none"}
                </p>
              </li>
            </ul>
            <ul className={styles.permissionList}>
              {auditMutation.data.permissions.map((permission) => (
                <li key={`audit-${permission}`} className={styles.permissionChip}>
                  {permission}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  );
}
