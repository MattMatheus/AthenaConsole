import type { AthenaConfig } from "../../shared/config.js";
import type {
  IdentityRoleAssignment,
  IdentityRoleAssignmentUpsertRequest,
  IdentityRoleAuditResult
} from "../../shared/contracts.js";
import type { EventService, IdentityService } from "../interfaces.js";
import { IdentityAssignmentStore } from "../identity-store.js";
import { getPermissionsForRole, listRbacRoles } from "../rbac.js";

export class LocalIdentityService implements IdentityService {
  private readonly store: IdentityAssignmentStore;

  constructor(
    private readonly config: AthenaConfig,
    private readonly eventService: EventService
  ) {
    this.store = new IdentityAssignmentStore(config);
  }

  listRoles() {
    return Promise.resolve(listRbacRoles());
  }

  listAssignments() {
    return this.store.list();
  }

  async upsertAssignment(request: IdentityRoleAssignmentUpsertRequest): Promise<IdentityRoleAssignment> {
    const result = await this.store.upsert(request);
    await this.eventService.emit({
      type: "rbac.assignment.upserted",
      payload: {
        schemaVersion: 1,
        subject: result.assignment.subject,
        subjectType: result.assignment.subjectType,
        role: result.assignment.role,
        createdAt: result.assignment.createdAt,
        updatedAt: result.assignment.updatedAt,
        ...(result.assignment.updatedBy ? { updatedBy: result.assignment.updatedBy } : {}),
        ...(result.previous
          ? {
              previous: {
                role: result.previous.role,
                updatedAt: result.previous.updatedAt,
                ...(result.previous.updatedBy ? { updatedBy: result.previous.updatedBy } : {})
              }
            }
          : {})
      }
    });
    return result.assignment;
  }

  async removeAssignment(subject: string): Promise<{ subject: string; removed: boolean }> {
    const result = await this.store.remove(subject);
    if (result.removed) {
      await this.eventService.emit({
        type: "rbac.assignment.removed",
        payload: {
          schemaVersion: 1,
          subject: result.previous?.subject ?? subject.trim(),
          ...(result.previous
            ? {
                previous: {
                  subjectType: result.previous.subjectType,
                  role: result.previous.role,
                  createdAt: result.previous.createdAt,
                  updatedAt: result.previous.updatedAt,
                  ...(result.previous.updatedBy ? { updatedBy: result.previous.updatedBy } : {})
                }
              }
            : {})
        }
      });
    }
    return {
      subject: subject.trim(),
      removed: result.removed
    };
  }

  async auditPermissions(subject: string): Promise<IdentityRoleAuditResult> {
    const normalized = subject.trim();
    const persisted = this.store.resolveSync(normalized);
    const configured = this.config.auth?.identityRoleMap[normalized];
    const wildcard = this.config.auth?.identityRoleMap["*"];
    const defaultRole = this.config.auth?.defaultRole ?? "Viewer";
    const role = persisted?.role ?? configured ?? wildcard ?? defaultRole;
    const source = persisted ? "persisted" : configured || wildcard ? "configured" : "default";
    return {
      subject: normalized,
      role,
      source,
      permissions: getPermissionsForRole(role),
      scope: {
        global: role === "Admin",
        personas: [],
        sessionIds: [],
        runIds: []
      },
      ...(persisted ? { assignment: persisted } : {})
    };
  }
}
