/**
 * SECP Engineering OS — Simulation Execution Authority Adversarial Test Battery
 * Task ID: SECP-CAD-TRUTH-PATCH-001 (Phase C)
 * 
 * Verifies AUTH-01 through AUTH-15 security scenarios at real issuance, sealing,
 * and solver consumption boundaries.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  issueSealingCapability, 
  validateCapability, 
  revokeCapability,
  revokeAllCapabilities 
} from '../SimulationSealingAuthorization';
import { 
  initializeAuthorityHandshake, 
  revokeAuthorityState, 
  sealEnvelope,
  verifyEnvelopeSeal,
  SimulationExecutionEnvelope
} from '../SimulationAuthorityInternal';
import { SimulationExecutionRegistry } from '../SimulationExecutionRegistry';
import { CanonicalDomainBindingEngine } from '../../crossdomain/CanonicalDomainBindingEngine';
import { CfdToCoreBinding } from '../../crossdomain/CanonicalDomainBinding';

describe('SECP-CAD-TRUTH-PATCH-001: Adversarial Security Tests (AUTH-01 .. AUTH-15)', () => {

  beforeEach(() => {
    revokeAuthorityState();
    SimulationExecutionRegistry.clear();
  });

  it('AUTH-01: Missing capability -> Reject', () => {
    initializeAuthorityHandshake();
    const rawEnvelope = { provenanceHash: 'HASH-01', result: {} };
    expect(() => {
      sealEnvelope(rawEnvelope, undefined as any);
    }).toThrow(/SIMULATION_AUTHORITY_VIOLATION/);
  });

  it('AUTH-02: Null or malformed capability -> Reject', () => {
    initializeAuthorityHandshake();
    const rawEnvelope = { provenanceHash: 'HASH-02', result: {} };
    expect(() => {
      sealEnvelope(rawEnvelope, null as any);
    }).toThrow(/SIMULATION_AUTHORITY_VIOLATION/);

    expect(() => {
      sealEnvelope(rawEnvelope, 'MALFORMED_STRING_TOKEN' as any);
    }).toThrow(/SIMULATION_AUTHORITY_VIOLATION/);

    expect(() => {
      sealEnvelope(rawEnvelope, 123456 as any);
    }).toThrow(/SIMULATION_AUTHORITY_VIOLATION/);
  });

  it('AUTH-03: Forged structural capability -> Reject', () => {
    initializeAuthorityHandshake();
    const fakeCap = {
      capabilityId: 'FORGED-ID-999',
      authorizedContext: 'ATTACKER_CONTEXT',
      authorizedDomains: ['SIMULATION', 'CFD'],
      issuedAt: Date.now(),
      usedCount: 0
    };

    const rawEnvelope = { provenanceHash: 'HASH-03', result: {} };
    expect(() => {
      sealEnvelope(rawEnvelope, fakeCap as any);
    }).toThrow(/Unrecognized or forged SealingCapability/);
  });

  it('AUTH-04: Revoked capability -> Reject', () => {
    initializeAuthorityHandshake();
    const cap = issueSealingCapability('SIM_CONTEXT', ['SIMULATION']);
    revokeCapability(cap.capabilityId);

    const rawEnvelope = { provenanceHash: 'HASH-04', result: {} };
    expect(() => {
      sealEnvelope(rawEnvelope, cap);
    }).toThrow(/SealingCapability has been revoked/);
  });

  it('AUTH-05: Expired capability -> Reject', () => {
    initializeAuthorityHandshake();
    const cap = issueSealingCapability('SIM_CONTEXT', ['SIMULATION'], { ttlMs: -1000 }); // Expired 1s ago

    const rawEnvelope = { provenanceHash: 'HASH-05', result: {} };
    expect(() => {
      sealEnvelope(rawEnvelope, cap);
    }).toThrow(/SealingCapability has expired/);
  });

  it('AUTH-06: Wrong simulation domain -> Reject', () => {
    initializeAuthorityHandshake();
    const pcbCap = issueSealingCapability('PCB_CONTEXT', ['PCB']);

    const binding = CanonicalDomainBindingEngine.createBinding(
      'CFD', 'ENTITY-06', 'REV-1', {}, 'geo-1', 'topo-1', 'mat-1', 'env-1', 'phys-1'
    ) as CfdToCoreBinding;

    expect(() => {
      CanonicalDomainBindingEngine.sealBinding(binding, pcbCap);
    }).toThrow(/Capability is not authorized for domain 'CFD'/);
  });

  it('AUTH-07: Wrong canonical revision -> Reject', () => {
    initializeAuthorityHandshake();
    const cap = issueSealingCapability('SIM_CONTEXT', ['SIMULATION'], {
      cadRevisionHash: 'REV-EXPECTED-100'
    });

    const rawEnvelope: any = {
      provenanceHash: 'HASH-07',
      result: {},
      authoritativeRevisionHash: 'REV-ACTUAL-999',
      authoritativeGeometryHash: 'GEOM-100'
    };

    expect(() => {
      sealEnvelope(rawEnvelope, cap);
    }).toThrow(/Capability CAD revision mismatch/);
  });

  it('AUTH-08: Wrong geometry hash -> Reject', () => {
    initializeAuthorityHandshake();
    const cap = issueSealingCapability('SIM_CONTEXT', ['SIMULATION'], {
      canonicalGeometryHash: 'GEOM-EXPECTED-A'
    });

    const rawEnvelope: any = {
      provenanceHash: 'HASH-08',
      result: {},
      authoritativeRevisionHash: 'REV-100',
      authoritativeGeometryHash: 'GEOM-ACTUAL-B'
    };

    expect(() => {
      sealEnvelope(rawEnvelope, cap);
    }).toThrow(/Capability geometry hash mismatch/);
  });

  it('AUTH-09: Capability replay -> Reject', () => {
    initializeAuthorityHandshake();
    const singleUseCap = issueSealingCapability('SIM_CONTEXT', ['SIMULATION'], { maxUses: 1 });

    const rawEnvelope1: any = { provenanceHash: 'HASH-09A', result: {} };
    const rawEnvelope2: any = { provenanceHash: 'HASH-09B', result: {} };

    // First use: succeeds
    const sealed1 = sealEnvelope(rawEnvelope1, singleUseCap);
    expect(verifyEnvelopeSeal(sealed1)).toBe(true);

    // Second use (replay): fails
    expect(() => {
      sealEnvelope(rawEnvelope2, singleUseCap);
    }).toThrow(/SealingCapability usage limit exceeded/);
  });

  it('AUTH-10: Concurrent duplicate execution -> Enforce defined lifecycle policy', () => {
    initializeAuthorityHandshake();
    const cap = issueSealingCapability('SIM_CONTEXT', ['SIMULATION'], { maxUses: 5 });

    const binding = {
      artifactDigest: 'PROVENANCE-AUTH-10',
      cadRevisionHash: 'REV-10',
      canonicalGeometryHash: 'GEOM-10',
      artifactKind: 'SIMULATION_RESULT'
    };

    const res1 = {
      scenarioId: 'SIM-10',
      maxStressMpa: 150,
      derivedArtifactBinding: binding,
      provenanceHash: 'PROVENANCE-AUTH-10'
    };

    const envelope1: any = {
      provenanceHash: 'PROVENANCE-AUTH-10',
      result: res1,
      authoritativeRevisionHash: 'REV-10',
      authoritativeGeometryHash: 'GEOM-10',
      timestamp: new Date().toISOString()
    };
    sealEnvelope(envelope1, cap);
    SimulationExecutionRegistry.registerExecution(envelope1);

    // Attempt duplicate registration with DIFFERENT content
    const res2 = {
      scenarioId: 'SIM-10',
      maxStressMpa: 999, // Modified payload!
      derivedArtifactBinding: binding,
      provenanceHash: 'PROVENANCE-AUTH-10'
    };
    const envelope2: any = {
      provenanceHash: 'PROVENANCE-AUTH-10',
      result: res2,
      authoritativeRevisionHash: 'REV-10',
      authoritativeGeometryHash: 'GEOM-10',
      timestamp: new Date().toISOString()
    };
    sealEnvelope(envelope2, cap);

    expect(() => {
      SimulationExecutionRegistry.registerExecution(envelope2);
    }).toThrow(/already registered and immutable/);
  });

  it('AUTH-11: Authority initialization failure -> Reject', () => {
    expect(() => {
      initializeAuthorityHandshake({ simulateFailure: true });
    }).toThrow(/Authority boot failed/);

    const cap = issueSealingCapability('SIM_CONTEXT', ['SIMULATION']);
    const rawEnvelope: any = { provenanceHash: 'HASH-11', result: {} };

    expect(() => {
      sealEnvelope(rawEnvelope, cap);
    }).toThrow(/SIMULATION_AUTHORITY_INITIALIZATION_FAILED/);
  });

  it('AUTH-12: Registry unavailable -> Reject', () => {
    initializeAuthorityHandshake();
    SimulationExecutionRegistry.clear();

    const result = SimulationExecutionRegistry.verifyResultBinding({
      provenanceHash: 'UNREGISTERED-HASH'
    });

    expect(result.isValid).toBe(false);
    expect(result.failureReason).toBe('UNREGISTERED_RESULT_PROVENANCE');
  });

  it('AUTH-13: Partial sealing failure -> No false sealed state', () => {
    initializeAuthorityHandshake();
    const rawEnvelope: any = { provenanceHash: 'HASH-13', result: {} };
    const invalidCap: any = { capabilityId: 'INVALID' };

    try {
      sealEnvelope(rawEnvelope, invalidCap);
    } catch {
      // Expected exception
    }

    expect(verifyEnvelopeSeal(rawEnvelope)).toBe(false);
  });

  it('AUTH-14: Legitimate authorized execution -> Allow', () => {
    initializeAuthorityHandshake();
    const cap = issueSealingCapability('SIM_CONTEXT', ['SIMULATION'], {
      cadRevisionHash: 'REV-AUTH-14',
      canonicalGeometryHash: 'GEOM-AUTH-14'
    });

    const binding = {
      artifactDigest: 'PROVENANCE-AUTH-14',
      cadRevisionHash: 'REV-AUTH-14',
      canonicalGeometryHash: 'GEOM-AUTH-14',
      artifactKind: 'SIMULATION_RESULT'
    };

    const res = {
      scenarioId: 'SIM-14',
      derivedArtifactBinding: binding,
      provenanceHash: 'PROVENANCE-AUTH-14'
    };

    const rawEnvelope: any = {
      provenanceHash: 'PROVENANCE-AUTH-14',
      result: res,
      authoritativeRevisionHash: 'REV-AUTH-14',
      authoritativeGeometryHash: 'GEOM-AUTH-14',
      timestamp: new Date().toISOString()
    };

    const sealedEnvelope = sealEnvelope(rawEnvelope, cap);
    expect(verifyEnvelopeSeal(sealedEnvelope)).toBe(true);

    SimulationExecutionRegistry.registerExecution(sealedEnvelope);
    expect(SimulationExecutionRegistry.verifyExecution('PROVENANCE-AUTH-14')).toBe(true);
  });

  it('AUTH-15: Capability revocation during lifecycle -> Enforce revocation policy', () => {
    initializeAuthorityHandshake();
    const cap = issueSealingCapability('SIM_CONTEXT', ['SIMULATION'], { maxUses: 10 });

    const envelope1: any = { provenanceHash: 'HASH-15A', result: {} };
    sealEnvelope(envelope1, cap); // First call succeeds

    revokeCapability(cap.capabilityId); // Revoked during lifecycle

    const envelope2: any = { provenanceHash: 'HASH-15B', result: {} };
    expect(() => {
      sealEnvelope(envelope2, cap);
    }).toThrow(/SealingCapability has been revoked/);
  });
});
