/**
 * SECP Industrial OS v2 — PATCH-157: Evidence Bus Types
 * Canonical type definitions for the Evidence Bus transport layer.
 */

import { EngineeringEventActor, EngineeringEventType } from '../event-model/types';
import { EngineeringObjectType } from '../../identity/CanonicalEngineeringIdentity';

export type ControlledEvidenceType =
  | 'INPUT_EVIDENCE'
  | 'GEOMETRY_EVIDENCE'
  | 'MESH_EVIDENCE'
  | 'SOLVER_EVIDENCE'
  | 'RESULT_EVIDENCE'
  | 'VERIFICATION_EVIDENCE'
  | 'VALIDATION_EVIDENCE'
  | 'PERFORMANCE_EVIDENCE'
  | 'MANUFACTURING_EVIDENCE'
  | 'PROVENANCE_EVIDENCE'
  | 'SECURITY_EVIDENCE'
  | 'WORKFLOW_EVIDENCE'
  | 'STATE_EVIDENCE'
  | 'REVISION_EVIDENCE'
  | 'IDENTITY_EVIDENCE'
  | 'CAPABILITY_EVIDENCE';

export const CONTROLLED_EVIDENCE_TYPES: readonly ControlledEvidenceType[] = Object.freeze([
  'INPUT_EVIDENCE',
  'GEOMETRY_EVIDENCE',
  'MESH_EVIDENCE',
  'SOLVER_EVIDENCE',
  'RESULT_EVIDENCE',
  'VERIFICATION_EVIDENCE',
  'VALIDATION_EVIDENCE',
  'PERFORMANCE_EVIDENCE',
  'MANUFACTURING_EVIDENCE',
  'PROVENANCE_EVIDENCE',
  'SECURITY_EVIDENCE',
  'WORKFLOW_EVIDENCE',
  'STATE_EVIDENCE',
  'REVISION_EVIDENCE',
  'IDENTITY_EVIDENCE',
  'CAPABILITY_EVIDENCE'
]);

export function isControlledEvidenceType(type: string): type is ControlledEvidenceType {
  return CONTROLLED_EVIDENCE_TYPES.includes(type as ControlledEvidenceType);
}

export type EvidencePublicationState =
  | 'PUBLISHED'
  | 'REJECTED'
  | 'QUARANTINED'
  | 'UNVERIFIED'
  | 'VERIFIED';

export type EvidenceVerificationState =
  | 'UNVERIFIED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'QUARANTINED';

export type EvidenceVerificationVerdict =
  | 'PASS'
  | 'FAIL'
  | 'UNPROVEN'
  | 'INCONCLUSIVE'
  | 'INVALID';

export type EvidenceBusErrorCode =
  | 'INVALID_EVIDENCE'
  | 'DUPLICATE_EVIDENCE'
  | 'UNKNOWN_SOURCE'
  | 'BROKEN_CORRELATION'
  | 'HASH_MISMATCH'
  | 'INVALID_SCHEMA'
  | 'UNAVAILABLE_SUBSCRIBER'
  | 'PERSISTENCE_FAILURE'
  | 'TAMPER_DETECTED'
  | 'UNKNOWN_CAPABILITY'
  | 'INVALID_WORKFLOW_CONTEXT'
  | 'CYCLE_DETECTED';

export interface EvidenceEnvelopeIdentity {
  readonly evidenceId: string;
  readonly sequence: number;
  readonly runSequence?: number;
  readonly timestamp: string;
  readonly schemaVersion: string;
}

export interface EvidenceEnvelopeProvenance {
  readonly sourceCapability: string;
  readonly sourceOperation: string;
  readonly producerType: 'ENGINE' | 'SOLVER' | 'WORKFLOW' | 'VERIFIER' | 'OPERATOR' | 'SYSTEM' | 'AI';
  readonly producerId: string;
  readonly engineVersion?: string;
  readonly author?: string;
  readonly environment?: string;
}

export interface EvidenceEnvelopeIntegrity {
  readonly hashAlgorithm: 'SHA-256' | 'SHA-512';
  readonly payloadHash: string;
  readonly envelopeHash: string;
  readonly signature?: string;
  readonly previousEvidenceHash?: string;
  readonly chainHeight: number;
}

export interface EvidenceEnvelopeCorrelation {
  readonly correlationId: string;
  readonly eventId?: string;
  readonly workflowId?: string;
  readonly runId?: string;
  readonly taskId?: string;
  readonly engineeringObjectId?: string;
  readonly subjectIdentityId?: string;
  readonly sourceIdentityId?: string;
  readonly producerIdentityId?: string;
  readonly parentEvidenceId?: string;
  readonly causationId?: string;
  readonly tags?: readonly string[];
}

export interface EvidenceEnvelopeCheck {
  readonly checkId: string;
  readonly name: string;
  readonly status: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE';
  readonly details?: string;
  readonly timestamp: string;
}

