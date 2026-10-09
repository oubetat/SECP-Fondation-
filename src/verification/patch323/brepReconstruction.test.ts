import { describe, it, expect } from 'vitest';
import { NURBSEngine322 } from '../../engine/reverse_engineering/surfaces/NURBSEngine322';
import { BRepReconstructionEngine323 } from '../../engine/reverse_engineering/surfaces/BRepReconstructionEngine323';
import { BRepValidator323 } from '../../engine/reverse_engineering/surfaces/BRepValidator323';
import { AnalyticalSurface321A } from '../../engine/reverse_engineering/surfaces/AnalyticalSurfaceTypes321A';

describe('PATCH-323: Genuine NURBS to B-Rep Reconstruction', () => {
  const nurbsEngine = NURBSEngine322.getInstance();

  const getBRep = (surfaces: AnalyticalSurface321A[]) => {
    const nurbsList = surfaces.map(s => nurbsEngine.reconstructNURBS(s)!);
    const model = BRepReconstructionEngine323.reconstructSolid(nurbsList);
    
    const nurbsMap = new Map();
    nurbsList.forEach(n => nurbsMap.set(n.surfaceId, n));
    const anaMap = new Map();
    surfaces.forEach(a => anaMap.set(a.surfaceId, a));
    
    const report = BRepValidator323.validate(model, nurbsMap, anaMap);
    return { model, report, nurbsList };
  };

  describe('Single-Face Plane', () => {
    const plane: AnalyticalSurface321A = {
      surfaceId: 'plane-1', surfaceType: 'PLANE',
      parameters: { centroid: [0, 0, 100], normal: [0, 0, 1], d: -100 },
      provenance: { parentMeshId: 'M1', parentRegionId: 'R1' }
    };

    it('reconstructs typed BRep from Plane NURBS', () => {
      const { model, report } = getBRep([plane]);
      
      expect(report.isValid).toBe(true);
      expect(model.vertices.length).toBe(4);
      expect(model.edges.length).toBe(4);
      expect(model.faces.length).toBe(1);
      
      expect(report.topology.eulerCharacteristic).toBe(1);
      expect(report.topology.isClosed).toBe(false);
      expect(report.topology.openEdgeCount).toBe(4);
      
      expect(report.geometry.maxDeviationMm).toBeLessThan(1e-5);
    });
  });

  describe('Periodic Cylinder Face', () => {
    const cyl: AnalyticalSurface321A = {
      surfaceId: 'cyl-1', surfaceType: 'CYLINDER',
      parameters: { axisOrigin: [0, 0, 0], axisDirection: [0, 0, 1], radius: 25 },
      provenance: { parentMeshId: 'M1', parentRegionId: 'R1' }
    };

    it('preserves periodic seam and topology', () => {
      const { model, report } = getBRep([cyl]);
      
      expect(report.isValid).toBe(true);
      
      expect(model.vertices.length).toBe(2);
      expect(model.edges.length).toBe(3);
      expect(model.faces.length).toBe(1);

      expect(report.topology.eulerCharacteristic).toBe(0);
      expect(report.topology.openEdgeCount).toBe(2); 
      expect(report.topology.isManifold).toBe(true);
    });
  });

  describe('Sphere with Periodic Seam & Degenerate Poles', () => {
    const sphere: AnalyticalSurface321A = {
      surfaceId: 'sphere-1', surfaceType: 'SPHERE',
      parameters: { center: [0, 0, 0], radius: 50 },
      provenance: { parentMeshId: 'M1', parentRegionId: 'R1' }
    };

    it('correctly models degenerate boundaries and computes Euler 2', () => {
      const { model, report } = getBRep([sphere]);
      
      expect(report.isValid).toBe(true);
      expect(model.vertices.length).toBe(2);
      expect(report.topology.degenerateEdgeCount).toBe(2);
      expect(report.topology.eulerCharacteristic).toBe(2);
      expect(report.topology.isClosed).toBe(true);
      expect(report.topology.isManifold).toBe(true);
      expect(report.topology.openEdgeCount).toBe(0);

      const expectedVolume = (4/3) * Math.PI * Math.pow(50, 3);
      expect(report.geometry.volumeMm3).toBeDefined();
      expect(Math.abs(report.geometry.volumeMm3! - expectedVolume) / expectedVolume).toBeLessThan(0.02);
      expect(report.geometry.centroid).toBeDefined();
      expect(Math.abs(report.geometry.centroid!.x)).toBeLessThan(1);
      expect(Math.abs(report.geometry.centroid!.y)).toBeLessThan(1);
      expect(Math.abs(report.geometry.centroid!.z)).toBeLessThan(1);
    });
  });
  
  describe('Sphere Volume Convergence & Orientation', () => {
    it('demonstrates numerical volume convergence and outward shell orientation for R=100', () => {
      const sphere: AnalyticalSurface321A = {
        surfaceId: 'sphere-1', surfaceType: 'SPHERE',
        parameters: { center: [0, 0, 0], radius: 100 },
        provenance: { parentMeshId: 'M1', parentRegionId: 'R1' }
      };

      const nurbsList = [nurbsEngine.reconstructNURBS(sphere)!];
      const model = BRepReconstructionEngine323.reconstructSolid(nurbsList);
      const nurbsMap = new Map();
      nurbsMap.set(nurbsList[0].surfaceId, nurbsList[0]);
      const anaMap = new Map();
      anaMap.set(sphere.surfaceId, sphere);

      const expectedVolume = (4/3) * Math.PI * Math.pow(100, 3); // 4188790.2047863905

      const results = [20, 40, 80].map(gridSize => {
        const report = BRepValidator323.validate(model, nurbsMap, anaMap, { gridSize });
        const geo = report.geometry;
        
        return {
          gridSize,
          signedVolume: geo.signedVolumeMm3,
          physicalVolume: geo.volumeMm3,
          relativeError: Math.abs(geo.volumeMm3 - expectedVolume) / expectedVolume,
          centroidError: Math.sqrt(geo.centroid.x**2 + geo.centroid.y**2 + geo.centroid.z**2),
          shellOrientation: geo.shellOrientation
        };
      });

      console.log('Sphere Volume Convergence Study (R=100):', JSON.stringify(results, null, 2));

      // Assert convergence towards analytical truth
      expect(results[0].relativeError).toBeGreaterThan(results[1].relativeError);
      expect(results[1].relativeError).toBeGreaterThan(results[2].relativeError);
      
      // Strict mathematical orientation verification:
      // Signed volume must be strictly positive (> 0) without taking Math.abs
      results.forEach(res => {
        expect(res.signedVolume).toBeGreaterThan(0);
        expect(res.shellOrientation).toBe('OUTWARD');
        expect(res.physicalVolume).toBe(res.signedVolume);
      });
    });
  });

  describe('Negative & Reversed Orientation Audits', () => {
    it('detects inverted sphere face orientation as INWARD with negative signed volume', () => {
      const sphere: AnalyticalSurface321A = {
        surfaceId: 'sphere-inv', surfaceType: 'SPHERE',
        parameters: { center: [0, 0, 0], radius: 50 },
        provenance: { parentMeshId: 'M1', parentRegionId: 'R1' }
      };
      const nurbsList = [nurbsEngine.reconstructNURBS(sphere)!];
      const model = BRepReconstructionEngine323.reconstructSolid(nurbsList);
      
      // Manually invert the face orientation to 'REVERSED'
      model.faces[0].orientation = 'REVERSED';
      
      const nurbsMap = new Map();
      nurbsMap.set(nurbsList[0].surfaceId, nurbsList[0]);
      const anaMap = new Map();
      anaMap.set(sphere.surfaceId, sphere);

      const report = BRepValidator323.validate(model, nurbsMap, anaMap, { gridSize: 40 });
      const expectedVolume = (4/3) * Math.PI * Math.pow(50, 3);

      // Verify that signed volume is strictly negative
      expect(report.geometry.signedVolumeMm3).toBeLessThan(0);
      const relError = Math.abs(report.geometry.signedVolumeMm3! - (-expectedVolume)) / expectedVolume;
      expect(relError).toBeLessThan(0.01);
      // Verify that shellOrientation is classified as INWARD
      expect(report.geometry.shellOrientation).toBe('INWARD');
      // Verify that physical volume remains positive magnitude
      expect(Math.abs(report.geometry.volumeMm3! - expectedVolume) / expectedVolume).toBeLessThan(0.01);
    });

    it('detects inverted box faces as INWARD with negative signed volume', () => {
      const size = 50;
      const planes: AnalyticalSurface321A[] = [
        { surfaceId: 'top', surfaceType: 'PLANE', parameters: { centroid: [0, 0, size], normal: [0, 0, 1], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
        { surfaceId: 'bottom', surfaceType: 'PLANE', parameters: { centroid: [0, 0, -size], normal: [0, 0, -1], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
        { surfaceId: 'front', surfaceType: 'PLANE', parameters: { centroid: [0, -size, 0], normal: [0, -1, 0], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
        { surfaceId: 'back', surfaceType: 'PLANE', parameters: { centroid: [0, size, 0], normal: [0, 1, 0], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
        { surfaceId: 'left', surfaceType: 'PLANE', parameters: { centroid: [-size, 0, 0], normal: [-1, 0, 0], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
        { surfaceId: 'right', surfaceType: 'PLANE', parameters: { centroid: [size, 0, 0], normal: [1, 0, 0], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
      ];
      
      const nurbsList = planes.map(p => nurbsEngine.reconstructNURBS(p)!);
      const model = BRepReconstructionEngine323.reconstructSolid(nurbsList);
      
      // Invert all 6 face orientations to 'REVERSED'
      model.faces.forEach(f => { f.orientation = 'REVERSED'; });

      const nurbsMap = new Map();
      nurbsList.forEach(n => nurbsMap.set(n.surfaceId, n));
      const anaMap = new Map();
      planes.forEach(a => anaMap.set(a.surfaceId, a));

      const report = BRepValidator323.validate(model, nurbsMap, anaMap);
      const expectedVolume = Math.pow(2 * size, 3); // 1,000,000

      // Verify that signed volume is strictly negative
      expect(report.geometry.signedVolumeMm3).toBeLessThan(0);
      expect(report.geometry.signedVolumeMm3).toBeCloseTo(-expectedVolume, -3);
      // Verify that shellOrientation is classified as INWARD
      expect(report.geometry.shellOrientation).toBe('INWARD');
    });
  });
  describe('Adversarial / Invalid Cases', () => {
    it('detects a non-manifold edge', () => {
      const plane: AnalyticalSurface321A = {
        surfaceId: 'plane-1', surfaceType: 'PLANE',
        parameters: { centroid: [0, 0, 100], normal: [0, 0, 1], d: -100 },
        provenance: { parentMeshId: 'M1', parentRegionId: 'R1' }
      };
      const { report } = getBRep([plane, plane, plane]);
      
      expect(report.isValid).toBe(false);
      expect(report.topology.isManifold).toBe(false);
      expect(report.topology.nonManifoldEdgeCount).toBe(4);
    });

    it('leaves faces unstitched if gaps are slightly above tolerance', () => {
      // 2 planes that are slightly separated by 1e-3, while tolerance is 1e-4
      const p1: AnalyticalSurface321A = {
        surfaceId: 'p1', surfaceType: 'PLANE',
        parameters: { centroid: [-50.001, 0, 0], normal: [1, 0, 0], d: 50.001, extents: [100, 100] },
        provenance: { parentMeshId: 'M', parentRegionId: 'R' }
      };
      const p2: AnalyticalSurface321A = {
        surfaceId: 'p2', surfaceType: 'PLANE',
        parameters: { centroid: [50.001, 0, 0], normal: [-1, 0, 0], d: 50.001, extents: [100, 100] },
        provenance: { parentMeshId: 'M', parentRegionId: 'R' }
      };
      const { report } = getBRep([p1, p2]);
      
      // The shared boundary should NOT stitch because of the 0.002 gap
      // 2 separate planes have 4 open edges each = 8 total
      expect(report.topology.openEdgeCount).toBe(8);
      expect(report.topology.isClosed).toBe(false);
    });
  });

  describe('Closed Multi-Face Solid (Box)', () => {
    const scales = [10, 100, 250];
    
    scales.forEach(size => {
      it(`stitches 6 planes into a watertight solid at scale +/-${size}`, () => {
        const planes: AnalyticalSurface321A[] = [
          { surfaceId: 'top', surfaceType: 'PLANE', parameters: { centroid: [0, 0, size], normal: [0, 0, 1], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
          { surfaceId: 'bottom', surfaceType: 'PLANE', parameters: { centroid: [0, 0, -size], normal: [0, 0, -1], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
          { surfaceId: 'front', surfaceType: 'PLANE', parameters: { centroid: [0, -size, 0], normal: [0, -1, 0], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
          { surfaceId: 'back', surfaceType: 'PLANE', parameters: { centroid: [0, size, 0], normal: [0, 1, 0], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
          { surfaceId: 'left', surfaceType: 'PLANE', parameters: { centroid: [-size, 0, 0], normal: [-1, 0, 0], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
          { surfaceId: 'right', surfaceType: 'PLANE', parameters: { centroid: [size, 0, 0], normal: [1, 0, 0], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
        ];
        
        const { model, report } = getBRep(planes);
        
        expect(report.isValid).toBe(true);
        expect(model.faces.length).toBe(6);
        
        expect(model.vertices.length).toBe(8);
        expect(model.edges.length).toBe(12);
        expect(report.topology.eulerCharacteristic).toBe(2);
        
        expect(report.topology.isClosed).toBe(true);
        expect(report.topology.isManifold).toBe(true);
        expect(model.solids.length).toBe(1);

        // Volume of box with half-size = size is (2*size)^3
        const expectedVolume = Math.pow(2 * size, 3);
        
        expect(report.geometry.volumeMm3).toBeDefined();
        // Since we are using 40x40 numerical integration for planes (2 triangles per cell),
        // planes are planar so the numerical integration over flat triangles is exact!
        expect(Math.abs(report.geometry.volumeMm3! - expectedVolume) / expectedVolume).toBeLessThan(0.01);
        
        // Strict shell orientation verification
        expect(report.geometry.signedVolumeMm3).toBeGreaterThan(0);
        expect(report.geometry.signedVolumeMm3).toBeCloseTo(expectedVolume, -3);
        expect(report.geometry.shellOrientation).toBe('OUTWARD');

        expect(report.geometry.centroid).toBeDefined();
        expect(Math.abs(report.geometry.centroid!.x)).toBeLessThan(1e-5);
        expect(Math.abs(report.geometry.centroid!.y)).toBeLessThan(1e-5);
        expect(Math.abs(report.geometry.centroid!.z)).toBeLessThan(1e-5);
      });
    });
  });

  describe('Cone with Apex Degeneracy', () => {
    const cone: AnalyticalSurface321A = {
      surfaceId: 'cone-1', surfaceType: 'CONE',
      parameters: { apex: [0, 0, 100], axisDirection: [0, 0, 1], halfAngleDeg: 45 },
      provenance: { parentMeshId: 'M1', parentRegionId: 'R1' }
    };

    it('models apex as a degenerate boundary and evaluates Euler 1', () => {
      const { model, report } = getBRep([cone]);
      
      expect(report.isValid).toBe(true);
      
      // Apex + Seam base = 2 vertices
      expect(model.vertices.length).toBe(2);
      
      // Degenerate edge for apex, one edge for base, one for seam
      expect(model.edges.length).toBe(3);
      expect(report.topology.degenerateEdgeCount).toBe(1);
      
      // Euler: V(2) - valid E(2) + F(1) = 1 (Disk topology)
      expect(report.topology.eulerCharacteristic).toBe(1);
      
      // A lateral cone surface alone is not a closed solid
      expect(model.solids.length).toBe(0);
      expect(report.topology.solidCount).toBe(0);
      expect(report.topology.isClosed).toBe(false);
    });
  });

  describe('Reconstruction Determinism', () => {
    it('produces identical topology, geometry, volume, and reports across repeated runs', () => {
      const size = 50;
      const planes: AnalyticalSurface321A[] = [
        { surfaceId: 'top', surfaceType: 'PLANE', parameters: { centroid: [0, 0, size], normal: [0, 0, 1], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
        { surfaceId: 'bottom', surfaceType: 'PLANE', parameters: { centroid: [0, 0, -size], normal: [0, 0, -1], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
        { surfaceId: 'front', surfaceType: 'PLANE', parameters: { centroid: [0, -size, 0], normal: [0, -1, 0], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
        { surfaceId: 'back', surfaceType: 'PLANE', parameters: { centroid: [0, size, 0], normal: [0, 1, 0], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
        { surfaceId: 'left', surfaceType: 'PLANE', parameters: { centroid: [-size, 0, 0], normal: [-1, 0, 0], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
        { surfaceId: 'right', surfaceType: 'PLANE', parameters: { centroid: [size, 0, 0], normal: [1, 0, 0], d: -size, extents: [size, size] }, provenance: { parentMeshId: 'M', parentRegionId: 'R' } },
      ];

      const run1 = getBRep(planes);
      const run2 = getBRep(planes);

      // Verify exact equality of topological elements counts and IDs structure
      expect(run1.model.vertices.length).toBe(run2.model.vertices.length);
      expect(run1.model.edges.length).toBe(run2.model.edges.length);
      expect(run1.model.faces.length).toBe(run2.model.faces.length);
      expect(run1.model.solids.length).toBe(run2.model.solids.length);

      // Verify report equivalence
      expect(run1.report.topology).toEqual(run2.report.topology);
      expect(run1.report.geometry.volumeMm3).toEqual(run2.report.geometry.volumeMm3);
      expect(run1.report.geometry.signedVolumeMm3).toEqual(run2.report.geometry.signedVolumeMm3);
      expect(run1.report.geometry.areaMm2).toEqual(run2.report.geometry.areaMm2);
      expect(run1.report.geometry.centroid).toEqual(run2.report.geometry.centroid);
      expect(run1.report.failures).toEqual(run2.report.failures);
    });
  });
});
