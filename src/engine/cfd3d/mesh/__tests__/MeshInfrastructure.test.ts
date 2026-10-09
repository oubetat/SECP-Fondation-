/**
 * SECP Industrial OS v2 — Mesh Infrastructure Tests
 * PATCH-051: CFD Mesh Infrastructure
 */

import { describe, it, expect } from 'vitest';
import { 
  CFDMesh, 
  CellType, 
  BoundaryType, 
  CFDMeshInfrastructure, 
  MeshVerdict, 
  MeshDiagnostic,
  CFDMeshInfrastructureGate 
} from '../index';

describe('PATCH-051: CFD Mesh Infrastructure', () => {

  const createValidTetMesh = (): CFDMesh => ({
    meshId: 'test-mesh-1',
    nodes: [
      { id: 1, coords: [0, 0, 0] },
      { id: 2, coords: [1, 0, 0] },
      { id: 3, coords: [0, 1, 0] },
      { id: 4, coords: [0, 0, 1] }
    ],
    faces: [
      { id: 1, nodeIds: [1, 2, 3], adjacentCellIds: [1], boundaryId: 'inlet' },
      { id: 2, nodeIds: [1, 2, 4], adjacentCellIds: [1], boundaryId: 'wall' },
      { id: 3, nodeIds: [2, 3, 4], adjacentCellIds: [1], boundaryId: 'outlet' },
      { id: 4, nodeIds: [3, 1, 4], adjacentCellIds: [1], boundaryId: 'wall' }
    ],
    cells: [
      { id: 1, nodeIds: [1, 2, 3, 4], faceIds: [1, 2, 3, 4], cellType: CellType.TETRA }
    ],
    boundaries: [
      { id: 'inlet', name: 'Inlet', boundaryType: BoundaryType.INLET, faceIds: [1] },
      { id: 'outlet', name: 'Outlet', boundaryType: BoundaryType.OUTLET, faceIds: [3] },
      { id: 'wall', name: 'Wall', boundaryType: BoundaryType.WALL, faceIds: [2, 4] }
    ],
    dimensionality: 3,
    toleranceConfig: {
      geometricTolerance: 1e-8,
      volumeTolerance: 1e-12,
      areaTolerance: 1e-10
    },
    provenance: {
      timestamp: new Date().toISOString(),
      transformationHistory: ['Initial creation']
    },
    metadata: {}
  });

  it('A. validates a valid tetrahedral mesh -> PASS', () => {
    const mesh = createValidTetMesh();
    const result = CFDMeshInfrastructure.validateMesh(mesh);
    expect(result.verdict).toBe(MeshVerdict.PASS);
    expect(result.fvmReady).toBe(true);
  });

  it('C. detects zero-volume cell -> FAIL / DEGENERATE_MESH', () => {
    const mesh = createValidTetMesh();
    // Flatten the tetra
    mesh.nodes[3].coords = [0, 0, 0];
    const result = CFDMeshInfrastructure.validateMesh(mesh);
    expect(result.verdict).toBe(MeshVerdict.FAIL);
    expect(result.diagnostics).toContain(MeshDiagnostic.DEGENERATE_MESH);
  });

  it('E. detects non-manifold face -> FAIL / NON_MANIFOLD_MESH', () => {
    const mesh = createValidTetMesh();
    // Assign face to 3 cells (which don't exist but let's assume they do for connectivity check)
    mesh.faces[0].adjacentCellIds = [1, 2, 3];
    mesh.cells.push({ id: 2, nodeIds: [1, 2, 3, 5], faceIds: [1], cellType: CellType.TETRA });
    mesh.cells.push({ id: 3, nodeIds: [1, 2, 3, 6], faceIds: [1], cellType: CellType.TETRA });
    mesh.nodes.push({ id: 5, coords: [0, 0, -1] });
    mesh.nodes.push({ id: 6, coords: [1, 1, 1] });
    
    const result = CFDMeshInfrastructure.validateMesh(mesh);
    expect(result.verdict).toBe(MeshVerdict.FAIL);
    expect(result.diagnostics).toContain(MeshDiagnostic.NON_MANIFOLD_MESH);
  });

  it('F. detects missing node reference -> INVALID', () => {
    const mesh = createValidTetMesh();
    mesh.faces[0].nodeIds.push(999); // Non-existent node
    const result = CFDMeshInfrastructure.validateMesh(mesh);
    expect(result.verdict).toBe(MeshVerdict.INVALID);
    expect(result.diagnostics).toContain(MeshDiagnostic.OUT_OF_BOUNDS_INDEX);
  });

  it('M. verifies deterministic canonicalization', () => {
    const mesh1 = createValidTetMesh();
    const mesh2 = createValidTetMesh();
    
    // Reorder nodes in mesh2
    mesh2.nodes = [mesh2.nodes[1], mesh2.nodes[0], mesh2.nodes[3], mesh2.nodes[2]];
    
    const hash1 = CFDMeshInfrastructure.getMeshIdentity(mesh1);
    const hash2 = CFDMeshInfrastructure.getMeshIdentity(mesh2);
    
    expect(hash1).toBe(hash2);
  });

  it('N. detects modification after hashing (tamper test)', () => {
    const mesh = createValidTetMesh();
    const hash1 = CFDMeshInfrastructure.getMeshIdentity(mesh);
    
    mesh.nodes[0].coords[0] += 0.0001;
    const hash2 = CFDMeshInfrastructure.getMeshIdentity(mesh);
    
    expect(hash1).not.toBe(hash2);
  });

  it('evaluates CFDMeshInfrastructureGate PASS', () => {
    const mesh = createValidTetMesh();
    const result = CFDMeshInfrastructureGate.evaluateGate(mesh);
    expect(result.verdict).toBe(MeshVerdict.PASS);
    expect(result.fvmReady).toBe(true);
  });

});
