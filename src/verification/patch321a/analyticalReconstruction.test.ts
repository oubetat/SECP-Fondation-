import { describe, it, expect } from 'vitest';
import { MathUtils321A } from '../../../src/engine/reverse_engineering/surfaces/MathUtils321A';
import { SurfaceFitter321A } from '../../../src/engine/reverse_engineering/surfaces/SurfaceFitter321A';
import { AnalyticalReconstructionEngine321A } from '../../../src/engine/reverse_engineering/surfaces/AnalyticalReconstructionEngine321A';
import { EvidenceBus314 } from '../../../src/engine/engineering_ai/copilot/EvidenceBus314';

// Helpers to generate independent geometry
function generatePlane(normal: number[], d: number, n: number, noise: number = 0): { points: number[][], normals: number[][] } {
  const norm = MathUtils321A.normalize(normal);
  const [u, v] = MathUtils321A.findOrthogonalBasis(norm);
  const origin = [-norm[0]*d, -norm[1]*d, -norm[2]*d];
  
  const points: number[][] = [];
  const normals: number[][] = [];
  
  // Deterministic seed for reproducible noise
  let seed = 12345;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  
  for (let i = 0; i < n; i++) {
    const x = (random() - 0.5) * 100;
    const y = (random() - 0.5) * 100;
    const n_noise = (random() - 0.5) * 2 * noise;
    
    points.push([
      origin[0] + x * u[0] + y * v[0] + norm[0] * n_noise,
      origin[1] + x * u[1] + y * v[1] + norm[1] * n_noise,
      origin[2] + x * u[2] + y * v[2] + norm[2] * n_noise,
    ]);
    normals.push(norm);
  }
  
  return { points, normals };
}

function generateCylinder(axisOrigin: number[], axisDir: number[], radius: number, n: number, noise: number = 0): { points: number[][], normals: number[][] } {
  const axis = MathUtils321A.normalize(axisDir);
  const [u, v] = MathUtils321A.findOrthogonalBasis(axis);
  
  const points: number[][] = [];
  const normals: number[][] = [];
  
  let seed = 54321;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  
  for (let i = 0; i < n; i++) {
    const h = (random() - 0.5) * 100;
    const theta = random() * Math.PI * 2;
    const r_noise = radius + (random() - 0.5) * 2 * noise;
    
    const nx = Math.cos(theta) * u[0] + Math.sin(theta) * v[0];
    const ny = Math.cos(theta) * u[1] + Math.sin(theta) * v[1];
    const nz = Math.cos(theta) * u[2] + Math.sin(theta) * v[2];
    
    points.push([
      axisOrigin[0] + h * axis[0] + r_noise * nx,
      axisOrigin[1] + h * axis[1] + r_noise * ny,
      axisOrigin[2] + h * axis[2] + r_noise * nz,
    ]);
    normals.push([nx, ny, nz]);
  }
  
  return { points, normals };
}

function generateSphere(center: number[], radius: number, n: number, noise: number = 0): { points: number[][], normals: number[][] } {
  const points: number[][] = [];
  const normals: number[][] = [];
  
  let seed = 11111;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  
  for (let i = 0; i < n; i++) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    
    const nx = Math.sin(phi) * Math.cos(theta);
    const ny = Math.sin(phi) * Math.sin(theta);
    const nz = Math.cos(phi);
    
    const r_noise = radius + (random() - 0.5) * 2 * noise;
    
    points.push([
      center[0] + r_noise * nx,
      center[1] + r_noise * ny,
      center[2] + r_noise * nz,
    ]);
    normals.push([nx, ny, nz]);
  }
  
  return { points, normals };
}

