
import { describe, it, expect } from 'vitest';
import { NURBSEngine322 } from '../../../src/engine/reverse_engineering/surfaces/NURBSEngine322';
import { AnalyticalReconstructionEngine321A } from '../../../src/engine/reverse_engineering/surfaces/AnalyticalReconstructionEngine321A';
import { MathUtils321A } from '../../../src/engine/reverse_engineering/surfaces/MathUtils321A';
import { NURBSUtils322 } from '../../../src/engine/reverse_engineering/surfaces/NURBSUtils322';
import { EvidenceBus314 } from '../../../src/engine/engineering_ai/copilot/EvidenceBus314';

// Helpers (reused from 321A tests)
function generatePlane(normal: number[], d: number, n: number): { vertices: any[] } {
  const norm = MathUtils321A.normalize(normal);
  const [u, v] = MathUtils321A.findOrthogonalBasis(norm);
  const origin = [-norm[0]*d, -norm[1]*d, -norm[2]*d];
  const vertices = [];
  for (let i = 0; i < n; i++) {
    const x = (Math.random() - 0.5) * 50;
    const y = (Math.random() - 0.5) * 50;
    vertices.push({
      id: i,
      position: [origin[0] + x * u[0] + y * v[0], origin[1] + x * u[1] + y * v[1], origin[2] + x * u[2] + y * v[2]],
      normal: norm
    });
  }
  return { vertices };
}

function generateCylinder(axisOrigin: number[], axisDir: number[], radius: number, n: number): { vertices: any[] } {
  const axis = MathUtils321A.normalize(axisDir);
  const [u, v] = MathUtils321A.findOrthogonalBasis(axis);
  const vertices = [];
  for (let i = 0; i < n; i++) {
    const h = (Math.random() - 0.5) * 100;
    const theta = Math.random() * Math.PI * 2;
    const nx = Math.cos(theta) * u[0] + Math.sin(theta) * v[0];
    const ny = Math.cos(theta) * u[1] + Math.sin(theta) * v[1];
    const nz = Math.cos(theta) * u[2] + Math.sin(theta) * v[2];
    vertices.push({
      id: i,
      position: [axisOrigin[0] + h * axis[0] + radius * nx, axisOrigin[1] + h * axis[1] + radius * ny, axisOrigin[2] + h * axis[2] + radius * nz],
      normal: [nx, ny, nz]
    });
  }
  return { vertices };
}

