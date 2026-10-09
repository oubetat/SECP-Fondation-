/**
 * SECP Industrial OS v3 — Collision Authority Core
 * P0 Remediation Verification & Contract Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CollisionAuthority,
  CollisionExactness,
  CollisionSeverity,
  CollisionStatus,
  CanonicalCollisionInput,
  CollisionProvider,
  LegacyCollisionAdapter
} from '../index';

describe('COLLISION-ENGINE-P0-AUTHORITY-CONTRACT-001 Verification Suite', () => {
  beforeEach(() => {
    CollisionAuthority.clearProviders();
  });

  const validCamInput: CanonicalCollisionInput = {
    executionId: 'TEST_EXEC_001',
    domain: 'CAM_MULTI_AXIS',
    coordinateFrame: 'WCS',
    units: 'MILLIMETERS',
    toleranceProfile: {
      linearToleranceMm: 0.005,
      angularToleranceDeg: 0.5,
      clearanceWarningMarginMm: 2.0,
      safeClearanceMarginMm: 0.5
    },
    cadRevisionId: 'REV_CAD_SHA256_ABC123',
    toolAssembly: {
      cutterDiameterMm: 10.0,
      fluteLengthMm: 25.0,
      stickoutMm: 45.0,
      shankDiameterMm: 10.0
    }
  };

  const dummyProvider: CollisionProvider = {
    capabilities: {
      providerId: 'EXACT_MOCK_SOLVER_FOR_TESTS',
      providerName: 'Test Exact Solver',
      algorithmVersion: '1.0.0',
      exactnessLevel: CollisionExactness.EXACT,
      limitations: [],
      supportsStaticCollision: true,
      supportsContinuousCollision: false,
      supportsMeshMesh: true,
      supportsToolStock: true,
      supportsToolFixture: true,
      supportsHolderCollision: true,
      supportsMachineCollision: false,
      supportsBRep: true,
      supportsGouge: true,
      supportsClearance: true
    },
    evaluate: (input) => {
      return {
        status: CollisionStatus.NO_COLLISION,
        minClearanceMm: 5.0,
        maxPenetrationDepthMm: 0,
        volumetricInterferenceMm3: 0
      };
    }
  };

  it('T01 / P0-G01: Canonical result taxonomy includes all required status states', () => {
    expect(CollisionStatus.NO_COLLISION).toBe('NO_COLLISION');
    expect(CollisionStatus.CONTACT).toBe('CONTACT');
    expect(CollisionStatus.PENETRATION).toBe('PENETRATION');
    expect(CollisionStatus.CLEARANCE_VIOLATION).toBe('CLEARANCE_VIOLATION');
    expect(CollisionStatus.GOUGE).toBe('GOUGE');
    expect(CollisionStatus.HOLDER_COLLISION).toBe('HOLDER_COLLISION');
    expect(CollisionStatus.FIXTURE_COLLISION).toBe('FIXTURE_COLLISION');
    expect(CollisionStatus.MACHINE_COLLISION).toBe('MACHINE_COLLISION');
    expect(CollisionStatus.STOCK_COLLISION).toBe('STOCK_COLLISION');
    expect(CollisionStatus.INTERFERENCE).toBe('INTERFERENCE');
    expect(CollisionStatus.ANALYSIS_FAILED).toBe('ANALYSIS_FAILED');
    expect(CollisionStatus.INVALID_GEOMETRY).toBe('INVALID_GEOMETRY');
    expect(CollisionStatus.UNKNOWN).toBe('UNKNOWN');
  });

  it('T02 / V02 / P0-G02: Required input validation fails-closed on missing tool geometry in CAM domain', async () => {
    CollisionAuthority.registerProvider(dummyProvider);
    const invalidInput: any = {
      domain: 'CAM_MULTI_AXIS',
      coordinateFrame: 'WCS',
      units: 'MILLIMETERS',
      toleranceProfile: { linearToleranceMm: 0.005, angularToleranceDeg: 0.5, clearanceWarningMarginMm: 2.0, safeClearanceMarginMm: 0.5 }
      // Missing toolAssembly
    };

    const res = await CollisionAuthority.evaluate(invalidInput);
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.severity).toBe(CollisionSeverity.FATAL_FAILURE);
    expect(res.provenSafe).toBe(false);
    expect(res.failureState.isFailed).toBe(true);
  });

  it('T03 / V04 / P0-G06: Kernel exception in provider fails-closed to ANALYSIS_FAILED, never NO_COLLISION', async () => {
    const throwingProvider: CollisionProvider = {
      capabilities: {
        providerId: 'THROWING_PROVIDER',
        providerName: 'Crashing Kernel',
        algorithmVersion: '1.0.0',
        exactnessLevel: CollisionExactness.EXACT,
        limitations: [],
        supportsStaticCollision: true,
        supportsContinuousCollision: false,
        supportsMeshMesh: false,
        supportsToolStock: false,
        supportsToolFixture: false,
        supportsHolderCollision: false,
        supportsMachineCollision: false,
        supportsBRep: false,
        supportsGouge: false,
        supportsClearance: false
      },
      evaluate: () => {
        throw new Error('OCCT BRepAlgoAPI Boolean intersection fatal core dump');
      }
    };

    CollisionAuthority.registerProvider(throwingProvider);
    const res = await CollisionAuthority.evaluate(validCamInput);

    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.severity).toBe(CollisionSeverity.FATAL_FAILURE);
    expect(res.provenSafe).toBe(false);
    expect(res.failureState.failureReason).toContain('OCCT BRepAlgoAPI Boolean intersection fatal core dump');
  });

  it('T04 / V03 / P0-G05: Unregistered provider fails-closed to ANALYSIS_FAILED', async () => {
    const res = await CollisionAuthority.evaluate(validCamInput, 'NON_EXISTENT_PROVIDER');
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  it('T05 / V05 / P0-G07: Approximate/Sampled legacy adapter retains explicit exactness level and cannot claim EXACT', async () => {
    const vertexSamplingAdapter = new LegacyCollisionAdapter(
      'LEGACY_VERTEX_SAMPLER',
      'Legacy 5-Axis Vertex Sampler',
      '0.8.0',
      CollisionExactness.APPROXIMATE,
      ['Omits obstacle triangle faces', 'Tests only vertices'],
      { supportsStaticCollision: true, supportsContinuousCollision: false },
      () => ({ status: CollisionStatus.NO_COLLISION, minClearanceMm: 12.0 })
    );

    CollisionAuthority.registerProvider(vertexSamplingAdapter);
    const res = await CollisionAuthority.evaluate(validCamInput, 'LEGACY_VERTEX_SAMPLER');

    expect(res.exactness).toBe(CollisionExactness.APPROXIMATE);
    expect(vertexSamplingAdapter.capabilities.limitations).toContain('Omits obstacle triangle faces');
  });

  it('T06 / P0-G08: Canonical result is deeply immutable', async () => {
    CollisionAuthority.registerProvider(dummyProvider);
    const res = await CollisionAuthority.evaluate(validCamInput);

    expect(Object.isFrozen(res)).toBe(true);
    expect(Object.isFrozen(res.metrics)).toBe(true);
    expect(Object.isFrozen(res.contactManifold)).toBe(true);
    expect(Object.isFrozen(res.failureState)).toBe(true);

    // Attempting to mutate in strict mode will throw
    expect(() => {
      (res as any).status = CollisionStatus.PENETRATION;
    }).toThrow();
  });

  it('T07 / V06 / P0-G09: Deterministic normalization guarantees identical contact ordering and output on repeat', async () => {
    const multiContactProvider: CollisionProvider = {
      capabilities: { ...dummyProvider.capabilities, providerId: 'MULTI_CONTACT_PROVIDER' },
      evaluate: () => ({
        status: CollisionStatus.PENETRATION,
        maxPenetrationDepthMm: 2.5,
        contacts: [
          { position: { x: 10, y: 20, z: 30 }, normal: { x: 0, y: 0, z: 1 }, penetrationDepth: 1.0, entityIdA: 'FACE_Z', entityIdB: 'TOOL_FLUTE' },
          { position: { x: 5, y: 5, z: 0 }, normal: { x: 0, y: 1, z: 0 }, penetrationDepth: 2.5, entityIdA: 'FACE_A', entityIdB: 'TOOL_SHANK' },
          { position: { x: 8, y: 8, z: 1 }, normal: { x: 1, y: 0, z: 0 }, penetrationDepth: 0.5, entityIdA: 'FACE_A', entityIdB: 'TOOL_HOLDER' }
        ]
      })
    };

    CollisionAuthority.registerProvider(multiContactProvider);
    const res1 = await CollisionAuthority.evaluate(validCamInput, 'MULTI_CONTACT_PROVIDER');
    const res2 = await CollisionAuthority.evaluate(validCamInput, 'MULTI_CONTACT_PROVIDER');

    // Sorted deterministically by entityIdA, entityIdB
    expect(res1.contactManifold[0].entityIdA).toBe('FACE_A');
    expect(res1.contactManifold[0].entityIdB).toBe('TOOL_HOLDER');
    expect(res1.contactManifold[1].entityIdA).toBe('FACE_A');
    expect(res1.contactManifold[1].entityIdB).toBe('TOOL_SHANK');
    expect(res1.contactManifold[2].entityIdA).toBe('FACE_Z');

    expect(JSON.stringify(res1.contactManifold)).toBe(JSON.stringify(res2.contactManifold));
  });

  it('T08 / P0-G10: Inconsistent raw metrics are corrected fail-closed (positive penetration forces PENETRATION status)', async () => {
    const inconsistentProvider: CollisionProvider = {
      capabilities: { ...dummyProvider.capabilities, providerId: 'INCONSISTENT_PROVIDER' },
      evaluate: () => ({
        status: CollisionStatus.NO_COLLISION, // Claims safe
        maxPenetrationDepthMm: 1.84 // But has 1.84mm penetration!
      })
    };

    CollisionAuthority.registerProvider(inconsistentProvider);
    const res = await CollisionAuthority.evaluate(validCamInput, 'INCONSISTENT_PROVIDER');

    expect(res.status).toBe(CollisionStatus.PENETRATION);
    expect(res.severity).toBe(CollisionSeverity.CRITICAL_COLLISION);
    expect(res.provenSafe).toBe(false);
  });

  it('T09 / P0-G11: Negative or NaN tolerance profile parameters immediately fail-closed', async () => {
    CollisionAuthority.registerProvider(dummyProvider);
    const badTolInput: CanonicalCollisionInput = {
      ...validCamInput,
      toleranceProfile: {
        linearToleranceMm: -0.01, // Negative tolerance!
        angularToleranceDeg: 0.5,
        clearanceWarningMarginMm: 2.0,
        safeClearanceMarginMm: 0.5
      }
    };

    const res = await CollisionAuthority.evaluate(badTolInput);
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
    expect(res.failureState.failureReason).toContain('Invalid or negative toleranceProfile parameters');
  });

  it('T10 / P0-G12: evaluateSync handles synchronous providers with full contract compliance', () => {
    CollisionAuthority.registerProvider(dummyProvider);
    const res = CollisionAuthority.evaluateSync(validCamInput);

    expect(res.status).toBe(CollisionStatus.NO_COLLISION);
    expect(res.metrics.minClearanceMm).toBe(5.0);
    expect(res.provenSafe).toBe(true);
    expect(Object.isFrozen(res)).toBe(true);
  });
});
