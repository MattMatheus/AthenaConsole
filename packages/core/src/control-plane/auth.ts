import { AsyncLocalStorage } from "node:async_hooks";
import { AthenaError } from "../runtime/errors.js";
import type { AthenaConfig } from "../shared/config.js";
import type { AthenaRbacRole } from "../shared/contracts.js";
import { IdentityAssignmentStore } from "./identity-store.js";

export interface ScopeSet {
  global: boolean;
  agents: string[];
  sessionIds: string[];
  runIds: string[];
  workspaces?: string[];
}

export interface WorkspaceMembership {
  workspaceId: string;
  role: AthenaRbacRole;
}

export interface RequestAuthContext {
  subject: string;
  role: AthenaRbacRole;
  scope: ScopeSet;
  workspaceMemberships?: WorkspaceMembership[];
}

export interface IdentityRoleResolver {
  resolve(identity: string): RequestAuthContext;
}

class ConfigIdentityRoleResolver implements IdentityRoleResolver {
  private readonly assignmentStore: IdentityAssignmentStore;

  constructor(private readonly config: AthenaConfig) {
    this.assignmentStore = new IdentityAssignmentStore(config);
  }

  resolve(identity: string): RequestAuthContext {
    const subject = normalizeAuthSubject(identity);
    if (!subject) {
      throw new AthenaError("AUTH_IDENTITY_MISSING", "Request identity header is empty.");
    }
    const persistedAssignment = this.assignmentStore.resolveSync(subject);
    const role =
      persistedAssignment?.role ??
      this.config.auth?.identityRoleMap[subject] ??
      this.config.auth?.identityRoleMap["*"] ??
      this.config.auth?.defaultRole ??
      "Viewer";
    return {
      subject,
      role,
      scope: {
        global: role === "Admin",
        agents: [],
        sessionIds: [],
        runIds: [],
        workspaces: []
      }
    };
  }

}

const requestAuthStorage = new AsyncLocalStorage<RequestAuthContext>();

export function createIdentityRoleResolver(config: AthenaConfig): IdentityRoleResolver {
  return new ConfigIdentityRoleResolver(config);
}

export function normalizeAuthSubject(subject: string): string {
  return subject.trim();
}

export function withRequestAuthContext<T>(context: RequestAuthContext, callback: () => Promise<T>): Promise<T> {
  return requestAuthStorage.run(context, callback);
}

export function getRequestAuthContext(): RequestAuthContext | undefined {
  return requestAuthStorage.getStore();
}
