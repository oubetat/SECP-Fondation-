/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-064: SST k-omega Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { SstKomegaModel } from '../SstKomegaModel';
import { SstKomegaConstants } from '../SstKomegaConstants';
import { SstIndependentVerifier } from '../SstIndependentVerifier';
import { CFDMesh3D } from '../../../mesh/CFDMeshTypes';

describe('PATCH-064: SST k-omega Core Tests', () => {
  const mesh: CFDMesh3D = {
    meshId: 'test-mesh-064',
    cells: [{ id: 0, volume: 1.0, center: [0.5, 0, 0] }],
    faces: [
      { id: 0, area: 1.0, normal: [-1.0, 0, 0], ownerCellId: 0, neighborCellId: null, isBoundary: true },
      { id: 1, area: 1.0, normal: [1.0, 0, 0], ownerCellId: 0, neighborCellId: null, isBoundary: true }
    ],
    boundaryConditions: []
  };

  const meanVelocity: [number, number, number][] = [[1.0, 0.0, 0.0]];
  const material = { density: 1.2, viscosity: 1.8e-5, isConstant: true };

  it('Verify SstKomega Constants', () => {
    expect(SstKomegaConstants.betaStar).toBe(0.09);
    expect(SstKomegaConstants.a1).toBe(0.31);
  });

  it('Verify Model Initialization & Real Evaluation', () => {
    const model = new SstKomegaModel();
    const initialState = model.initialize(mesh, { meanVelocity } as any, material, {});
    
    expect(initialState.fields['k']).toBeDefined();
    expect(initialState.fields['omega']).toBeDefined();
    expect(initialState.wallDistance).toBeDefined();

    const finalState = model.evaluate(initialState);
    
    expect(finalState.turbulentViscosity[0]).toBeGreaterThan(0);
    expect(finalState.production[0]).toBeGreaterThan(0);
    expect(finalState.dissipation[0]).toBeGreaterThan(0);

    // Blending functions bounding check: 0 <= F1, F2 <= 1
    const verifyResult = SstIndependentVerifier.verify(finalState);
    expect(verifyResult.isValid).toBe(true);
  });
});