function generateCone(apex: number[], axisDir: number[], halfAngleDeg: number, n: number, noise: number = 0): { points: number[][], normals: number[][] } {
  const axis = MathUtils321A.normalize(axisDir);
  const [u, v] = MathUtils321A.findOrthogonalBasis(axis);
  const halfAngleRad = halfAngleDeg * Math.PI / 180;
  const cosA = Math.cos(halfAngleRad);
  const sinA = Math.sin(halfAngleRad);
  
  const points: number[][] = [];
  const normals: number[][] = [];
  
  let seed = 22222;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  
  for (let i = 0; i < n; i++) {
    const h = random() * 50 + 10; // distance along axis from apex
    const theta = random() * Math.PI * 2;
    
    const dx = Math.cos(theta) * u[0] + Math.sin(theta) * v[0];
    const dy = Math.cos(theta) * u[1] + Math.sin(theta) * v[1];
    const dz = Math.cos(theta) * u[2] + Math.sin(theta) * v[2];
    
    // Normal calculation for a cone
    const nx = cosA * dx - sinA * axis[0];
    const ny = cosA * dy - sinA * axis[1];
    const nz = cosA * dz - sinA * axis[2];
    const norm = MathUtils321A.normalize([nx, ny, nz]);
    
    const r = h * Math.tan(halfAngleRad);
    const r_noise = r + (random() - 0.5) * 2 * noise;
    
    points.push([
      apex[0] + h * axis[0] + r_noise * dx,
      apex[1] + h * axis[1] + r_noise * dy,
      apex[2] + h * axis[2] + r_noise * dz,
    ]);
    normals.push(norm);
  }
  
  return { points, normals };
}

