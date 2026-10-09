/**
 * SECP Industrial OS v3 — Collision Authority Core
 * P3 Canonical CAD Geometry Binding Adversarial Mutation Suite
 * MISSION: COLLISION-ENGINE-P3-CANONICAL-CAD-BINDING-001
 * TOTAL MUTATIONS: 20 (Verified Executable)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CollisionAuthority,
  CollisionStatus,
  CanonicalCollisionInput,
  CanonicalCollisionGeometry,
  HardAcceptanceGateP3
} from '../index';
import { CanonicalGeometryAdapter } from '../adapters/CanonicalGeometryAdapter';
import { EngineeringDocument, DEFAULT_UNIT_SYSTEM_MM } from '../../cad-kernel/document/CADDocument';

describe('P3 Canonical CAD Geometry Binding — 20 Mandatory Adversarial Mutations', () => {
  let docA: EngineeringDocument;
  let baseGeo: CanonicalCollisionGeometry;

  beforeEach(() => {
    CollisionAuthority.ensureDefaultProviders();
    const resolver = CollisionAuthority.getResolver();
    resolver.clear();

    docA = {
      documentId: 'DOC_TEST_A',
      revision: 1,
      name: 'Test Part A',
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {
        geometryHash: 'HASH_DOC_A_REV_1',
        topologyHash: 'TOPO_DOC_A_REV_1',
        mesh: { normals: [], facesCount: 0, topologyMap: { faceTriangleMap: {}, edgeVertexMap: {}, vertexIndexMap: {}, sharedEdges: [] }, brepHash: "MOCK", meshHash: "MOCK", 
          vertices: Array.from(new Float32Array([-10, -10, -10, 10, 10, 10])),
          indices: Array.from(new Uint32Array([0, 1, 2]))
        }
      },
      evidence: []
    };
    resolver.register(docA);
    baseGeo = CanonicalGeometryAdapter.adapt(docA);
  });

  const baseInput: CanonicalCollisionInput = {
    domain: 'ASSEMBLY',
    coordinateFrame: 'WCS',
    units: 'MILLIMETERS',
    toleranceProfile: { linearToleranceMm: 0.005, angularToleranceDeg: 0.5, clearanceWarningMarginMm: 2.0, safeClearanceMarginMm: 0.5 },
    cadRevisionId: '1',
    canonicalGeometry: undefined
  };

  // M01: Missing document
  it('M01: Missing document ID in canonical geometry fails closed with INVALID_GEOMETRY', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: { ...baseGeo, documentId: '' }
    });
    expect(res.status).toBe(CollisionStatus.INVALID_GEOMETRY);
    expect(res.provenSafe).toBe(false);
  });

  // M02: Missing revision
  it('M02: Missing revision ID in canonical geometry fails closed with INVALID_GEOMETRY', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: { ...baseGeo, revisionId: '' }
    });
    expect(res.status).toBe(CollisionStatus.INVALID_GEOMETRY);
    expect(res.provenSafe).toBe(false);
  });

  // M03: Missing geometry
  it('M03: Missing geometry ID in canonical contract fails closed with INVALID_GEOMETRY', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: { ...baseGeo, geometryId: '' }
    });
    expect(res.status).toBe(CollisionStatus.INVALID_GEOMETRY);
    expect(res.provenSafe).toBe(false);
  });

  // M04: Stale revision
  it('M04: Stale revision ID not matching registered CAD document fails closed with ANALYSIS_FAILED', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: { ...baseGeo, revisionId: '99' }
    });
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M05: Stale geometry
  it('M05: Stale geometry hash fails closed with ANALYSIS_FAILED', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: { ...baseGeo, geometryHash: 'OLD_STALE_HASH_V0' }
    });
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M06: Wrong geometry ID
  it('M06: Unregistered geometry ID or document ID mismatch is rejected fail-closed', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: { ...baseGeo, documentId: 'WRONG_DOC_ID' }
    });
    expect(res.provenSafe).toBe(false);
  });

  // M07: Wrong snapshot ID
  it('M07: Empty snapshot ID fails closed with INVALID_GEOMETRY', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: { ...baseGeo, snapshotId: '' }
    });
    expect(res.status).toBe(CollisionStatus.INVALID_GEOMETRY);
    expect(res.provenSafe).toBe(false);
  });

  // M08: Modified geometry
  it('M08: Geometry modified behind-the-scenes is caught via hash mismatch', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: { ...baseGeo, geometryHash: 'MODIFIED_EXTERNAL_HASH' }
    });
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M09: Deleted geometry
  it('M09: Accessing deleted or unregistered document geometry fails closed', () => {
    CollisionAuthority.getResolver().unregister(docA.documentId);
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: baseGeo
    });
    expect(res.provenSafe).toBe(false);
  });

  // M10: Malformed topology
  it('M10: Malformed/Empty topology identity is rejected with INVALID_GEOMETRY', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: { ...baseGeo, topologyIdentity: '' }
    });
    expect(res.status).toBe(CollisionStatus.INVALID_GEOMETRY);
    expect(res.provenSafe).toBe(false);
  });

  // M11: NaN coordinate
  it('M11: NaN bounding coordinate is detected and rejected fail-closed', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: {
        ...baseGeo,
        bounds: { min: { x: NaN, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } }
      }
    });
    expect(res.status).toBe(CollisionStatus.INVALID_GEOMETRY);
    expect(res.provenSafe).toBe(false);
  });

  // M12: Infinity coordinate
  it('M12: Infinity bounding coordinate is detected and rejected fail-closed', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: {
        ...baseGeo,
        bounds: { min: { x: -Infinity, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } }
      }
    });
    expect(res.status).toBe(CollisionStatus.INVALID_GEOMETRY);
    expect(res.provenSafe).toBe(false);
  });

  // M13: Invalid transform / Non-finite metrics
  it('M13: Negative tolerance or invalid transform parameter triggers fail-closed error', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      toleranceProfile: { ...baseInput.toleranceProfile, linearToleranceMm: -1.0 },
      canonicalGeometry: baseGeo
    });
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M14: Missing coordinate frame
  it('M14: Missing coordinate frame fails input validation', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      coordinateFrame: '' as any,
      canonicalGeometry: baseGeo
    });
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M15: Wrong coordinate frame
  it('M15: Mismatched coordinate frame between input and canonical geometry fails closed', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      coordinateFrame: 'MCS',
      canonicalGeometry: { ...baseGeo, coordinateFrame: 'WCS' }
    });
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M16: Unit mismatch
  it('M16: Unit system mismatch between caller and CAD geometry fails closed', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      units: 'INCHES',
      canonicalGeometry: { ...baseGeo, units: 'MILLIMETERS' }
    });
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M17: Forged geometry hash
  it('M17: Forged geometry hash does not match registry and fails closed', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: { ...baseGeo, geometryHash: 'FORGED_GEO_HASH_999' }
    });
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // M18: Duplicate geometry identity
  it('M18: Extracting geometry repeatedly preserves identical deterministic IDs', () => {
    const geo1 = CanonicalGeometryAdapter.adapt(docA);
    const geo2 = CanonicalGeometryAdapter.adapt(docA);
    expect(geo1.geometryId).toBe(geo2.geometryId);
    expect(geo1.snapshotId).toBe(geo2.snapshotId);
    expect(geo1.geometryHash).toBe(geo2.geometryHash);
  });

  // M19: Synthetic geometry injected into production path
  it('M19: Synthetic geometry is rejected for authoritative evaluation in production paths', () => {
    const syntheticGeo: CanonicalCollisionGeometry = {
      ...baseGeo,
      geometrySource: 'SYNTHETIC'
    };
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: syntheticGeo
    });
    expect(res.status).toBe(CollisionStatus.UNSUPPORTED);
    expect(res.provenSafe).toBe(false);
  });

  // M20: Canonical binding removed at runtime
  it('M20: Removing canonical geometry binding at runtime prevents authoritative safe result', () => {
    const res = CollisionAuthority.evaluateSync({
      ...baseInput,
      canonicalGeometry: undefined
    });
    // When canonical geometry is missing, result does not have authoritative CAD provenance
    expect(res.provenance.geometryHash).toBeUndefined();
  });

  // Gate execution verification
  it('G01-G24: Hard Acceptance Gate P3 executes with 100% PASS', async () => {
    const report = await HardAcceptanceGateP3.execute();
    expect(report.verdict).toBe('P3_CANONICAL_CAD_BINDING_FULLY_VERIFIED');
    expect(report.passedGates).toBe(24);
    expect(report.failedGates).toBe(0);
  });
});
