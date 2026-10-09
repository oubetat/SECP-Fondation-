/**
 * SECP Industrial OS v2 — Finite Volume Core Tests
 * PATCH-052: Finite Volume Core
 */

import { describe, it, expect } from 'vitest';
import { CFDMesh, CellType, BoundaryType, MeshCanonicalizer } from '../../mesh';
import { 
  FiniteVolumeCore, 
  FVMVerdict, 
  FieldLocation, 
  FVMOperators, 
  FVMGeometryCore,
  FVMAssembly
} from '../index';

describe('PATCH-052: Finite Volume Core', () => {

  const createCubeMesh = (): CFDMesh => {
    // 1x1x1 cube centered at [0.5, 0.5, 0.5]
    return {
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
    };
  };

  it('B. calculates zero divergence for a uniform vector field', () => {
    const mesh = createCubeMesh();
    const cv = FVMGeometryCore.buildControlVolumes(mesh)[0];
    
    // Uniform vector field F = [1, 0, 0]
    const faceFluxes = new Map<number, [number, number, number]>();
    for (const f of mesh.faces) {
      faceFluxes.set(f.id, [1, 0, 0]);
    }
    
    const div = FVMOperators.calculateDivergence(cv, faceFluxes, mesh);
    expect(Math.abs(div)).toBeLessThan(1e-10);
  });

  it('C. calculates correct gradient for a linear scalar field', () => {
    const mesh = createCubeMesh();
    const cv = FVMGeometryCore.buildControlVolumes(mesh)[0];
    
    // Linear scalar field phi = 2x + 3y + 4z
    // Grad should be [2, 3, 4]
    const faceValues = new Map<number, number>();
    for (const f of mesh.faces) {
      const centroid = FVMGeometryCore.buildFVMFace(f, mesh, 1).centroid;
      faceValues.set(f.id, 2 * centroid[0] + 3 * centroid[1] + 4 * centroid[2]);
    }
    
    const grad = FVMOperators.calculateGradient(cv, faceValues, mesh);
    expect(Math.abs(grad[0] - 2)).toBeLessThan(1e-10);
    expect(Math.abs(grad[1] - 3)).toBeLessThan(1e-10);
    expect(Math.abs(grad[2] - 4)).toBeLessThan(1e-10);
  });

  it('F. verifies internal face antisymmetry', () => {
    // Create 2 adjacent cubes
    const mesh = createCubeMesh();
    // Add second cube
    mesh.nodes.push(
      { id: 9, coords: [2, 0, 0] }, { id: 10, coords: [2, 1, 0] },
      { id: 11, coords: [2, 0, 1] }, { id: 12, coords: [2, 1, 1] }
    );
    // Face 4 (x=1) is shared
    mesh.faces[3].adjacentCellIds = [1, 2];
    mesh.faces[3].boundaryId = undefined;
    
    // Add cell 2
    // We need at least another face to pull the centroid to x > 1
    mesh.faces.push({ id: 7, nodeIds: [9, 10, 12, 11], adjacentCellIds: [2], boundaryId: 'right2' });
    mesh.cells.push({
      id: 2,
      nodeIds: [2, 9, 10, 3, 6, 11, 12, 7],
      faceIds: [4, 7], 
      cellType: CellType.HEXA
    });
    
    const face4 = mesh.faces[3];
    const fvmFaceOwner = FVMGeometryCore.buildFVMFace(face4, mesh, 1);
    const fvmFaceNeighbor = FVMGeometryCore.buildFVMFace(face4, mesh, 2);
    
    // Physical flux vector
    const F: [number, number, number] = [1, 2, 3];
    const ownerFlux = F[0] * fvmFaceOwner.normal[0] + F[1] * fvmFaceOwner.normal[1] + F[2] * fvmFaceOwner.normal[2];
    const neighborFlux = F[0] * fvmFaceNeighbor.normal[0] + F[1] * fvmFaceNeighbor.normal[1] + F[2] * fvmFaceNeighbor.normal[2];
    
    const conservative = FVMAssembly.verifyInternalConservation(fvmFaceOwner, ownerFlux, neighborFlux, 1e-10);
    expect(conservative).toBe(true);
    expect(Math.abs(ownerFlux + neighborFlux)).toBeLessThan(1e-10);
  });

  it('discretizes a cell field with FiniteVolumeCore', () => {
    const mesh = createCubeMesh();
    const meshHash = MeshCanonicalizer.calculateHash(mesh);
    
    const field = {
      fieldId: 'temp-1',
      quantity: 'TEMPERATURE',
      unit: 'K',
      location: FieldLocation.CELL,
      values: [300],
      meshIdentity: meshHash,
      fieldVersion: '1.0.0'
    };
    
    const result = FiniteVolumeCore.discretizeField(mesh, field, 'test-case-1');
    expect(result.verdict).toBe(FVMVerdict.PASS);
  });

});
