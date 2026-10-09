/**
 * SECP Industrial OS v2 — Baseline Truth Subsystem
 * Types, interfaces, and domain definitions for Phase 0 Baseline Truth.
 */

export type BaselineStatus =
  | 'WORKING'
  | 'FAILED'
  | 'UNPROVEN'
  | 'SIMULATED'
  | 'PRODUCTION_READY';

export type EvidenceType =
  | 'SOURCE'
  | 'TEST'
  | 'GATE'
  | 'EXECUTION'
  | 'BENCHMARK'
  | 'ARTIFACT'
  | 'EXTERNAL_VALIDATION';

export interface EvidenceReference {
  id: string;
  type: EvidenceType;
  reference: string;
  description: string;
  verified: boolean;
}

export interface CapabilityProvenance {
  sourceFiles: string[];
  tests: string[];
  gates: string[];
}

export interface CapabilityBaselineRecord {
  id: string;
  domain: string;
  capability: string;
  status: BaselineStatus;
  implementationEvidence: EvidenceReference[];
  executionEvidence: EvidenceReference[];
  testEvidence: EvidenceReference[];
  adversarialEvidence: EvidenceReference[];
  limitations: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  provenance: CapabilityProvenance;
  timestamp: string;
}

export interface BaselineTruthSummary {
  working: number;
  failed: number;
  unproven: number;
  simulated: number;
  productionReady: number;
}

export interface EvidenceCoverage {
  implementation: number;
  execution: number;
  tests: number;
  adversarial: number;
  externalValidation: number;
}

export interface BaselineTruthReportData {
  schemaVersion: string;
  generatedAt: string;
  summary: BaselineTruthSummary;
  capabilities: CapabilityBaselineRecord[];
  criticalFindings: string[];
  limitations: string[];
  evidenceCoverage: EvidenceCoverage;
}

export interface DomainCapabilitySpec {
  domain: string;
  capabilities: string[];
}

export const BASELINE_DOMAINS: DomainCapabilitySpec[] = [
  {
    domain: 'CAD',
    capabilities: [
      'Geometry',
      'B-Rep',
      'NURBS',
      'Boolean',
      'Topology Healing',
      'Parametric Modeling',
      'GCS',
      'Assembly',
      'STEP/AP242',
      'IGES',
      'JT'
    ]
  },
  {
    domain: 'PHYSICS',
    capabilities: [
      'Units',
      'Materials',
      'Mesh',
      'Solver Infrastructure',
      'Convergence',
      'Conservation'
    ]
  },
  {
    domain: 'CFD',
    capabilities: [
      'Finite Volume',
      'Flux',
      'Pressure-Velocity Coupling',
      'Linear Solvers',
      'Laminar Flow',
      'RANS',
      'Turbulence',
      'SST k-omega',
      'Compressible Flow',
      'Heat Transfer',
      'Transient CFD',
      'Mesh Independence',
      'Verification',
      'Validation'
    ]
  },
  {
    domain: 'FEM',
    capabilities: [
      'FEM Core',
      'Element Library',
      'Sparse Matrix',
      'Structural Solver',
      'Nonlinear Material',
      'Contact',
      'Large Deformation',
      'Thermal',
      'Modal',
      'Buckling',
      'Fatigue'
    ]
  },
  {
    domain: 'MATERIALS',
    capabilities: [
      'Material Ontology',
      'Material Database',
      'Temperature Dependence',
      'Plasticity',
      'Creep',
      'Fatigue',
      'Fracture',
      'Heat Treatment',
      'Provenance',
      'Uncertainty'
    ]
  },
  {
    domain: 'CAM',
    capabilities: [
      'Toolpath',
      '3-Axis',
      '5-Axis',
      'Kinematics',
      'Collision',
      'Post Processing',
      'G-code Verification',
      'Toolpath Simulation',
      'CAM Provenance'
    ]
  },
  {
    domain: 'PLM',
    capabilities: [
      'Assembly Graph',
      'BOM',
      'Revision',
      'ECO',
      'Change Impact',
      'Configuration',
      'Lifecycle Traceability'
    ]
  },
  {
    domain: 'DIGITAL TWIN',
    capabilities: [
      'Geometry Twin',
      'Physics Twin',
      'Manufacturing Twin',
      'Inspection Twin',
      'Telemetry',
      'State Synchronization'
    ]
  },
  {
    domain: 'AI',
    capabilities: [
      'Geometry Reasoning',
      'Physics Reasoning',
      'Diagnostics',
      'Root Cause',
      'Optimization',
      'Copilot',
      'Evidence-Constrained AI'
    ]
  },
  {
    domain: 'HPC',
    capabilities: [
      'Parallel Execution',
      'GPU',
      'WebGPU',
      'WASM',
      'Native HPC',
      'MPI',
      'Distributed CFD',
      'Distributed FEM',
      'Scaling'
    ]
  },
  {
    domain: 'FORENSIC ENGINEERING',
    capabilities: [
      'Evidence',
      'Hashing',
      'Provenance',
      'Chain of Custody',
      'Cryptographic Attestation',
      'Result Certification'
    ]
  }
];