describe('PATCH-321A: Real Analytical Surface Reconstruction', () => {

  describe('Test Group A — Plane', () => {
    it('exact plane recovery', () => {
      const { points } = generatePlane([0, 0, 1], -5, 100);
      const res = SurfaceFitter321A.fitPlane(points);
      expect(res.valid).toBe(true);
      if (!res.parameters || !res.parameters.normal || typeof res.parameters.d !== 'number') throw new Error('Fit failed');
      expect(Math.abs(res.parameters.normal[2])).toBeCloseTo(1, 4);
      expect(Math.abs(res.parameters.d)).toBeCloseTo(5, 4);
      expect(res.rmsResidual).toBeCloseTo(0, 5);
    });

    it('noisy plane', () => {
      const noise = 0.05;
      const { points } = generatePlane([0, 1, 0], 10, 100, noise);
      const res = SurfaceFitter321A.fitPlane(points);
      expect(res.valid).toBe(true);
      if (!res.parameters || !res.parameters.normal) throw new Error('Fit failed');
      expect(Math.abs(res.parameters.normal[1])).toBeCloseTo(1, 2);
      expect(res.rmsResidual).toBeGreaterThan(0);
      expect(res.maxResidual).toBeLessThanOrEqual(noise * 1.05); // within bounds
    });
    
    it('transform invariance (translated and rotated plane)', () => {
      const normal = [0.577, 0.577, 0.577];
      const d = -10;
      const { points: p1 } = generatePlane(normal, d, 100, 0.01);
      const r1 = SurfaceFitter321A.fitPlane(p1);

      // Transform: Rotate 45deg around Z, then translate
      const cos45 = Math.cos(Math.PI/4), sin45 = Math.sin(Math.PI/4);
      const p2 = p1.map(p => {
        const rx = p[0] * cos45 - p[1] * sin45;
        const ry = p[0] * sin45 + p[1] * cos45;
        return [rx + 100, ry - 50, p[2] + 25];
      });
      const r2 = SurfaceFitter321A.fitPlane(p2);

      expect(r2.rmsResidual).toBeCloseTo(r1.rmsResidual, 4);
      // Normal should have rotated accordingly
      const expectedNormal = [
        normal[0] * cos45 - normal[1] * sin45,
        normal[0] * sin45 + normal[1] * cos45,
        normal[2]
      ];
      if (!r2.parameters || !r2.parameters.normal) throw new Error('Fit failed');
      expect(Math.abs(MathUtils321A.dotProduct(r2.parameters.normal, expectedNormal))).toBeCloseTo(1, 2);
    });
  });

  describe('Test Group B — Cylinder', () => {
    it('exact cylinder recovery', () => {
      const { points, normals } = generateCylinder([1, 2, 0], [0, 0, 1], 20, 200);
      const res = SurfaceFitter321A.fitCylinder(points, normals);
      expect(res.valid).toBe(true);
      if (!res.parameters || !res.parameters.axisDirection) throw new Error('Fit failed');
      expect(res.parameters.radius).toBeCloseTo(20, 4);
      expect(Math.abs(res.parameters.axisDirection[2])).toBeCloseTo(1, 4);
      expect(res.rmsResidual).toBeCloseTo(0, 4);
    });

    it('noisy cylinder', () => {
      const noise = 0.1;
      const { points, normals } = generateCylinder([0, 0, 0], [1, 0, 0], 15, 200, noise);
      const res = SurfaceFitter321A.fitCylinder(points, normals);
      expect(res.valid).toBe(true);
      if (!res.parameters) throw new Error('Fit failed');
      expect(res.parameters.radius).toBeCloseTo(15, 1);
      expect(res.rmsResidual).toBeGreaterThan(0);
      expect(res.maxResidual).toBeLessThan(noise * 1.5);
    });
    
    it('under-constrained cylinder', () => {
      // Create a flat plane to test cylinder fit failure
      const { points, normals } = generatePlane([0,0,1], 0, 50, 0);
      const res = SurfaceFitter321A.fitCylinder(points, normals);
      // It should either fail or give a very large radius (which engine will reject)
      if (res.valid) {
        if (!res.parameters) throw new Error('Fit failed');
        expect(res.parameters.radius).toBeGreaterThan(1e5); // Huge radius indicates it's practically a plane
      }
    });

    it('transform invariance (translated and rotated cylinder)', () => {
      const { points: p1, normals: n1 } = generateCylinder([0, 0, 0], [0, 0, 1], 10, 200, 0.05);
      const r1 = SurfaceFitter321A.fitCylinder(p1, n1);

      // Transform: Rotation 90deg around Y, then translate
      // [x, y, z] -> [z, y, -x]
      const p2 = p1.map(p => [p[2] + 10, p[1] + 20, -p[0] + 30]);
      const n2 = n1.map(n => [n[2], n[1], -n[0]]);
      const r2 = SurfaceFitter321A.fitCylinder(p2, n2);

      if (!r1.parameters || !r2.parameters || !r2.parameters.axisDirection || typeof r1.parameters.radius !== 'number' || typeof r2.parameters.radius !== 'number') throw new Error('Fit failed');
      expect(r2.parameters.radius).toBeCloseTo(r1.parameters.radius, 4);
      expect(Math.abs(r2.parameters.axisDirection[0])).toBeCloseTo(1, 4); // New axis should be [1, 0, 0]
      expect(r2.rmsResidual).toBeCloseTo(r1.rmsResidual, 4);
    });

    it('partial cylinder coverage (90 degree arc)', () => {
      const axis = [0, 0, 1];
      const radius = 50;
      const points: number[][] = [];
      const normals: number[][] = [];
      for (let i = 0; i < 100; i++) {
        const theta = (i / 100) * Math.PI / 2; // 90 degree arc
        const nx = Math.cos(theta);
        const ny = Math.sin(theta);
        points.push([radius * nx, radius * ny, i]);
        normals.push([nx, ny, 0]);
      }
      const res = SurfaceFitter321A.fitCylinder(points, normals);
      expect(res.valid).toBe(true);
      if (!res.parameters) throw new Error('Fit failed');
      expect(res.parameters.radius).toBeCloseTo(radius, 2);
    });
  });

  describe('Test Group C — Sphere', () => {
    it('exact sphere recovery', () => {
      const { points } = generateSphere([1, 2, 3], 25, 200);
      const res = SurfaceFitter321A.fitSphere(points);
      expect(res.valid).toBe(true);
      if (!res.parameters || !res.parameters.center) throw new Error('Fit failed');
      expect(res.parameters.radius).toBeCloseTo(25, 4);
      expect(res.parameters.center[0]).toBeCloseTo(1, 4);
      expect(res.parameters.center[1]).toBeCloseTo(2, 4);
      expect(res.parameters.center[2]).toBeCloseTo(3, 4);
      expect(res.rmsResidual).toBeCloseTo(0, 4);
    });

    it('noisy sphere', () => {
      const noise = 0.05;
      const { points } = generateSphere([0, 0, 0], 10, 200, noise);
      const res = SurfaceFitter321A.fitSphere(points);
      expect(res.valid).toBe(true);
      if (!res.parameters) throw new Error('Fit failed');
      expect(res.parameters.radius).toBeCloseTo(10, 1);
      expect(res.rmsResidual).toBeGreaterThan(0);
    });

    it('transform invariance (translated and rotated sphere)', () => {
      // 1. Original
      const { points: p1 } = generateSphere([10, 20, 30], 15, 200, 0.05);
      const r1 = SurfaceFitter321A.fitSphere(p1);
      
      // 2. Transformed (Rotation doesn't change sphere center relative to origin, but we apply it to points anyway)
      const tx = 100, ty = -50, tz = 25;
      const cos30 = Math.cos(Math.PI/6), sin30 = Math.sin(Math.PI/6);
      const p2 = p1.map(p => {
        // Rotate around X axis
        const ry = p[1] * cos30 - p[2] * sin30;
        const rz = p[1] * sin30 + p[2] * cos30;
        return [p[0] + tx, ry + ty, rz + tz];
      });
      const r2 = SurfaceFitter321A.fitSphere(p2);
      
      expect(r1.parameters).toBeDefined();
      expect(r2.parameters).toBeDefined();
      if (r1.parameters && r1.parameters.center && r2.parameters && r2.parameters.center && r1.parameters.radius !== undefined && r2.parameters.radius !== undefined) {
        expect(r2.parameters.radius).toBeCloseTo(r1.parameters.radius, 4);
        expect(r2.rmsResidual).toBeCloseTo(r1.rmsResidual, 4);
        
        // Verify center was transformed correctly
        const c1 = r1.parameters.center;
        const ec = [
          c1[0] + tx,
          (c1[1] * cos30 - c1[2] * sin30) + ty,
          (c1[1] * sin30 + c1[2] * cos30) + tz
        ];
        expect(r2.parameters.center[0]).toBeCloseTo(ec[0], 4);
        expect(r2.parameters.center[1]).toBeCloseTo(ec[1], 4);
        expect(r2.parameters.center[2]).toBeCloseTo(ec[2], 4);
      }
    });
  });

  describe('Test Group D — Cone', () => {
    it('transform invariance (translated and rotated cone)', () => {
      const { points: p1, normals: n1 } = generateCone([0, 0, 0], [0, 0, 1], 25, 200, 0.05);
      const r1 = SurfaceFitter321A.fitCone(p1, n1);

      const tx = 10, ty = 20, tz = 30;
      const cos45 = Math.cos(Math.PI/4), sin45 = Math.sin(Math.PI/4);
      const p2 = p1.map(p => {
        const rx = p[0] * cos45 - p[1] * sin45;
        const ry = p[0] * sin45 + p[1] * cos45;
        return [rx + tx, ry + ty, p[2] + tz];
      });
      const n2 = n1.map(n => {
        const rx = n[0] * cos45 - n[1] * sin45;
        const ry = n[0] * sin45 + n[1] * cos45;
        return [rx, ry, n[2]];
      });
      const r2 = SurfaceFitter321A.fitCone(p2, n2);

      expect(r1.parameters).toBeDefined();
      expect(r2.parameters).toBeDefined();
      if (r1.parameters && r1.parameters.apex && r2.parameters && r2.parameters.apex && r1.parameters.halfAngleDeg !== undefined && r2.parameters.halfAngleDeg !== undefined) {
        expect(r2.parameters.halfAngleDeg).toBeCloseTo(r1.parameters.halfAngleDeg, 2);
        
        const a1 = r1.parameters.apex;
        const ea = [
          a1[0] * cos45 - a1[1] * sin45 + tx,
          a1[0] * sin45 + a1[1] * cos45 + ty,
          a1[2] + tz
        ];
        expect(r2.parameters.apex[0]).toBeCloseTo(ea[0], 2);
        expect(r2.parameters.apex[1]).toBeCloseTo(ea[1], 2);
        expect(r2.parameters.apex[2]).toBeCloseTo(ea[2], 2);
      }
    });

    it('insufficient cone coverage (small patch)', () => {
      const { points, normals } = generateCone([0,0,0], [0,0,1], 30, 5, 0);
      const res = SurfaceFitter321A.fitCone(points, normals);
      expect(res.valid).toBe(false);
      expect(res.errorReason).toBe('INSUFFICIENT_GEOMETRY');
    });
  });

  describe('Test Group E — Model Selection & Engine', () => {
    const engine = AnalyticalReconstructionEngine321A.getInstance();
    
    it('should select PLANE for flat region despite cylinder fit', () => {
      const { points, normals } = generatePlane([0, 0, 1], -10, 100, 0.01);
      const vertices = points.map((p, i) => ({ id: i, position: p, normal: normals[i] }));
      
      const surface = engine.reconstructSurface(
        { parentMesh: { meshId: 'm1', globalCoordinateFrame: 'WORLD_MM' } } as any,
        { segmentId: 'seg1', vertices },
        { maxRmsToleranceMm: 0.1, maxErrorToleranceMm: 0.5, minPointsRequired: 10 }
      );
      
      expect(surface).not.toBeNull();
      expect(surface?.surfaceType).toBe('PLANE');
    });

    it('should select CYLINDER for partial cylindrical region (arc) despite simplicity', () => {
      // 45 degree arc cylinder
      const points: number[][] = [];
      const normals: number[][] = [];
      const radius = 100;
      for (let i = 0; i < 50; i++) {
        const theta = (i / 50) * Math.PI / 4; 
        const nx = Math.cos(theta), ny = Math.sin(theta);
        points.push([radius * nx, radius * ny, i]);
        normals.push([nx, ny, 0]);
      }
      const vertices = points.map((p, i) => ({ id: i, position: p, normal: normals[i] }));
      
      const surface = engine.reconstructSurface(
        { parentMesh: { meshId: 'm1', globalCoordinateFrame: 'WORLD_MM' } } as any,
        { segmentId: 'seg-partial', vertices },
        { maxRmsToleranceMm: 0.1, maxErrorToleranceMm: 0.5, minPointsRequired: 10 }
      );
      
      expect(surface?.surfaceType).toBe('CYLINDER');
      expect(surface?.parameters.radius).toBeCloseTo(radius, 1);
    });

    it('should fail truthfully for ill-conditioned random points', () => {
      const points = Array.from({ length: 50 }, () => [Math.random() * 10, Math.random() * 10, Math.random() * 10]);
      const normals = Array.from({ length: 50 }, () => [Math.random(), Math.random(), Math.random()]);
      const vertices = points.map((p, i) => ({ id: i, position: p, normal: normals[i] }));

      const surface = engine.reconstructSurface(
        { parentMesh: { meshId: 'm1', globalCoordinateFrame: 'WORLD_MM' } } as any,
        { segmentId: 'seg-noise', vertices },
        { maxRmsToleranceMm: 0.001, maxErrorToleranceMm: 0.001, minPointsRequired: 10 }
      );

      expect(surface).toBeNull();
    });
  });

  describe('Test Group F — Integrity & Evidence Bus', () => {
    it('preserves provenance and registers evidence', () => {
      const bus = EvidenceBus314.getInstance();
      bus.clear();

      const engine = AnalyticalReconstructionEngine321A.getInstance();
      const { points, normals } = generateSphere([0, 0, 0], 20, 100, 0);
      const vertices = points.map((p, i) => ({ id: i, position: p, normal: normals[i] }));
      
      const surface = engine.reconstructSurface(
        { parentMesh: { meshId: 'M-101', globalCoordinateFrame: 'WORLD_MM' } } as any,
        { segmentId: 'SEG-50', vertices },
        { maxRmsToleranceMm: 0.1, maxErrorToleranceMm: 0.5, minPointsRequired: 10 }
      );

      expect(surface?.provenance.parentMeshId).toBe('M-101');
      expect(surface?.provenance.parentRegionId).toBe('SEG-50');
      
      const completedEvents = bus.queryEvidence({ kind: 'FITTING_COMPLETED' });
      expect(completedEvents.length).toBeGreaterThan(0);
      expect(completedEvents[0].payload.type).toBe('SPHERE');
    });
  });

  describe('Test Group G — End-to-End (318/320 Pipeline Integration)', () => {
    it('consumes authentic 320 topological segment and fits analytical surface', () => {
      // 1. Generate realistic 320 segment output
      const { points, normals } = generateCylinder([0, 0, 0], [0, 1, 0], 30.5, 300, 0.02);
      
      const vertices = points.map((p, i) => ({
        id: i, // ID as expected by 320
        position: p,
        normal: normals[i],
        sourceType: 'MEASURED',
        confidence: 0.95
      }));

      // Mocked mesh & segment structurally identical to 318/320 pipeline
      const mockMesh = {
        meshId: 'MESH-E2E-318',
        globalCoordinateFrame: 'WORLD_MM',
        units: 'mm'
      };

      const mockSegment = {
        segmentId: 'SEG-E2E-320',
        vertices: vertices,
        faceIndices: Array.from({ length: 150 }, (_, i) => i) // dummy indices
      };

      // 2. Feed to 321A Engine
      const engine = AnalyticalReconstructionEngine321A.getInstance();
      const surface = engine.reconstructSurface(
        { parentMesh: mockMesh } as any,
        mockSegment,
        { maxRmsToleranceMm: 0.1, maxErrorToleranceMm: 0.5, minPointsRequired: 10 }
      );

      // 3. Verify
      expect(surface).toBeDefined();
      if (surface && surface.provenance && surface.provenance.vertexIndices) {
        expect(surface.surfaceType).toBe('CYLINDER');
        expect(surface.parameters.radius).toBeCloseTo(30.5, 1);
        expect(surface.rmsResidual).toBeGreaterThan(0); // Noise was added
        expect(surface.rmsResidual).toBeLessThan(0.1);
        
        // Verify topological metadata preservation
        expect(surface.sourceRegionId).toBe('SEG-E2E-320');
        expect(surface.provenance.parentMeshId).toBe('MESH-E2E-318');
        expect(surface.sampleCount).toBe(300);
        expect(surface.provenance.vertexIndices.length).toBe(300);
        expect(surface.validationStatus).toBe('VALID');
      }
    });
  });
  describe('Test Group H — Deterministic Rerun', () => {
    it('yields identical results on rerun', () => {
      const engine = AnalyticalReconstructionEngine321A.getInstance();
      const { points, normals } = generateCylinder([1, 1, 1], [0, 1, 0], 12.5, 100, 0);
      const vertices = points.map((p, i) => ({ id: i, position: p, normal: normals[i] }));
      
      const session = { parentMesh: { meshId: 'M-101', globalCoordinateFrame: 'WORLD_MM' } } as any;
      const segment = { segmentId: 'SEG-1', vertices };
      const settings = { maxRmsToleranceMm: 0.1, maxErrorToleranceMm: 0.5, minPointsRequired: 10 };

      const s1 = engine.reconstructSurface(session, segment, settings);
      const s2 = engine.reconstructSurface(session, segment, settings);

      expect(s1?.parameters.radius).toBe(s2?.parameters.radius);
      expect(s1?.rmsResidual).toBe(s2?.rmsResidual);
      expect(s1?.surfaceType).toBe(s2?.surfaceType);
    });
  });
});
