import { describe, it, expect, beforeEach } from 'vitest';
import { CoreExecutionAuthority } from '../execution/CoreExecutionAuthority';
import { GenericExecutionRegistry } from '../execution/GenericExecutionRegistry';
import { CoreExecutionRequest } from '../execution/CoreExecutionTypes';
import { RevisionEngine } from '../revision/RevisionEngine';
import { RevisionLifecycleState } from '../revision/types';
import { PluginAuthorityBoundary } from '../governance/PluginAuthorityBoundary';
import { CanonicalDerivedArtifactBinding } from '../topology/CanonicalDerivedArtifactBinding';

describe('Multi-Domain Authoritative Plugin Adversarial Suite', () => {
  let revisionEngine: RevisionEngine;
  const objectId = 'CANONICAL-ENG-OBJ-001';
  let releasedRevHash: string;
  let releasedGeomHash: string;

  beforeEach(() => {
    GenericExecutionRegistry.clear();
    CoreExecutionAuthority.clear();

    revisionEngine = new RevisionEngine();
    CoreExecutionAuthority.initialize(revisionEngine);

    // Bootstrap reference revision in RevisionEngine
    const rev = revisionEngine.createRevision({
      revisionId: 'REV-MULTI-100',
      entityId: objectId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'ENGINEER-A',
      content: { geometry: 'MULTI_DOMAIN_RECON_BREP' },
      snapshot: {
        geometryState: {
          parameters: { waterlineLengthM: 45, internalPressureMPa: 18.5 },
          features: [],
          topologyHash: 'TOPO-MULTI-100',
          geometryHash: 'GEOM-MULTI-100'
        }
      }
    } as any);

    revisionEngine.addApproval(rev.revisionId, {
      approvalId: 'APP-MULTI-100',
      revisionId: rev.revisionId,
      role: 'ENGINEER',
      actorId: 'APPROVER_A',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Multi-domain design parameters approved'
    });

    revisionEngine.setValidationState(rev.revisionId, 'SIMULATED');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.IN_REVIEW, 'BYPASS_ADMIN', 'Reviewing');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.APPROVED, 'BYPASS_ADMIN', 'Approved');
    const released = revisionEngine.releaseRevision(rev.revisionId, 'BYPASS_ADMIN', 'Released A');

    releasedRevHash = released.revisionHash;
    releasedGeomHash = released.snapshot?.geometryState?.geometryHash!;
  });

  // Helper to build standard requests for all domains
  const getRequest = (pluginId: string, executionKind: string, params: Record<string, any>): CoreExecutionRequest => ({
    requestId: `REQ-${pluginId.toUpperCase()}-001`,
    engineeringObjectId: objectId,
    revisionId: 'REV-MULTI-100',
    targetRevisionHash: releasedRevHash,
    targetGeometryHash: releasedGeomHash,
    pluginId,
    pluginVersion: '1.0.0',
    executionKind,
    parameters: params
  });

  describe('Aerospace Domain Verification', () => {
    it('MD01 — Executes aerospace mach-flow computation through the Core successfully', async () => {
      const req = getRequest('secp-plugin-aerospace', 'mach-flow', {
        altitudeM: 11000,
        velocityMs: 250
      });
      const envelope = await CoreExecutionAuthority.execute(req);

      expect(envelope).toBeDefined();
      expect(envelope.executionId).toBeDefined();
      expect(envelope.solverIdentity).toBe('AEROSPACE-FLOW-SOLVER-V1');
      expect(envelope.state).toBe('SEALED');
      expect(envelope.solverResult.status).toBe('SUCCESS');
      expect(envelope.solverResult.rawResults.flowRegime).toBe('Transonic');
      expect(envelope.solverResult.rawResults.machNumber).toBeCloseTo(0.847, 3);

      const verifyRes = GenericExecutionRegistry.verifyResultBinding(envelope, releasedRevHash, releasedGeomHash, objectId);
      expect(verifyRes.isValid).toBe(true);
    });

    it('MD02 — Rejects aerospace execution on wrong geometry identity', async () => {
      const req = getRequest('secp-plugin-aerospace', 'mach-flow', { altitudeM: 11000, velocityMs: 250 });
      req.targetGeometryHash = 'WRONG_GEOMETRY_HASH';

      await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/GEOMETRY_MISMATCH/);
    });
  });

  describe('Automotive Domain Verification', () => {
    it('MD03 — Executes automotive aerodynamic drag computation through the Core successfully', async () => {
      const req = getRequest('secp-plugin-automotive', 'aero-drag', {
        speedKmH: 120,
        dragCoefficientCd: 0.28,
        frontalAreaM2: 2.2,
        airDensityKgM3: 1.225
      });
      const envelope = await CoreExecutionAuthority.execute(req);

      expect(envelope).toBeDefined();
      expect(envelope.solverIdentity).toBe('AUTOMOTIVE-DRAG-SOLVER-V1');
      expect(envelope.solverResult.rawResults.dragForceN).toBe(419.2);
      expect(envelope.solverResult.rawResults.powerRequiredKw).toBe(13.97);
      expect(envelope.solverResult.rawResults.flowRegime).toBe('High Speed Turbulent');

      const verifyRes = GenericExecutionRegistry.verifyResultBinding(envelope, releasedRevHash, releasedGeomHash, objectId);
      expect(verifyRes.isValid).toBe(true);
    });

    it('MD04 — Rejects automotive execution on mismatching revision ID', async () => {
      const req = getRequest('secp-plugin-automotive', 'aero-drag', { speedKmH: 120 });
      req.targetRevisionHash = 'WRONG_REVISION_HASH';

      await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/REVISION_MISMATCH/);
    });
  });

  describe('Energy Domain Verification', () => {
    it('MD05 — Executes energy wind turbine power computation through the Core successfully', async () => {
      const req = getRequest('secp-plugin-energy', 'wind-power', {
        windSpeedMS: 12,
        rotorRadiusM: 42,
        powerCoefficientCp: 0.44,
        airDensityKgM3: 1.225,
        generatorEfficiencyPct: 92
      });
      const envelope = await CoreExecutionAuthority.execute(req);

      expect(envelope).toBeDefined();
      expect(envelope.solverIdentity).toBe('ENERGY-TURBINE-SOLVER-V1');
      expect(envelope.solverResult.rawResults.sweptAreaM2).toBe(5541.8);
      expect(envelope.solverResult.rawResults.electricalPowerMW).toBe(2.374);

      const verifyRes = GenericExecutionRegistry.verifyResultBinding(envelope, releasedRevHash, releasedGeomHash, objectId);
      expect(verifyRes.isValid).toBe(true);
    });
  });

  describe('Marine Domain Verification', () => {
    it('MD06 — Executes marine hydrostatics computation through the Core successfully', async () => {
      const req = getRequest('secp-plugin-marine', 'hydrostatics', {
        waterlineLengthM: 45,
        vesselSpeedKnots: 18,
        displacementTons: 620
      });
      const envelope = await CoreExecutionAuthority.execute(req);

      expect(envelope).toBeDefined();
      expect(envelope.solverIdentity).toBe('MARINE-HYDROSTATICS-SOLVER-V1');
      expect(envelope.solverResult.rawResults.froudeNumber).toBeCloseTo(0.441, 3);
      expect(envelope.solverResult.rawResults.hydrodynamicRegime).toBe('Planing Hull');

      const verifyRes = GenericExecutionRegistry.verifyResultBinding(envelope, releasedRevHash, releasedGeomHash, objectId);
      expect(verifyRes.isValid).toBe(true);
    });
  });

  describe('Oil & Gas Domain Verification', () => {
    it('MD07 — Executes oil & gas Barlow pipeline hoop stress through the Core successfully', async () => {
      const req = getRequest('secp-plugin-oil-gas', 'barlow-stress', {
        internalPressureMPa: 18.5,
        outerDiameterMm: 508,
        wallThicknessMm: 15.8,
        materialYieldStrengthMPa: 450,
        safetyFactorASME: 1.39
      });
      const envelope = await CoreExecutionAuthority.execute(req);

      expect(envelope).toBeDefined();
      expect(envelope.solverIdentity).toBe('OIL-GAS-PIPELINE-SOLVER-V1');
      expect(envelope.solverResult.rawResults.hoopStressMPa).toBe(297.4);
      expect(envelope.solverResult.rawResults.asmeCompliance).toBe('COMPLIANT_PASS');

      const verifyRes = GenericExecutionRegistry.verifyResultBinding(envelope, releasedRevHash, releasedGeomHash, objectId);
      expect(verifyRes.isValid).toBe(true);
    });
  });

  describe('Cross-Domain and Global Authority Hardening', () => {
    it('MD08 — Non-existent solver requests are strictly rejected', async () => {
      const req = getRequest('secp-plugin-automotive', 'mach-flow', {}); // Wrong executionKind

      await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/UNAUTHORIZED_SOLVER/);
    });

    it('MD09 — Unregistered plugin requests are rejected', async () => {
      const req = getRequest('secp-unregistered-plugin', 'barlow-stress', {});

      await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/UNAUTHORIZED_SOLVER/);
    });

    it('MD10 — Double registration of identical inputs yields identical execution IDs', async () => {
      const req1 = getRequest('secp-plugin-aerospace', 'mach-flow', { altitudeM: 11000, velocityMs: 250 });
      const req2 = getRequest('secp-plugin-aerospace', 'mach-flow', { altitudeM: 11000, velocityMs: 250 });

      const env1 = await CoreExecutionAuthority.execute(req1);
      // Reset registry to allow re-registration of same execution ID
      GenericExecutionRegistry.clear();
      const env2 = await CoreExecutionAuthority.execute(req2);

      expect(env1.executionId).toBe(env2.executionId);
    });

    it('MD11 — Different inputs yield completely different execution IDs', async () => {
      const req1 = getRequest('secp-plugin-aerospace', 'mach-flow', { altitudeM: 11000, velocityMs: 250 });
      const req2 = getRequest('secp-plugin-aerospace', 'mach-flow', { altitudeM: 11000, velocityMs: 350 }); // Speed changed

      const env1 = await CoreExecutionAuthority.execute(req1);
      const env2 = await CoreExecutionAuthority.execute(req2);

      expect(env1.executionId).not.toBe(env2.executionId);
    });

    it('MD12 — Preventing execution replay against another object ID', async () => {
      const req = getRequest('secp-plugin-aerospace', 'mach-flow', { altitudeM: 11000, velocityMs: 250 });
      const env = await CoreExecutionAuthority.execute(req);

      const verifyRes = GenericExecutionRegistry.verifyResultBinding(env, releasedRevHash, releasedGeomHash, 'DIFFERENT-OBJECT-999');
      expect(verifyRes.isValid).toBe(false);
      expect(verifyRes.failureReason).toContain('ENTITY_MISMATCH');
    });
  });
});