describe('PATCH-322: NURBS Surface Reconstruction', () => {
  const engine321A = AnalyticalReconstructionEngine321A.getInstance();
  const engine322 = NURBSEngine322.getInstance();
  const settings = { maxRmsToleranceMm: 0.1, maxErrorToleranceMm: 0.5, minPointsRequired: 10 };
  const mockMesh = { meshId: 'M-TEST', globalCoordinateFrame: 'WORLD_MM' } as any;

  describe('Plane Reconstruction', () => {
    it('exact plane to NURBS conversion', () => {
      const { vertices } = generatePlane([0, 0, 1], -10, 50);
      const analytical = engine321A.reconstructSurface({ parentMesh: mockMesh } as any, { segmentId: 'S1', vertices }, settings);
      
      expect(analytical).not.toBeNull();
      const nurbs = engine322.reconstructNURBS(analytical!);
      
      expect(nurbs).not.toBeNull();
      expect(nurbs!.data.degreeU).toBe(1);
      expect(nurbs!.data.degreeV).toBe(1);
      expect(nurbs!.rmsDeviationMm).toBeLessThan(1e-7);
    });
  });

  describe('Cylinder Reconstruction', () => {
    it('cylinder to NURBS conversion with rational weights', () => {
      const { vertices } = generateCylinder([0, 0, 0], [0, 0, 1], 25, 100);
      const analytical = engine321A.reconstructSurface({ parentMesh: mockMesh } as any, { segmentId: 'S2', vertices }, settings);
      
      expect(analytical).not.toBeNull();
      const nurbs = engine322.reconstructNURBS(analytical!);
      
      expect(nurbs).not.toBeNull();
      expect(nurbs!.data.isRational).toBe(true);
      expect(nurbs!.data.degreeU).toBe(2);
      expect(nurbs!.data.degreeV).toBe(1);
      expect(nurbs!.rmsDeviationMm).toBeLessThan(1e-7);
      
      // Verify weights
      const w = Math.sqrt(2)/2;
      expect(nurbs!.data.weights[1][0]).toBeCloseTo(w, 5);
    });
  });

  describe('Sphere & Cone Reconstruction', () => {
    it('sphere reconstruction validation', () => {
      // Manually create sphere to avoid fitting noise in 321A
      const analytical = {
        surfaceId: 'sphere-1',
        surfaceType: 'SPHERE',
        parameters: { center: [0, 0, 0], radius: 50 },
        provenance: { parentMeshId: 'M1', parentRegionId: 'R1' }
      } as any;

      const nurbs = engine322.reconstructNURBS(analytical);
      expect(nurbs).not.toBeNull();
      if (nurbs && nurbs.rmsDeviationMm >= 1e-7) {
        console.log(`Sphere RMS: ${nurbs.rmsDeviationMm}, Max: ${nurbs.maxDeviationMm}`);
      }
      expect(nurbs!.rmsDeviationMm).toBeLessThan(1e-7);

      const data = nurbs!.data;
      const radius = 50;

      // Permanent regression tests for sphere poles:
      // v = 0 must evaluate to the North Pole (0, 0, radius), independent of u
      for (let u = 0; u <= 1; u += 0.1) {
        const res = NURBSUtils322.evaluateSurface(data, u, 0);
        // Dist to center must equal radius
        const dist = Math.sqrt(res.point[0] ** 2 + res.point[1] ** 2 + res.point[2] ** 2);
        expect(dist).toBeCloseTo(radius, 9);
        // Should evaluate to exactly the north pole
        expect(res.point[0]).toBeCloseTo(0, 9);
        expect(res.point[1]).toBeCloseTo(0, 9);
        expect(res.point[2]).toBeCloseTo(radius, 9);
      }

      // v = 1 must evaluate to the South Pole (0, 0, -radius), independent of u
      for (let u = 0; u <= 1; u += 0.1) {
        const res = NURBSUtils322.evaluateSurface(data, u, 1);
        // Dist to center must equal radius
        const dist = Math.sqrt(res.point[0] ** 2 + res.point[1] ** 2 + res.point[2] ** 2);
        expect(dist).toBeCloseTo(radius, 9);
        // Should evaluate to exactly the south pole
        expect(res.point[0]).toBeCloseTo(0, 9);
        expect(res.point[1]).toBeCloseTo(0, 9);
        expect(res.point[2]).toBeCloseTo(-radius, 9);
      }

      // Interior samples must also remain on the sphere
      for (let u = 0; u <= 1; u += 0.1) {
        for (let v = 0; v <= 1; v += 0.1) {
          const res = NURBSUtils322.evaluateSurface(data, u, v);
          const dist = Math.sqrt(res.point[0] ** 2 + res.point[1] ** 2 + res.point[2] ** 2);
          expect(dist).toBeCloseTo(radius, 9);
        }
      }
    });

    it('cone reconstruction validation', () => {
      const analytical = {
        surfaceId: 'cone-1',
        surfaceType: 'CONE',
        parameters: { apex: [0, 0, 0], axisDirection: [0, 0, 1], halfAngleDeg: 30 },
        provenance: { parentMeshId: 'M1', parentRegionId: 'R1' }
      } as any;

      const nurbs = engine322.reconstructNURBS(analytical);
      expect(nurbs).not.toBeNull();
      expect(nurbs!.rmsDeviationMm).toBeLessThan(1e-7);
    });
  });

  describe('Rigid Transform Invariance', () => {
    it('NURBS reconstruction is invariant to analytical surface transformation', () => {
      // 1. Original cylinder
      const a1 = {
        surfaceId: 'c1',
        surfaceType: 'CYLINDER',
        parameters: { axisOrigin: [0,0,0], axisDirection: [0,0,1], radius: 10 },
        provenance: { parentMeshId: 'M1', parentRegionId: 'R1' }
      } as any;
      const n1 = engine322.reconstructNURBS(a1);

      // 2. Transformed (Translated)
      const a2 = {
        surfaceId: 'c2',
        surfaceType: 'CYLINDER',
        parameters: { axisOrigin: [100, 50, -20], axisDirection: [0,0,1], radius: 10 },
        provenance: { parentMeshId: 'M1', parentRegionId: 'R1' }
      } as any;
      const n2 = engine322.reconstructNURBS(a2);

      expect(n1!.rmsDeviationMm).toBeCloseTo(n2!.rmsDeviationMm, 10);
      
      // Points on n2 should be exactly translated relative to n1
      const p1 = NURBSUtils322.evaluateSurface(n1!.data, 0.5, 0.5).point;
      const p2 = NURBSUtils322.evaluateSurface(n2!.data, 0.5, 0.5).point;
      
      expect(p2[0]).toBeCloseTo(p1[0] + 100, 5);
      expect(p2[1]).toBeCloseTo(p1[1] + 50, 5);
      expect(p2[2]).toBeCloseTo(p1[2] - 20, 5);
    });
  });

  describe('Integrity & Evidence', () => {
    it('registers NURBS evidence and preserves provenance', () => {
      const bus = EvidenceBus314.getInstance();
      bus.clear();

      const analytical = {
        surfaceId: 'a-1',
        surfaceType: 'PLANE',
        parameters: { normal: [0, 0, 1], centroid: [0, 0, 0], d: 0 },
        provenance: { parentMeshId: 'MESH-001', parentRegionId: 'SEG-001' }
      } as any;

      const nurbs = engine322.reconstructNURBS(analytical);
      
      expect(nurbs!.provenance.parentMeshId).toBe('MESH-001');
      expect(nurbs!.provenance.parentRegionId).toBe('SEG-001');

      const events = bus.queryEvidence({ kind: 'NURBS_RECONSTRUCTION_COMPLETED' });
      expect(events.length).toBe(1);
      expect(events[0].payload.surfaceType).toBe('PLANE');
    });
  });
});
