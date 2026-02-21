import type { Specialist, SpecialistDesignation } from './types';

/**
 * The Specialist Roster: Formalized technical designations with distinct toolsets and KPIs.
 */
export const SPECIALIST_ROSTER: Record<SpecialistDesignation, Specialist> = {
  'Reliability Specialist': {
    designation: 'Reliability Specialist',
    toolset: ['prometheus-metrics', 'grafana-dashboards', 'load-generator', 'p99-latency-benchmark'],
    kpi: 'Validates fix against performance benchmarks and ensures no regression in stability.',
  },
  'Bug Scrubber': {
    designation: 'Bug Scrubber',
    toolset: ['heap-dump-analyzer', 'deep-trace-logs', 'git-bisect', 'surgical-patcher'],
    kpi: 'Identifies the leak source, analyzes traces, and proposes surgical fixes.',
  },
  'Security Auditor': {
    designation: 'Security Auditor',
    toolset: ['owasp-top-10-scanner', 'penetration-test-suite', 'auth-policy-validator', 'compliance-auditor'],
    kpi: 'Verifies patch integrity and ensures no new vulnerabilities are introduced.',
  },
  'Strategic Architect': {
    designation: 'Strategic Architect',
    toolset: ['db-schema-designer', 'system-dependency-mapper', 'tech-roadmap-generator'],
    kpi: 'Interprets high-level goals into technical roadmaps and dependency graphs.',
  },
  'Systems Engineer': {
    designation: 'Systems Engineer',
    toolset: ['api-generator', 'database-migrator', 'service-provisioner'],
    kpi: 'Executes code implementation across the API and worker layers.',
  },
  'Verification Officer': {
    designation: 'Verification Officer',
    toolset: ['e2e-integration-suite', 'unit-test-validator', 'billing-accuracy-checker'],
    kpi: 'Conducts end-to-end integration testing and ensures functional accuracy.',
  },
};

/**
 * Commissions a specialist from the Hangar by designation.
 */
export const commissionSpecialist = (designation: SpecialistDesignation): Specialist => {
  const specialist = SPECIALIST_ROSTER[designation];
  if (!specialist) {
    throw new Error(`Specialist designation "${designation}" not found in The Hangar.`);
  }
  return { ...specialist };
};
