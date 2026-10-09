/**
 * SECP Industrial OS v2 — PATCH-158: Hard Acceptance Gate
 * Mandatory validation for Engineering Identity integrity, linkage, and chain of truth.
 */

import { EngineeringObject } from './industrial-os/types';
import { EngineeringIdentityService } from './identity/EngineeringIdentityService';
import { EngineeringIdentityFactory } from './identity/EngineeringIdentityFactory';
import { EngineeringEventStore } from './industrial-os/event-model/EngineeringEventStore';
import { EvidenceBus } from './industrial-os/evidence-bus/EvidenceBus';

export interface IdentityValidationReport {
  readonly gatePassed: boolean;
  readonly timestamp: string;
  readonly identityChainValid: boolean;
  readonly revisionLinkageValid: boolean;
  readonly eventBindingValid: boolean;
  readonly evidenceBindingValid: boolean;
  readonly details: string[];
}

export class HardAcceptanceGate158 {
  private static identityService = EngineeringIdentityService.getInstance();
  private static eventStore = EngineeringEventStore.getInstance();
  private static evidenceBus = EvidenceBus.getInstance();

  /**
   * Performs a deterministic deep audit of a specific Engineering Identity chain.
   */
  public static validate(identityId: string): IdentityValidationReport {
    const details: string[] = [];
    const timestamp = new Date().toISOString();
    
    const history = this.identityService.getIdentityHistory(identityId);
    if (history.length === 0) {
      return {
        gatePassed: false,
        timestamp,
        identityChainValid: false,
        revisionLinkageValid: false,
        eventBindingValid: false,
        evidenceBindingValid: false,
        details: [`Identity chain for ${identityId} not found in EngineeringIdentityService`]
      };
    }

    // 1. Identity Chain Integrity Check
    let identityChainValid = true;
    for (const identity of history) {
      // In this gate, we only verify that the identity object is structurally valid 
      // and internally consistent where possible. Content integrity requires metadata 
      // which we verify in auditObject.
      if (!identity.identityId || !identity.contentHash || !identity.timestamp) {
        details.push(`Identity structure invalid for revision ${identity.revisionId}`);
        identityChainValid = false;
      }
    }

    // 2. Revision Linkage Check (Parent pointers must form a valid DAG)
    let revisionLinkageValid = true;
    for (let i = 1; i < history.length; i++) {
      if (history[i].parentIdentityId !== history[i-1].identityId) {
        details.push(`Broken revision linkage between ${history[i-1].revisionId} and ${history[i].revisionId}`);
        revisionLinkageValid = false;
      }
    }

    // 3. Unified Event Binding Check
    const events = this.eventStore.query({ entityIdentityId: identityId });
    const eventBindingValid = events.length > 0;
    if (!eventBindingValid) {
      details.push(`No Unified Events found carrying identityId ${identityId}`);
    } else {
      details.push(`Verified ${events.length} Unified Events bound to identityId ${identityId}`);
    }

    // 4. Evidence Bus Binding Check
    const evidences = this.evidenceBus.correlate({ subjectIdentityId: identityId });
    const evidenceBindingValid = evidences.length > 0;
    if (!evidenceBindingValid) {
      details.push(`No Evidence Envelopes found bound to subjectIdentityId ${identityId}`);
    } else {
      details.push(`Verified ${evidences.length} Evidence Envelopes bound to subjectIdentityId ${identityId}`);
    }

    const gatePassed = identityChainValid && revisionLinkageValid && eventBindingValid && evidenceBindingValid;

    return {
      gatePassed,
      timestamp,
      identityChainValid,
      revisionLinkageValid,
      eventBindingValid,
      evidenceBindingValid,
      details
    };
  }

  /**
   * Audit an EngineeringObject against the identity gate.
   */
  public static auditObject(obj: EngineeringObject): IdentityValidationReport {
    const report = this.validate(obj.identity.identityId);
    
    // Additional object-level check: contentHash in identity must match object metadata
    const contentMatch = EngineeringIdentityFactory.verifyIntegrity(obj.identity, obj.metadata);
    if (!contentMatch) {
      (report.details as string[]).push(`CRITICAL: Identity contentHash does not match object metadata for ${obj.id}`);
      return { ...report, gatePassed: false, identityChainValid: false };
    }
    
    return report;
  }
}
