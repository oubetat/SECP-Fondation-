/**
 * SECP CAD CORE — FROZEN ENGINEERING BASELINES
 * 
 * Baseline #1: SECP-045.1 — Real OCCT Assembly & Kinematics
 * Baseline #2: SECP-046   — Parametric Constraints & Causality
 * Baseline #3: SECP-047   — Feature History, Regeneration & Topological Stability
 * Baseline #4: SECP-048   — Design Intent & Engineering Semantics
 */

export interface FrozenBaselineRecord {
  id: string;
  name: string;
  status: 'FROZEN_LOCKED';
  gateClass: string;
  verificationHash: string;
}

export const FROZEN_ENGINEERING_BASELINES: Record<string, FrozenBaselineRecord> = {
  'SECP-045.1': {
    id: 'SECP-045.1',
    name: 'Real OCCT Assembly & Kinematics',
    status: 'FROZEN_LOCKED',
    gateClass: 'HardAcceptanceGate045',
    verificationHash: 'sha256-045-1-assembly-kinematics-verified'
  },
  'SECP-046': {
    id: 'SECP-046',
    name: 'Parametric Constraints & Causality',
    status: 'FROZEN_LOCKED',
    gateClass: 'HardAcceptanceGate046',
    verificationHash: 'sha256-046-parametric-causality-verified'
  },
  'SECP-047': {
    id: 'SECP-047',
    name: 'Feature History, Regeneration & Topological Stability',
    status: 'FROZEN_LOCKED',
    gateClass: 'HardAcceptanceGate047',
    verificationHash: 'sha256-047-feature-history-topo-stability-verified'
  },
  'SECP-048': {
    id: 'SECP-048',
    name: 'Design Intent & Engineering Semantics',
    status: 'FROZEN_LOCKED',
    gateClass: 'HardAcceptanceGate048',
    verificationHash: 'sha256-048-design-intent-semantics-verified'
  },
  'SECP-049': {
    id: 'SECP-049',
    name: 'Manufacturing Process Intelligence & Manufacturability',
    status: 'FROZEN_LOCKED',
    gateClass: 'HardAcceptanceGate049',
    verificationHash: 'sha256-049-manufacturing-intelligence-verified'
  },
  'SECP-050': {
    id: 'SECP-050',
    name: 'Final Engineering Validation, Decision & System Acceptance',
    status: 'FROZEN_LOCKED',
    gateClass: 'HardAcceptanceGate050',
    verificationHash: 'sha256-050-final-system-acceptance-verified'
  },
  'SECP-051': {
    id: 'SECP-051',
    name: 'Advanced Parametric Core & Design Variables Engine',
    status: 'FROZEN_LOCKED',
    gateClass: 'HardAcceptanceGate051',
    verificationHash: 'sha256-051-advanced-parametric-core-verified'
  },
  'SECP-052': {
    id: 'SECP-052',
    name: 'Advanced B-Rep Topology & Persistent Naming Engine',
    status: 'FROZEN_LOCKED',
    gateClass: 'HardAcceptanceGate052',
    verificationHash: 'sha256-052-advanced-brep-topology-verified'
  },
  'SECP-053': {
    id: 'SECP-053',
    name: 'Industrial Constraint & Variational Sketch Solver Engine',
    status: 'FROZEN_LOCKED',
    gateClass: 'HardAcceptanceGate053',
    verificationHash: 'sha256-053-industrial-constraint-solver-verified'
  },
  'SECP-054': {
    id: 'SECP-054',
    name: 'Industrial Surface & NURBS / Class-A Geometry Engine',
    status: 'FROZEN_LOCKED',
    gateClass: 'HardAcceptanceGate054',
    verificationHash: 'sha256-054-industrial-surface-nurbs-verified'
  },
  'SECP-055': {
    id: 'SECP-055',
    name: 'Advanced Assembly Engineering Engine',
    status: 'FROZEN_LOCKED',
    gateClass: 'HardAcceptanceGate055',
    verificationHash: 'sha256-055-advanced-assembly-engineering-verified'
  },
  'SECP-056': {
    id: 'SECP-056',
    name: 'Manufacturing Feature Intelligence & Process Planning Core',
    status: 'FROZEN_LOCKED',
    gateClass: 'HardAcceptanceGate056',
    verificationHash: 'sha256-056-mfg-feature-intelligence-process-planning-verified'
  }
};
