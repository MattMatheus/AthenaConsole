import type { EvidenceBundle, FlightManifest, SpecialistDesignation } from './types';

/**
 * The Evidence Bundle: A flight recorder for AI decisions and mission results.
 */
export const createEvidenceBundle = (manifest: FlightManifest): EvidenceBundle => {
  return {
    missionId: `mission-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    seedPackage: {
      intent: manifest.objective,
      context: {
        specialists: manifest.specialists.map((s) => s.designation),
        relayPath: manifest.relayPath,
      },
    },
    logicTrace: [],
    relayState: {
      compoundedContext: {},
    },
    artifacts: [],
    status: 'PENDING',
  };
};

/**
 * Appends a logic trace entry to the mission's Evidence Bundle.
 */
export const appendTrace = (bundle: EvidenceBundle, event: string, specialist: SpecialistDesignation, details: string): void => {
  bundle.logicTrace.push({
    event,
    specialist,
    timestamp: new Date().toISOString(),
    details,
  });
};

/**
 * Archives a mission artifact in the Evidence Bundle.
 */
export const archiveArtifact = (
  bundle: EvidenceBundle,
  type: 'log' | 'benchmark' | 'pr' | 'audit-log',
  path: string,
  summary: string,
): void => {
  bundle.artifacts.push({
    type,
    path,
    summary,
  });
};

/**
 * Finalizes the Evidence Bundle with a mission status.
 */
export const finalizeBundle = (bundle: EvidenceBundle, success: boolean = true): EvidenceBundle => {
  bundle.status = success ? 'SUCCESS' : 'FAILURE';
  bundle.timestamp = new Date().toISOString();
  return { ...bundle };
};
