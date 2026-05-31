import { ApiClientError } from "../services";

export type AdvancedSurfaceId = "audit-trail" | "rbac" | "failed-work";

export type AdvancedSurfaceNotice = {
  title: string;
  body: string;
  detail: string;
};

type SurfaceCopy = {
  featureName: string;
  localProfileMessage: string;
};

const SURFACE_COPY: Record<AdvancedSurfaceId, SurfaceCopy> = {
  "audit-trail": {
    featureName: "Audit Trail",
    localProfileMessage:
      "Audit history depends on governance event APIs that may be disabled in lightweight local profiles.",
  },
  rbac: {
    featureName: "Access Control",
    localProfileMessage:
      "Role and assignment management depends on RBAC APIs that may be disabled in lightweight local profiles.",
  },
  "failed-work": {
    featureName: "Failed Work",
    localProfileMessage:
      "Failed-work recovery depends on recovery queue APIs that may be disabled when the local server has no recovery backend configured.",
  },
};

export function resolveAdvancedSurfaceNotice(
  error: unknown,
  surface: AdvancedSurfaceId,
): AdvancedSurfaceNotice | undefined {
  if (!(error instanceof ApiClientError)) {
    return undefined;
  }

  const copy = SURFACE_COPY[surface];

  if (error.status === 403) {
    return {
      title: `${copy.featureName} is restricted`,
      body: "This admin surface is present, but the current identity is not allowed to read or change it.",
      detail: "Use a bootstrap or high-privilege administrator identity for this surface.",
    };
  }

  if (error.status === 404 || error.status === 501) {
    return {
      title: `${copy.featureName} is not available in this local profile`,
      body: copy.localProfileMessage,
      detail:
        "This does not block the primary local operator loop. You can still create work, run agents, inspect runs, and review artifacts from the main workflow surfaces.",
    };
  }

  return undefined;
}
