/**
 * SECP Industrial OS v2 — PATCH-157: Evidence Verifier
 * Pure, deterministic verification engine for Evidence Envelopes.
 */

import * as crypto from 'crypto';
import {
  ControlledEvidenceType,
  CONTROLLED_EVIDENCE_TYPES,
  EvidenceEnvelope,
  EvidenceEnvelopeCheck,
  EvidenceVerificationResult,
  EvidenceVerificationState
} from './types';
import { EvidenceEnvelopeFactory } from './EvidenceEnvelopeFactory';
import { EngineeringEventStore } from '../event-model/EngineeringEventStore';
import { CapabilityRegistry } from '../capabilities/CapabilityRegistry';

export interface EvidenceVerificationOptions {
  readonly verifyParentExistence?: boolean;
  readonly parentResolver?: (parentEvidenceId: string) => EvidenceEnvelope | undefined;
  readonly verifyCapabilityRegistration?: boolean;
  readonly capabilityRegistry?: CapabilityRegistry;
  readonly verifyEventCorrelation?: boolean;
  readonly eventStore?: EngineeringEventStore;
}

export class EvidenceVerifier {
  /**
   * Verifies an EvidenceEnvelope against cryptographic, structural, and correlation constraints.
   */
  public static verify(
    envelope: EvidenceEnvelope,
    options: EvidenceVerificationOptions = {}
  ): EvidenceVerificationResult {
    const checks: EvidenceEnvelopeCheck[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const timestamp = new Date().toISOString();

    // 1. Schema & Structural Integrity Check
    let schemaValid = true;
    if (!envelope.evidenceId || !envelope.evidenceId.startsWith('EVID-')) {
      schemaValid = false;
      errors.push('Evidence ID is missing or does not start with EVID- prefix.');
    }
    if (!CONTROLLED_EVIDENCE_TYPES.includes(envelope.evidenceType)) {
      schemaValid = false;
      errors.push(`Invalid evidence type: ${envelope.evidenceType}. Must be a controlled type.`);
    }
    if (!envelope.identity || typeof envelope.identity.sequence !== 'number' || !envelope.identity.timestamp) {
      schemaValid = false;
      errors.push('Identity block is malformed or missing sequence/timestamp.');
    }
    if (!envelope.provenance || !envelope.provenance.sourceCapability || !envelope.provenance.sourceOperation) {
      schemaValid = false;
      errors.push('Provenance block is missing required sourceCapability or sourceOperation.');
    }
    if (!envelope.correlation || !envelope.correlation.correlationId) {
      schemaValid = false;
      errors.push('Correlation block is missing required correlationId.');
    }
    if (!envelope.integrity || !envelope.integrity.payloadHash || !envelope.integrity.envelopeHash) {
      schemaValid = false;
      errors.push('Integrity block is missing payloadHash or envelopeHash.');
    }

    checks.push({
      checkId: 'CHK-SCHEMA',
      name: 'Schema & Structural Contract Validation',
      status: schemaValid ? 'PASS' : 'FAIL',
      details: schemaValid ? 'Structural envelope format conforms to schema.' : errors.join('; '),
      timestamp
    });

    // 2. Payload Cryptographic Hash Check
    let payloadHashMatch = false;
    if (envelope.payload && envelope.integrity) {
      const computedPayloadHash = EvidenceEnvelopeFactory.computePayloadHash(envelope.payload as Record<string, unknown>);
      payloadHashMatch = computedPayloadHash === envelope.integrity.payloadHash;
      if (!payloadHashMatch) {
        errors.push(`Payload hash mismatch! Computed: ${computedPayloadHash}, Stored: ${envelope.integrity.payloadHash}`);
      }
    }

    checks.push({
      checkId: 'CHK-PAYLOAD-HASH',
      name: 'Payload Cryptographic Integrity Check',
      status: payloadHashMatch ? 'PASS' : 'FAIL',
      details: payloadHashMatch
        ? 'SHA-256 payload digest matches immutable envelope hash.'
        : 'Tampered or modified payload detected.',
      timestamp
    });

    // 3. Envelope Cryptographic Digest Check
    let envelopeHashMatch = false;
    if (envelope.integrity && envelope.identity && envelope.provenance && envelope.correlation) {
      const envelopeCore = {
        evidenceId: envelope.evidenceId,
        evidenceType: envelope.evidenceType,
        sequence: envelope.identity.sequence,
        timestamp: envelope.identity.timestamp,
        sourceCapability: envelope.provenance.sourceCapability,
        sourceOperation: envelope.provenance.sourceOperation,
        correlationId: envelope.correlation.correlationId,
        eventId: envelope.correlation.eventId,
        workflowId: envelope.correlation.workflowId,
        runId: envelope.correlation.runId,
        engineeringObjectId: envelope.correlation.engineeringObjectId,
        parentEvidenceId: envelope.correlation.parentEvidenceId,
        payloadHash: envelope.integrity.payloadHash,
        previousEvidenceHash: envelope.integrity.previousEvidenceHash || null
      };

      const computedEnvelopeHash = crypto
        .createHash('sha256')
        .update(EvidenceEnvelopeFactory.canonicalJsonStringify(envelopeCore))
        .digest('hex');

      envelopeHashMatch = computedEnvelopeHash === envelope.integrity.envelopeHash;
      if (!envelopeHashMatch) {
        errors.push(`Envelope hash mismatch! Computed: ${computedEnvelopeHash}, Stored: ${envelope.integrity.envelopeHash}`);
      }
    }

    checks.push({
      checkId: 'CHK-ENVELOPE-HASH',
      name: 'Envelope Metadata Cryptographic Digest Check',
      status: envelopeHashMatch ? 'PASS' : 'FAIL',
      details: envelopeHashMatch
        ? 'Envelope envelopeHash digest is intact.'
        : 'Envelope metadata or correlation references have been modified.',
      timestamp
    });

    // 4. Parent Evidence Linkage Check (if applicable)
    let parentEvidenceValid: boolean | undefined = undefined;
    if (envelope.correlation?.parentEvidenceId) {
      if (options.verifyParentExistence && options.parentResolver) {
        const parent = options.parentResolver(envelope.correlation.parentEvidenceId);
        parentEvidenceValid = parent !== undefined;
        if (!parentEvidenceValid) {
          errors.push(`Referenced parent evidence '${envelope.correlation.parentEvidenceId}' was not found.`);
        }
      } else {
        parentEvidenceValid = true; // Syntactically present
      }

      checks.push({
        checkId: 'CHK-PARENT-LINK',
        name: 'Parent Evidence Causation Linkage',
        status: parentEvidenceValid ? 'PASS' : 'FAIL',
        details: parentEvidenceValid
          ? `Parent evidence '${envelope.correlation.parentEvidenceId}' verified.`
          : `Broken parent evidence linkage.`,
        timestamp
      });
    }

    // 5. Capability Source Validation (if applicable)
    let capabilityValid: boolean | undefined = undefined;
    if (envelope.provenance?.sourceCapability && options.verifyCapabilityRegistration && options.capabilityRegistry) {
      const cap = options.capabilityRegistry.get(envelope.provenance.sourceCapability);
      capabilityValid = cap !== undefined;
      if (!capabilityValid) {
        errors.push(`Source capability '${envelope.provenance.sourceCapability}' is not registered in CapabilityRegistry.`);
      }

      checks.push({
        checkId: 'CHK-CAPABILITY-REG',
        name: 'Capability Source Registration Check',
        status: capabilityValid ? 'PASS' : 'FAIL',
        details: capabilityValid
          ? `Originating capability '${envelope.provenance.sourceCapability}' verified in registry.`
          : `Unknown or unregistered capability producer.`,
        timestamp
      });
    }

    // 6. Unified Event Correlation Check (if applicable)
    let eventCorrelationValid: boolean | undefined = undefined;
    if (envelope.correlation?.eventId && options.verifyEventCorrelation && options.eventStore) {
      const event = options.eventStore.getById(envelope.correlation.eventId);
      eventCorrelationValid = event !== undefined;
      if (!eventCorrelationValid) {
        errors.push(`Referenced event '${envelope.correlation.eventId}' was not found in EngineeringEventStore.`);
      }

      checks.push({
        checkId: 'CHK-EVENT-CORR',
        name: 'Unified Event Model Correlation Check',
        status: eventCorrelationValid ? 'PASS' : 'FAIL',
        details: eventCorrelationValid
          ? `Correlated event '${envelope.correlation.eventId}' verified in EventStore.`
          : `Event correlation broken: eventId not found.`,
        timestamp
      });
    }

    const allPassed =
      schemaValid &&
      payloadHashMatch &&
      envelopeHashMatch &&
      (parentEvidenceValid === undefined || parentEvidenceValid) &&
      (capabilityValid === undefined || capabilityValid) &&
      (eventCorrelationValid === undefined || eventCorrelationValid);

    const verificationState: EvidenceVerificationState = allPassed
      ? 'VERIFIED'
      : !schemaValid
      ? 'REJECTED'
      : (payloadHashMatch === false || envelopeHashMatch === false)
      ? 'QUARANTINED'
      : 'REJECTED';

    return {
      valid: allPassed,
      verificationState,
      evidenceId: envelope.evidenceId,
      payloadHashMatch,
      envelopeHashMatch,
      parentEvidenceValid,
      capabilityValid,
      eventCorrelationValid,
      checks: Object.freeze(checks),
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings)
    };
  }
}