export interface EvidenceEnvelopeVerification {
  readonly state: EvidenceVerificationState;
  readonly verifiedAt?: string;
  readonly verifierId?: string;
  readonly verifierVersion?: string;
  readonly checks: readonly EvidenceEnvelopeCheck[];
  readonly reason?: string;
}

/**
 * Canonical Immutable Evidence Envelope
 */
export interface EvidenceEnvelope {
  readonly evidenceId: string;
  readonly evidenceType: ControlledEvidenceType;
  readonly identity: Readonly<EvidenceEnvelopeIdentity>;
  readonly provenance: Readonly<EvidenceEnvelopeProvenance>;
  readonly correlation: Readonly<EvidenceEnvelopeCorrelation>;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly integrity: Readonly<EvidenceEnvelopeIntegrity>;
  readonly verification: Readonly<EvidenceEnvelopeVerification>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface EvidencePublishRequest {
  readonly evidenceId?: string;
  readonly evidenceType: ControlledEvidenceType;
  readonly sourceCapability: string;
  readonly sourceOperation: string;
  readonly producerType?: 'ENGINE' | 'SOLVER' | 'WORKFLOW' | 'VERIFIER' | 'OPERATOR' | 'SYSTEM' | 'AI';
  readonly producerId?: string;
  readonly engineVersion?: string;
  readonly author?: string;
  readonly environment?: string;
  readonly engineeringObjectId?: string;
  readonly subjectIdentityId?: string;
  readonly sourceIdentityId?: string;
  readonly producerIdentityId?: string;
  readonly eventId?: string;
  readonly workflowId?: string;
  readonly runId?: string;
  readonly taskId?: string;
  readonly parentEvidenceId?: string;
  readonly causationId?: string;
  readonly correlationId?: string;
  readonly tags?: readonly string[];
  readonly payload: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

export interface EvidencePublishResult {
  readonly success: boolean;
  readonly evidenceId: string;
  readonly sequence: number;
  readonly publicationState: EvidencePublicationState;
  readonly envelope?: EvidenceEnvelope;
  readonly errorCode?: EvidenceBusErrorCode;
  readonly errorMessage?: string;
  readonly routingSummary?: {
    readonly subscribersNotified: number;
    readonly deliveryErrors: number;
  };
}

export type EvidencePredicate = (evidence: EvidenceEnvelope) => boolean;

export interface EvidenceFilter {
  readonly evidenceType?: ControlledEvidenceType | readonly ControlledEvidenceType[];
  readonly sourceCapability?: string | readonly string[];
  readonly sourceOperation?: string;
  readonly engineeringObjectId?: string;
  readonly subjectIdentityId?: string;
  readonly sourceIdentityId?: string;
  readonly producerIdentityId?: string;
  readonly workflowId?: string;
  readonly runId?: string;
  readonly eventId?: string;
  readonly parentEvidenceId?: string;
  readonly correlationId?: string;
  readonly tag?: string;
  readonly minSequence?: number;
  readonly maxSequence?: number;
  readonly startTime?: string;
  readonly endTime?: string;
}

export type EvidenceHandler = (evidence: EvidenceEnvelope) => void | Promise<void>;

export interface EvidenceSubscription {
  readonly subscriptionId: string;
  readonly filter: EvidenceFilter | EvidencePredicate;
  readonly handler: EvidenceHandler;
  readonly createdAt: string;
  readonly unsubscribe: () => boolean;
}

export interface EvidenceRoutingResult {
  readonly evidenceId: string;
  readonly matchedSubscriptions: number;
  readonly successfulDeliveries: number;
  readonly failedDeliveries: number;
  readonly errors: readonly { readonly subscriptionId: string; readonly error: string }[];
}

export interface EvidenceVerificationResult {
  readonly valid: boolean;
  readonly verificationState: EvidenceVerificationState;
  readonly evidenceId: string;
  readonly payloadHashMatch: boolean;
  readonly envelopeHashMatch: boolean;
  readonly parentEvidenceValid?: boolean;
  readonly capabilityValid?: boolean;
  readonly eventCorrelationValid?: boolean;
  readonly checks: readonly EvidenceEnvelopeCheck[];
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface EvidenceQueryCriteria extends EvidenceFilter {
  readonly limit?: number;
  readonly offset?: number;
  readonly sortDirection?: 'ASC' | 'DESC';
}

export interface QuarantinedEvidence {
  readonly evidenceId: string;
  readonly rawPayload: unknown;
  readonly quarantinedAt: string;
  readonly reason: string;
  readonly errorCode: EvidenceBusErrorCode;
}

export interface EvidenceBusStats {
  readonly totalPublished: number;
  readonly totalQuarantined: number;
  readonly totalRejected: number;
  readonly activeSubscriptions: number;
  readonly globalSequence: number;
  readonly chainHeight: number;
  readonly averagePublishLatencyMs: number;
  readonly memoryFootprintBytes: number;
}
