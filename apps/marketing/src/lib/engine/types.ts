/**
 * Core specialist designations available in The Hangar.
 */
export type SpecialistDesignation =
  | 'Reliability Specialist'
  | 'Bug Scrubber'
  | 'Security Auditor'
  | 'Strategic Architect'
  | 'Systems Engineer'
  | 'Verification Officer';

/**
 * A specialist unit with a specific technical designation and toolset.
 */
export interface Specialist {
  designation: SpecialistDesignation;
  toolset: string[];
  kpi: string;
}

/**
 * A curated selection of specialists and their mission parameters.
 */
export interface FlightManifest {
  objective: string;
  specialists: Specialist[];
  relayPath: string[];
}

/**
 * A comprehensive flight recorder for AI decisions and mission results.
 */
export interface EvidenceBundle {
  missionId: string;
  timestamp: string;
  seedPackage: {
    intent: string;
    context: Record<string, any>;
  };
  logicTrace: {
    event: string;
    specialist: SpecialistDesignation;
    timestamp: string;
    details: string;
  }[];
  relayState: {
    compoundedContext: Record<string, any>;
  };
  artifacts: {
    type: 'log' | 'benchmark' | 'pr' | 'audit-log';
    path: string;
    summary: string;
  }[];
  status: 'SUCCESS' | 'FAILURE' | 'PENDING';
}
