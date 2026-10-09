/**
 * SECP CAD Kernel — GCS 3D DOF Analysis Tests
 * Phase 2 (PATCH-026)
 */

import { describe, it, expect } from 'vitest';
import { DegreeOfFreedom3DAnalyzer } from '../DegreeOfFreedom3DAnalyzer';
import { Model3D } from '../Constraint3DTypes';
import { EngineeringIdentity, EngineeringObjectType, IdentityClassification } from '../../identity/CanonicalEngineeringIdentity';

function createIdentity(id: string): EngineeringIdentity {
  return {
    identityId: id,
    objectType: EngineeringObjectType.GEOMETRY,
    projectId: id,
    revisionId: 'r1',
    objectVersion: 1,
    contentHash: `hash-${id}`,
    timestamp: new Date().toISOString(),
    createdBy: 'test',
    classification: IdentityClassification.PUBLIC,
    tags: []
  };
}

describe('3D Degree of Freedom Analyzer', () => {
  it('should return correct theoretical DOFs for primitives', () => {
    expect(DegreeOfFreedom3DAnalyzer.getEntityTheoreticalDOF('POINT_3D')).toBe(3);
    expect(DegreeOfFreedom3DAnalyzer.getEntityTheoreticalDOF('LINE_3D')).toBe(5);
    expect(DegreeOfFreedom3DAnalyzer.getEntityTheoreticalDOF('PLANE')).toBe(5);
    expect(DegreeOfFreedom3DAnalyzer.getEntityTheoreticalDOF('SPHERE')).toBe(4);
    expect(DegreeOfFreedom3DAnalyzer.getEntityTheoreticalDOF('CIRCLE_3D')).toBe(6);
  });

  it('should compute the rank of a simple identity matrix', () => {
    const I = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    expect(DegreeOfFreedom3DAnalyzer.computeMatrixRank(I)).toBe(3);
  });

  it('should compute the rank of a dependent row matrix', () => {
    const A = [
      [1, 2, 3],
      [2, 4, 6], // Row 2 is 2x Row 1
      [0, 1, 1],
    ];
    expect(DegreeOfFreedom3DAnalyzer.computeMatrixRank(A)).toBe(2);
  });

  it('should perform comprehensive model DOF report accounting', () => {
    const model: Model3D = {
      id: createIdentity('model-1'),
      entities: [
        {
          id: createIdentity('p1'),
          type: 'POINT_3D',
          geometry: { type: 'POINT_3D', data: { x: 0, y: 0, z: 0 } },
          provenance: {
            id: 'p1',
            type: 'GEOMETRY',
            engineeringIdentityId: 'p1',
            canonicalHash: 'H1',
            version: '1',
            createdAt: '',
            evidenceRefs: [],
          },
        },
      ],
      version: 1,
    };

    // A single point has 3 DOFs
    const report = DegreeOfFreedom3DAnalyzer.analyze(model, []);
    expect(report.initialDOF).toBe(3);
    expect(report.estimatedRemainingDOF).toBe(3);
    expect(report.status).toBe('UNDER_CONSTRAINED');
  });
});
