/**
 * SECP Industrial OS v3 — PROMPT-053: Capability Mirror Architecture Types
 * Defines the formal contracts and structures for Capability Resolution,
 * Frontend Mirror Projections, Contextual Applicability, and Capability Drift Detection.
 */

import { EngineeringDomain, CapabilityStatus, CapabilityMaturity } from './CapabilityTypes';
import { CapabilityTruthState } from '../cad-kernel/registry/CapabilityTruthGate';

export type CapabilityFidelityLevel = 'CANONICAL' | 'VERIFIED' | 'PARTIAL' | 'BYPASS' | 'UNSUPPORTED';

/**
 * Backend Capability Resolution
 * Represents the authoritative engineering capability evaluation returned by the Canonical Capability Resolver.
 */
export interface CapabilityResolution {
  capabilityId: string;
  name: string;
  domain: EngineeringDomain | string;
  backendStatus: CapabilityStatus;
  truthState: CapabilityTruthState;
  fidelity: CapabilityFidelityLevel;
  isClaimable: boolean;           // True ONLY if supported, connected, and verified by backend
  isImplemented: boolean;         // True if backend logic exists
  isConnected: boolean;           // True if connected to canonical UI/action adapter
  isVerified: boolean;            // True if verification test/evidence exists
  supportedScope: string[];
  unsupportedScope: string[];
  limitations: string[];
  evidenceRef?: string;
  explanation: string;
  lastEvaluatedAt: string;
}

/**
 * Workplace Context
 * Represents the current active runtime context in the UI (active document, selection, active sketch, geometry, etc.).
 */
export interface WorkplaceContext {
  activeWorkbench?: string;
  activeSketchId?: string;
  hasActiveSketchProfile?: boolean;
  selectedEntityCount?: number;
  selectedEntityTypes?: string[]; // e.g. ['FACE', 'EDGE', 'VERTEX', 'SOLID']
  has3DSolidBody?: boolean;
  assemblyInstanceCount?: number;
}

/**
 * Contextual Applicability
 * Distinguishes whether a capability is applicable in the CURRENT state vs whether it exists in backend.
 */
export interface ContextualApplicability {
  capabilityId: string;
  isApplicable: boolean;
  inapplicabilityReason?: string;
  requiredContextKeys: string[];
}

/**
 * Frontend Capability Mirror Projection
 * Read-only projection consumed directly by UI controls (toolbars, buttons, panels).
 */
export interface CapabilityMirrorProjection {
  capabilityId: string;
  name: string;
  domain: string;
  uiExposed: boolean;               // Should tool be shown in UI?
  uiEnabled: boolean;               // Should tool be clickable/interactive?
  badgeStatus: 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED' | 'UNAVAILABLE' | 'EXPERIMENTAL';
  truthState: CapabilityTruthState;
  contextApplicable: boolean;
  disabledReason?: string;
  backendExplanation: string;
  evidenceRef?: string;
  fidelity: CapabilityFidelityLevel;
}

/**
 * Capability Drift Violation
 * Generated when the Frontend attempts to claim or invoke a capability that Backend does NOT support or verify.
 */
export interface CapabilityDriftViolation {
  violationId: string;
  capabilityId: string;
  claimedBy: string;               // Component or action name
  claimedStatus: string;           // Status claimed by Frontend
  actualBackendTruth: CapabilityTruthState;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  message: string;
  timestamp: string;
}

/**
 * Capability Drift Report
 */
export interface CapabilityDriftReport {
  timestamp: string;
  totalAudited: number;
  driftCount: number;
  hasDrift: boolean;
  violations: CapabilityDriftViolation[];
  auditedCapabilities: {
    capabilityId: string;
    claimed: boolean;
    supported: boolean;
    truthState: CapabilityTruthState;
    inDrift: boolean;
  }[];
}
