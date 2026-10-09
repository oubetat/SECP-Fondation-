/**
 * SECP Industrial OS v3 — PROMPT-052: Success Semantics Unit Tests
 * Verifies core contracts, state machine transitions, mutation verifications, and positive/negative proofs.
 */

import { describe, it, expect } from 'vitest';
import {
  EngineeringCapabilityType,
  NonCanonicalMutationReason,
  SuccessStateEnum
} from '../SuccessSemanticsTypes';
import { CanonicalMutationVerifier } from '../CanonicalMutationVerifier';
import { CapabilitySuccessValidators } from '../CapabilitySuccessValidators';
import { SuccessStateMachine } from '../SuccessStateMachine';
import { EngineeringSuccessResolver } from '../SuccessResolver';
import { SuccessAuditMatrix } from '../SuccessAuditMatrix';
import { SuccessSemanticsNegativeProofs } from '../SuccessSemanticsNegativeProofs';
import { SuccessSemanticsPositiveProofs } from '../SuccessSemanticsPositiveProofs';

describe('PROMPT-052: Success Semantics Audit Suite', () => {
  describe('Canonical Mutation Verifier', () => {
    it('accepts valid, monotonic, rebuildable mutation proof', () => {
      const proof = CanonicalMutationVerifier.createValidProof({
        targetDocumentId: 'DOC-TEST-001',
        previousRevision: 1,
        mutationType: 'EXTRUDE_SOLID',
        affectedEntities: ['SOLID-01'],
        contentBefore: { rev: 1, solid: null },
        contentAfter: { rev: 2, solid: 'SOLID_BREP_DATA' }
      });

      const verification = CanonicalMutationVerifier.verifyMutation(proof);
      expect(verification.isValid).toBe(true);
      expect(verification.rejectionReasons.length).toBe(0);
      expect(verification.computedProofHash).toBeDefined();
    });

    it('rejects mutation when previous and new hashes are identical (no actual mutation)', () => {
      const proof = {
        isCanonicalMutation: true,
        targetDocumentId: 'DOC-TEST-001',
        previousRevision: 1,
        newRevision: 2,
        mutationType: 'NOOP',
        affectedEntities: ['SOLID-01'],
        affectedCanonicalEntities: ['SOLID-01'],
        canonicalPayloadHashBefore: 'same_hash_value',
        canonicalPayloadHashAfter: 'same_hash_value',
        isStaleState: false,
        rebuildable: true
      };

      const verification = CanonicalMutationVerifier.verifyMutation(proof);
      expect(verification.isValid).toBe(false);
      expect(verification.rejectionReasons).toContain(
        'Canonical payload hash did not change: state is identical before and after'
      );
    });

    it('rejects stale state mutations', () => {
      const proof = {
        isCanonicalMutation: true,
        targetDocumentId: 'DOC-TEST-001',
        previousRevision: 1,
        newRevision: 2,
        mutationType: 'EXTRUDE',
        affectedCanonicalEntities: ['SOLID-01'],
        canonicalPayloadHashBefore: 'hash1',
        canonicalPayloadHashAfter: 'hash2',
        isStaleState: true,
        rebuildable: true
      };

      const verification = CanonicalMutationVerifier.verifyMutation(proof);
      expect(verification.isValid).toBe(false);
      expect(verification.rejectionReasons).toContain('Target canonical state is marked STALE');
    });

    it('rejects non-monotonic revision advancement', () => {
      const proof = {
        isCanonicalMutation: true,
        targetDocumentId: 'DOC-TEST-001',
        previousRevision: 5,
        newRevision: 4,
        mutationType: 'EXTRUDE',
        affectedCanonicalEntities: ['SOLID-01'],
        canonicalPayloadHashBefore: 'hash1',
        canonicalPayloadHashAfter: 'hash2',
        isStaleState: false,
        rebuildable: true
      };

      const verification = CanonicalMutationVerifier.verifyMutation(proof);
      expect(verification.isValid).toBe(false);
      expect(verification.rejectionReasons[0]).toContain('Revision failed to advance monotonically');
    });
  });

  describe('Capability Success Validators', () => {
    it('validates Extrude criteria (manifold, watertight, positive volume, Euler valid)', () => {
      const pass = CapabilitySuccessValidators.validateCapability(
        EngineeringCapabilityType.EXTRUDE,
        { isManifold: true, isWatertight: true, eulerValid: true, volume: 100 }
      );
      expect(pass.validationPassed).toBe(true);

      const fail = CapabilitySuccessValidators.validateCapability(
        EngineeringCapabilityType.EXTRUDE,
        { isManifold: false, isWatertight: true, eulerValid: true, volume: -10 }
      );
      expect(fail.validationPassed).toBe(false);
    });

    it('validates Simulation criteria (residuals, mesh Jacobian, no NaNs)', () => {
      const pass = CapabilitySuccessValidators.validateCapability(
        EngineeringCapabilityType.SIMULATION,
        { hasNaN: false, residual: 1e-5, minJacobian: 0.75 }
      );
      expect(pass.validationPassed).toBe(true);

      const fail = CapabilitySuccessValidators.validateCapability(
        EngineeringCapabilityType.SIMULATION,
        { hasNaN: true, residual: 1e-5, minJacobian: 0.75 }
      );
      expect(fail.validationPassed).toBe(false);
    });
  });

  describe('Success State Machine', () => {
    it('enforces rigorous step-by-step transition to SUCCESS', () => {
      const sm = new SuccessStateMachine(SuccessStateEnum.REQUESTED);
      expect(sm.getState()).toBe(SuccessStateEnum.REQUESTED);

      sm.transition(SuccessStateEnum.EXECUTING, 'Started');
      sm.transition(SuccessStateEnum.EXECUTED, 'Executed');
      sm.transition(SuccessStateEnum.CANONICAL_MUTATED, 'Mutated');
      sm.transition(SuccessStateEnum.VALIDATING, 'Validating');
      sm.transition(SuccessStateEnum.VALID, 'Validated');
      sm.transition(SuccessStateEnum.VERIFIED, 'Verified');
      sm.transition(SuccessStateEnum.SUCCESS, 'Completed');

      expect(sm.getState()).toBe(SuccessStateEnum.SUCCESS);
      expect(sm.getHistory().length).toBe(8);
    });

    it('rejects direct illegal shortcut jump from REQUESTED to SUCCESS', () => {
      const sm = new SuccessStateMachine(SuccessStateEnum.REQUESTED);
      expect(() => {
        sm.transition(SuccessStateEnum.SUCCESS, 'Illegal shortcut');
      }).toThrow(/Illegal state machine transition/);
    });

    it('rejects direct illegal shortcut jump from EXECUTED to SUCCESS', () => {
      const sm = new SuccessStateMachine(SuccessStateEnum.REQUESTED);
      sm.transition(SuccessStateEnum.EXECUTING, 'Started');
      sm.transition(SuccessStateEnum.EXECUTED, 'Executed');
      expect(() => {
        sm.transition(SuccessStateEnum.SUCCESS, 'Illegal shortcut');
      }).toThrow(/Illegal state machine transition/);
    });
  });

  describe('Negative Proofs (SUS-NEG-001 to SUS-NEG-018)', () => {
    it('executes all 18 negative proofs and guarantees 0% fake success rate', () => {
      const result = SuccessSemanticsNegativeProofs.executeAllNegativeProofs();
      expect(result.totalCount).toBe(18);
      expect(result.passCount).toBe(18);
      expect(result.allPassed).toBe(true);
      expect(result.results.every(r => !r.isSuccess)).toBe(true);
    });
  });

  describe('Positive Proofs (SUS-POS-001 to SUS-POS-005)', () => {
    it('executes all 5 positive proofs and verifies correct outcomes', () => {
      const result = SuccessSemanticsPositiveProofs.executeAllPositiveProofs();
      expect(result.totalCount).toBe(5);
      expect(result.passCount).toBe(5);
      expect(result.allPassed).toBe(true);
    });
  });

  describe('Audit Matrix', () => {
    it('covers all 21 engineering capabilities with 100% verified status', () => {
      const matrix = SuccessAuditMatrix.generateAuditMatrix();
      expect(matrix.totalCapabilities).toBe(21);
      expect(matrix.passedCapabilities).toBe(21);
      expect(matrix.coveragePercent).toBe(100);
      expect(matrix.allPassed).toBe(true);
    });
  });
});
