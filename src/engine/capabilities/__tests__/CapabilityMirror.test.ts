/**
 * SECP Industrial OS v3 — PROMPT-053: Capability Mirror Unit & Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CanonicalCapabilityResolver } from '../CanonicalCapabilityResolver';
import { CapabilityDriftDetector } from '../CapabilityDriftDetector';
import { FrontendCapabilityMirror } from '../FrontendCapabilityMirror';
import { CapabilityMatrixAuditor } from '../CapabilityMatrixAuditor';
import { CapabilityMirrorNegativeProofs } from '../CapabilityMirrorNegativeProofs';
import { CapabilityMirrorPositiveProofs } from '../CapabilityMirrorPositiveProofs';

describe('PROMPT-053 — Capability Mirror Architecture', () => {
  let resolver: CanonicalCapabilityResolver;
  let driftDetector: CapabilityDriftDetector;
  let mirrorStore: FrontendCapabilityMirror;

  beforeEach(() => {
    resolver = CanonicalCapabilityResolver.getInstance();
    driftDetector = CapabilityDriftDetector.getInstance();
    mirrorStore = FrontendCapabilityMirror.getInstance();
    driftDetector.clearViolations();
    mirrorStore.clearClaims();
  });

  describe('CanonicalCapabilityResolver', () => {
    it('resolves verified CAD tools as claimable and verified', () => {
      const lineRes = resolver.resolveCapability('SKETCH_LINE');
      expect(lineRes.isClaimable).toBe(true);
      expect(lineRes.truthState).toBe('VERIFIED');
      expect(lineRes.isVerified).toBe(true);

      const extrudeRes = resolver.resolveCapability('FEATURE_EXTRUDE');
      expect(extrudeRes.isClaimable).toBe(true);
      expect(extrudeRes.truthState).toBe('VERIFIED');
    });

    it('resolves bypassed tools as unclaimable and UNAVAILABLE', () => {
      const filletRes = resolver.resolveCapability('FEATURE_FILLET');
      expect(filletRes.isClaimable).toBe(false);
      expect(filletRes.truthState).toBe('UNAVAILABLE');

      const splitRes = resolver.resolveCapability('MOLD_TOOLING_SPLIT');
      expect(splitRes.isClaimable).toBe(false);
    });

    it('handles unknown capability IDs safely with NOT_SUPPORTED', () => {
      const unknownRes = resolver.resolveCapability('UNKNOWN_NONEXISTENT_TOOL');
      expect(unknownRes.isClaimable).toBe(false);
      expect(unknownRes.truthState).toBe('NOT_SUPPORTED');
    });

    it('evaluates contextual applicability separately from capability existence', () => {
      const extrudeRes = resolver.resolveCapability('FEATURE_EXTRUDE');
      expect(extrudeRes.isClaimable).toBe(true);

      // Context without active sketch profile
      const noSketchContext = resolver.evaluateContextualApplicability('FEATURE_EXTRUDE', {
        hasActiveSketchProfile: false
      });
      expect(noSketchContext.isApplicable).toBe(false);
      expect(noSketchContext.inapplicabilityReason).toContain('valid closed 2D sketch profile');

      // Context with active sketch profile
      const validContext = resolver.evaluateContextualApplicability('FEATURE_EXTRUDE', {
        hasActiveSketchProfile: true
      });
      expect(validContext.isApplicable).toBe(true);
    });
  });

  describe('CapabilityDriftDetector', () => {
    it('detects drift when Frontend claims an unverified or bypassed tool as enabled', () => {
      const audit = driftDetector.auditClaims([{
        capabilityId: 'FEATURE_FILLET',
        claimedBy: 'FilletToolbarButton',
        claimedExposed: true,
        claimedEnabled: true
      }]);

      expect(audit.hasDrift).toBe(true);
      expect(audit.driftCount).toBeGreaterThan(0);
      expect(audit.violations[0].capabilityId).toBe('FEATURE_FILLET');
    });

    it('intercepts action execution attempts on unclaimable tools', () => {
      const check = driftDetector.verifyActionIntent('MOLD_TOOLING_SPLIT', 'MoldButton');
      expect(check.allowed).toBe(false);
      expect(check.violation).toBeDefined();
      expect(check.violation?.severity).toBe('CRITICAL');
    });

    it('allows action execution on verified tools', () => {
      const check = driftDetector.verifyActionIntent('SKETCH_LINE', 'LineDrawingTool');
      expect(check.allowed).toBe(true);
      expect(check.violation).toBeUndefined();
    });
  });

  describe('FrontendCapabilityMirror', () => {
    it('projects accurate UI mirror states with badges and reasons', () => {
      const projExtrude = mirrorStore.projectTool('FEATURE_EXTRUDE', {
        hasActiveSketchProfile: false
      });

      expect(projExtrude.uiExposed).toBe(true);
      expect(projExtrude.uiEnabled).toBe(false);
      expect(projExtrude.badgeStatus).toBe('SUPPORTED');
      expect(projExtrude.disabledReason).toContain('valid closed 2D sketch profile');

      const projFillet = mirrorStore.projectTool('FEATURE_FILLET');
      expect(projFillet.uiExposed).toBe(true);
      expect(projFillet.uiEnabled).toBe(false);
      expect(projFillet.badgeStatus).toBe('UNAVAILABLE');
    });
  });

  describe('CapabilityMatrixAuditor', () => {
    it('audits DesignCapabilityMatrix and reconciles static claims with kernel truth gate', () => {
      const audit = CapabilityMatrixAuditor.auditDesignMatrix();
      expect(audit.totalEntriesAudited).toBeGreaterThan(0);
      expect(audit.alignedEntries).toBeGreaterThan(0);
    });
  });

  describe('Proof Suites', () => {
    it('passes all 6 negative proof cases', () => {
      const negReport = CapabilityMirrorNegativeProofs.executeAllNegativeProofs();
      expect(negReport.allPassed).toBe(true);
      expect(negReport.passCount).toBe(6);
    });

    it('passes all 5 positive proof cases', () => {
      const posReport = CapabilityMirrorPositiveProofs.executeAllPositiveProofs();
      expect(posReport.allPassed).toBe(true);
      expect(posReport.passCount).toBe(5);
    });
  });
});
