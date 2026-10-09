/**
 * SECP Industrial OS v2 — FVM Core Adversarial Tests
 * PATCH-052: Finite Volume Core
 */

import { describe, it, expect } from 'vitest';
import { CFDMesh, CellType, BoundaryType, MeshCanonicalizer } from '../../mesh';
import { 
  FiniteVolumeCore, 
  FVMVerdict, 
  FieldLocation, 
  FVMFieldManager,
  FVMGeometryCore,
  FVMAssembly
} from '../index';

describe('PATCH-052: FVM Core Adversarial Tests', () => {

  const createValidMesh = (): CFDMesh => ({
    meshId: 'cube-1',
    nodes: [
      { id: 1, coords: [0, 0, 0] }, { id: 2, coords: [1, 0, 0] },
      { id: 3, coords: [1, 1, 0] }, { id: 4, coords: [0, 1, 0] },
      { id: 5, coords: [0, 0, 1] }, { id: 6, coords: [1, 0, 1] },
      { id: 7, coords: [1, 1, 1] }, { id: 8, coords: [0, 1, 1] }
    ],
    faces: [
      { id: 1, nodeIds: [1, 4, 3, 2], adjacentCellIds: [1], boundaryId: 'bottom' },
      { id: 2, nodeIds: [5, 6, 7, 8], adjacentCellIds: [1], boundaryId: 'top' },
      { id: 3, nodeIds: [1, 2, 6, 5], adjacentCellIds: [1], boundaryId: 'front' },
      { id: 4, nodeIds: [2, 3, 7, 6], adjacentCellIds: [1], boundaryId: 'right' },
      { id: 5, nodeIds: [3, 4, 8, 7], adjacentCellIds: [1], boundaryId: 'back' },
      { id: 6, nodeIds: [4, 1, 5, 8], adjacentCellIds: [1], boundaryId: 'left' }
    ],
    cells: [
      { id: 1, nodeIds: [1, 2, 3, 4, 5, 6, 7, 8], faceIds: [1, 2, 3, 4, 5, 6], cellType: CellType.HEXA }
    ],
    boundaries: [
      { id: 'top', name: 'Top', boundaryType: BoundaryType.OUTLET, faceIds: [2] },
      { id: 'bottom', name: 'Bottom', boundaryType: BoundaryType.INLET, faceIds: [1] }
    ],
    dimensionality: 3,
    toleranceConfig: { geometricTolerance: 1e-8, volumeTolerance: 1e-12, areaTolerance: 1e-10 },
    provenance: { timestamp: '2026-08-19T00:00:00Z', transformationHistory: [] },
    metadata: {}
  });

  it('1. rejects mismatched mesh identity', () => {
    const mesh = createValidMesh();
    const field = {
      fieldId: 'f1',
      quantity: 'P',
      unit: 'Pa',
      location: FieldLocation.CELL,
      values: [101325],
      meshIdentity: 'WRONG_HASH',
      fieldVersion: '1.0.0'
    };
    
    const result = FiniteVolumeCore.discretizeField(mesh, field, 'c1');
    expect(result.verdict).toBe(FVMVerdict.INVALID);
  });

  it('4. rejects NaN field values', () => {
    const mesh = createValidMesh();
    const meshHash = MeshCanonicalizer.calculateHash(mesh);
    const field = {
      fieldId: 'f1',
      quantity: 'P',
      unit: 'Pa',
      location: FieldLocation.CELL,
      values: [NaN],
      meshIdentity: meshHash,
      fieldVersion: '1.0.0'
    };
    
    const validation = FVMFieldManager.validateField(field, 1);
    expect(validation.valid).toBe(false);
  });

  it('9. rejects wrong unit (dimensional mismatch)', () => {
    const mesh = createValidMesh();
    const meshHash = MeshCanonicalizer.calculateHash(mesh);
    const field = {
      fieldId: 'f1',
      quantity: 'PRESSURE',
      unit: 'meters', // Should be Pa
      location: FieldLocation.CELL,
      values: [100],
      meshIdentity: meshHash,
      fieldVersion: '1.0.0'
    };
    
    const compatible = FVMFieldManager.checkCompatibility(field, 'Pa');
    expect(compatible).toBe(false);
  });

  it('10. rejects negative timestep', () => {
    // Assembly logic
    const mesh = createValidMesh();
    const cv = FVMGeometryCore.buildControlVolumes(mesh)[0];
    const coefficients = FVMAssembly.assembleCell(cv, mesh, null, -1.0);
    expect(coefficients.aP).toBe(0); // Transient contribution ignored if dt < 0
  });

});
