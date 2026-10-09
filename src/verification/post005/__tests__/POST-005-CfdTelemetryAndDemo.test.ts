import { describe, it, expect } from 'vitest';
import { Fvm3DNavierStokesSolver } from '../../../engine/cfd3d/Fvm3DNavierStokesSolver';
import { FvmMesh3D, FluidProperties3D, BoundaryConditionSpec3D, SolverConfig3D } from '../../../engine/cfd3d/Fvm3DTypes';

describe('POST-005 Track C: CFD Telemetry & Forensic Verification', () => {
  function createMinimalHexMesh(): FvmMesh3D {
    return {
      meshId: 'TEST-HEX-2CELL',
      cells: [
        {
          cellId: 0,
          centroid: { x: 0.5, y: 0.5, z: 0.5 },
          volume: 1.0,
          faceIds: [0, 1, 2, 3, 4, 5],
          neighborCellIds: [1],
          boundaryFaceIds: [0, 2, 3, 4, 5],
          skewness: 0,
          aspectRatio: 1,
          nonOrthogonalityDeg: 0,
          dx: 1, dy: 1, dz: 1
        },
        {
          cellId: 1,
          centroid: { x: 1.5, y: 0.5, z: 0.5 },
          volume: 1.0,
          faceIds: [1, 6, 7, 8, 9, 10],
          neighborCellIds: [0],
          boundaryFaceIds: [6, 7, 8, 9, 10],
          skewness: 0,
          aspectRatio: 1,
          nonOrthogonalityDeg: 0,
          dx: 1, dy: 1, dz: 1
        }
      ],
      faces: [
        { faceId: 0, centroid: { x: 0, y: 0.5, z: 0.5 }, area: 1.0, normal: { x: -1, y: 0, z: 0 }, ownerCellId: 0, neighborCellId: -1, boundaryType: 'INLET', u_bc: 10, v_bc: 0, w_bc: 0 },
        { faceId: 1, centroid: { x: 1.0, y: 0.5, z: 0.5 }, area: 1.0, normal: { x: 1, y: 0, z: 0 }, ownerCellId: 0, neighborCellId: 1, boundaryType: 'INTERNAL' },
        { faceId: 2, centroid: { x: 0.5, y: 0, z: 0.5 }, area: 1.0, normal: { x: 0, y: -1, z: 0 }, ownerCellId: 0, neighborCellId: -1, boundaryType: 'WALL' },
        { faceId: 3, centroid: { x: 0.5, y: 1.0, z: 0.5 }, area: 1.0, normal: { x: 0, y: 1, z: 0 }, ownerCellId: 0, neighborCellId: -1, boundaryType: 'WALL' },
        { faceId: 4, centroid: { x: 0.5, y: 0.5, z: 0 }, area: 1.0, normal: { x: 0, y: 0, z: -1 }, ownerCellId: 0, neighborCellId: -1, boundaryType: 'WALL' },
        { faceId: 5, centroid: { x: 0.5, y: 0.5, z: 1.0 }, area: 1.0, normal: { x: 0, y: 0, z: 1 }, ownerCellId: 0, neighborCellId: -1, boundaryType: 'WALL' },
        { faceId: 6, centroid: { x: 2.0, y: 0.5, z: 0.5 }, area: 1.0, normal: { x: 1, y: 0, z: 0 }, ownerCellId: 1, neighborCellId: -1, boundaryType: 'OUTLET', p_bc: 0 },
        { faceId: 7, centroid: { x: 1.5, y: 0, z: 0.5 }, area: 1.0, normal: { x: 0, y: -1, z: 0 }, ownerCellId: 1, neighborCellId: -1, boundaryType: 'WALL' },
        { faceId: 8, centroid: { x: 1.5, y: 1.0, z: 0.5 }, area: 1.0, normal: { x: 0, y: 1, z: 0 }, ownerCellId: 1, neighborCellId: -1, boundaryType: 'WALL' },
        { faceId: 9, centroid: { x: 1.5, y: 0.5, z: 0 }, area: 1.0, normal: { x: 0, y: 0, z: -1 }, ownerCellId: 1, neighborCellId: -1, boundaryType: 'WALL' },
        { faceId: 10, centroid: { x: 1.5, y: 0.5, z: 1.0 }, area: 1.0, normal: { x: 0, y: 0, z: 1 }, ownerCellId: 1, neighborCellId: -1, boundaryType: 'WALL' }
      ],
      nodes: [],
      quality: {
        totalCells: 2,
        totalFaces: 11,
        totalBoundaryFaces: 10,
        minCellVolume: 1,
        maxCellVolume: 1,
        maxSkewness: 0,
        maxAspectRatio: 1,
        maxNonOrthogonalityDeg: 0,
        hasPositiveVolumes: true,
        hasNonzeroAreas: true,
        isClosedTopology: true,
        isNeighborConsistent: true,
        hasDegenerateCells: false,
        meshQualityStatus: 'EXCELLENT',
        passed: true
      },
      boundingBox: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 2, y: 1, z: 1 }
      }
    };
  }

  const fluid: FluidProperties3D = {
    densityKgM3: 1.225,
    viscosityPaS: 1.8e-5
  };

  const bcSpec: BoundaryConditionSpec3D = {
    inletVelocityMS: { x: 10, y: 0, z: 0 },
    outletPressurePa: 0
  };

  const config: SolverConfig3D = {
    maxIterations: 5,
    continuityTol: 1e-4,
    momentumTol: 1e-4,
    underRelaxationVelocity: 0.7,
    underRelaxationPressure: 0.3,
    useTurbulenceModel: false,
    turbulenceScheme: 'K_EPSILON',
    upwindScheme: 'FIRST_ORDER_UPWIND'
  };

  it('GAP-012: Captures and exports limiters telemetry (velocityClamped, pressureClamped)', () => {
    const mesh = createMinimalHexMesh();
    const result = Fvm3DNavierStokesSolver.solve(mesh, fluid, bcSpec, config, 1.0, 10.0);

    expect(result.convergenceAudit).toBeDefined();
    expect(result.convergenceAudit!.limiters).toBeDefined();
    expect(typeof result.convergenceAudit!.limiters!.velocityClamped).toBe('number');
    expect(typeof result.convergenceAudit!.limiters!.pressureClamped).toBe('number');
    expect(result.convergenceAudit!.limiters!.velocityClamped).toBeGreaterThanOrEqual(0);
  });

  it('GAP-013: Captures structured firstInvalidCell diagnostic on non-finite fields', () => {
    const mesh = createMinimalHexMesh();
    
    // Pass NaN initial fields on interior cell 1 to trigger divergence capture
    try {
      Fvm3DNavierStokesSolver.solve(mesh, fluid, bcSpec, config, 1.0, 10.0, {
        u: [10, NaN],
        v: [0, 0],
        w: [0, 0],
        p: [0, 0]
      });
      // Should not reach here
      expect.unreachable();
    } catch (err: any) {
      expect(err.message).toMatch(/SECP-083-DIAGNOSTIC-FAILURE/);
      expect(err.firstInvalidCell).toBeDefined();
      expect(err.firstInvalidCell.cellId).toBeGreaterThanOrEqual(0);
      expect(err.firstInvalidCell.reason).toMatch(/Non-finite variable/);
    }
  });
});
