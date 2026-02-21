import type { FlightManifest } from './types';
import { commissionSpecialist } from './roster';

/**
 * Athena's Manifest Engine: Proposes a curated flight manifest based on strategic intent.
 * This simulates the core strategic logic for assembling specialist units.
 */
export const proposeManifest = (objective: string): FlightManifest => {
  const normalizedObjective = objective.toLowerCase();

  // Athena's interpretation heuristics
  if (normalizedObjective.includes('hotfix') || normalizedObjective.includes('memory leak') || normalizedObjective.includes('critical fix')) {
    return {
      objective,
      specialists: [
        commissionSpecialist('Bug Scrubber'),
        commissionSpecialist('Reliability Specialist'),
        commissionSpecialist('Security Auditor'),
      ],
      relayPath: ['Interpretation', 'Execution', 'Verification', 'Final Audit', 'Briefing'],
    };
  }

  if (normalizedObjective.includes('feature launch') || normalizedObjective.includes('module') || normalizedObjective.includes('billing')) {
    return {
      objective,
      specialists: [
        commissionSpecialist('Strategic Architect'),
        commissionSpecialist('Systems Engineer'),
        commissionSpecialist('Verification Officer'),
      ],
      relayPath: ['Interpretation', 'Execution', 'Relay', 'Verification', 'Briefing'],
    };
  }

  if (normalizedObjective.includes('security hardening') || normalizedObjective.includes('owasp') || normalizedObjective.includes('harden')) {
    return {
      objective,
      specialists: [
        commissionSpecialist('Security Auditor'),
        commissionSpecialist('Reliability Specialist'),
        commissionSpecialist('Bug Scrubber'),
      ],
      relayPath: ['Interpretation', 'Execution', 'Action', 'Monitoring', 'Briefing'],
    };
  }

  // Default "General Mission" manifest
  return {
    objective,
    specialists: [
      commissionSpecialist('Strategic Architect'),
      commissionSpecialist('Systems Engineer'),
      commissionSpecialist('Verification Officer'),
    ],
    relayPath: ['Interpretation', 'Execution', 'Verification', 'Briefing'],
  };
};
