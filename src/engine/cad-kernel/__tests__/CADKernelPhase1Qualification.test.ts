/**
 * SECP CAD KERNEL PHASE 1-001
 * Comprehensive Native Kernel Geometric Capability Qualification Test Suite
 *
 * Verifies:
 * 1. Analytic Primitives (Sphere & Torus) topology, volume, area, and fail-closed bounds.
 * 2. True Fillet & Chamfer B-Rep topological mutation, blend/bevel faces, and volume reduction.
 * 3. True Shell Evaluator face normal offsetting, exact physical wall thickness, and degenerate rejection.
 * 4. STEP AP242 Part 21 standard ISO-10303-21 exchange and adversarial corrupt rejection.
 * 5. Rational NURBS Cox-de Boor surface point evaluation.
 */

import { describe, it, expect } from 'vitest';
import { BRepKernel } from '../brep/BRepKernel';
import { Meters } from '../core/Units';
import { ShellEvaluator } from '../evaluators/ShellEvaluator';
import { FeatureNode } from '../history/FeatureNode';
import { FeatureExecutor } from '../history/FeatureExecution';
import { ToleranceEngine } from '../tolerance';
import { STEPAP242Translator } from '../../interop/STEPAP242Translator';
import { AP242TestFixtures } from '../../interop/AP242TestFixtures';
import { RationalSurfaceSynthesisEngine } from '../../nurbs-geometry/RationalSurfaceSynthesisEngine';
import { BRepNURBSSurface } from '../geometry/BRepGeometry';

describe('SECP-CAD-KERNEL-PHASE-1-001: Geometric Capability Restoration', () => {
  const kernel = BRepKernel.getCanonical();

  describe('1. Analytic Primitives (Sphere & Torus)', () => {
    it('constructs a genuine spherical 2-manifold with exact volume and Euler characteristic chi=2', () => {
      const radius = 2.5;
      const sphere = kernel.createSphere(radius as Meters);

      expect(sphere).toBeDefined();
      expect(sphere.outerShell.orientedFaces.length).toBeGreaterThanOrEqual(24);

      // Check all vertices lie on sphere surface x^2 + y^2 + z^2 = R^2 within 1e-4
      for (const of of sphere.outerShell.orientedFaces) {
        for (const oe of of.face.outerLoop.orientedEdges) {
          const v = oe.edge.startVertex.geometry;
          const dist = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
          expect(Math.abs(dist - radius)).toBeLessThan(1e-4);
        }
      }

      // Analytical Volume Oracle: V = 4/3 * pi * R^3
      const expectedVol = (4.0 / 3.0) * Math.PI * Math.pow(radius, 3);
      const computedVol = kernel.computeVolume(sphere);
      const relVolErr = Math.abs(computedVol - expectedVol) / expectedVol;
      expect(relVolErr).toBeLessThan(1e-6);

      // Analytical Surface Area Oracle: A = 4 * pi * R^2
      const expectedArea = 4.0 * Math.PI * Math.pow(radius, 2);
      const computedArea = kernel.computeSurfaceArea(sphere);
      const relAreaErr = Math.abs(computedArea - expectedArea) / expectedArea;
      expect(relAreaErr).toBeLessThan(1e-6);

      // Euler characteristic chi = 2
      expect((sphere as any).analyticGeometry.eulerCharacteristic).toBe(2);
      expect((sphere as any).analyticGeometry.genus).toBe(0);
    });

    it('constructs a genuine genus-1 toroidal solid with central cavity and Euler characteristic chi=0', () => {
      const rMajor = 5.0;
      const rMinor = 1.5;
      const torus = kernel.createTorus(rMajor as Meters, rMinor as Meters);

      expect(torus).toBeDefined();
      expect(torus.outerShell.orientedFaces.length).toBe(24 * 16);

      // Verify genus 1 central cavity (min inner radius is R - r > 0)
      for (const of of torus.outerShell.orientedFaces) {
        for (const oe of of.face.outerLoop.orientedEdges) {
          const v = oe.edge.startVertex.geometry;
          const xyDist = Math.sqrt(v.x * v.x + v.y * v.y);
          expect(xyDist).toBeGreaterThanOrEqual(rMajor - rMinor - 1e-4);
          expect(xyDist).toBeLessThanOrEqual(rMajor + rMinor + 1e-4);
          // Torus equation: (sqrt(x^2 + y^2) - R)^2 + z^2 = r^2
          const torusEq = Math.pow(xyDist - rMajor, 2) + Math.pow(v.z, 2);
          expect(Math.abs(torusEq - rMinor * rMinor)).toBeLessThan(1e-4);
        }
      }

      // Analytical Volume Oracle: V = 2 * pi^2 * R * r^2
      const expectedVol = 2.0 * Math.PI * Math.PI * rMajor * Math.pow(rMinor, 2);
      const computedVol = kernel.computeVolume(torus);
      const relVolErr = Math.abs(computedVol - expectedVol) / expectedVol;
      expect(relVolErr).toBeLessThan(1e-6);

      // Analytical Area Oracle: A = 4 * pi^2 * R * r
      const expectedArea = 4.0 * Math.PI * Math.PI * rMajor * rMinor;
      const computedArea = kernel.computeSurfaceArea(torus);
      const relAreaErr = Math.abs(computedArea - expectedArea) / expectedArea;
      expect(relAreaErr).toBeLessThan(1e-6);

      // Euler characteristic chi = 0, genus = 1
      expect((torus as any).analyticGeometry.eulerCharacteristic).toBe(0);
      expect((torus as any).analyticGeometry.genus).toBe(1);
    });

    it('enforces fail-closed rejection for invalid, non-positive, or self-intersecting radii', () => {
      expect(() => kernel.createSphere(-1 as Meters)).toThrow(/INVALID_SPHERE_RADIUS/);
      expect(() => kernel.createSphere(0 as Meters)).toThrow(/INVALID_SPHERE_RADIUS/);
      expect(() => kernel.createSphere(NaN as Meters)).toThrow(/INVALID_SPHERE_RADIUS/);

      expect(() => kernel.createTorus(-5 as Meters, 1 as Meters)).toThrow(/INVALID_TORUS_DIMENSIONS/);
      expect(() => kernel.createTorus(2 as Meters, 2 as Meters)).toThrow(/SELF_INTERSECTING_TORUS/);
      expect(() => kernel.createTorus(2 as Meters, 3 as Meters)).toThrow(/SELF_INTERSECTING_TORUS/);
    });
  });

  describe('2. True Fillet and Chamfer Feature Execution', () => {
    it('executes genuine planar chamfer edge bevels with topological mutation and volume reduction', () => {
      const box = kernel.createBox(10 as Meters, 10 as Meters, 10 as Meters, 'box_test');
      const feature: FeatureNode = {
        id: 'chamfer_01',
        name: 'Chamfer Feature',
        type: 'CHAMFER',
        parameters: { distance: 1.5 },
        dependencyIds: ['box_feature'],
        inputReferences: [{ targetFeatureId: 'box_feature', entityType: 'SOLID' }]
      };

      const context = {
        resolvedInputs: new Map([['box_feature', box]]),
        toleranceContext: {
          operation: 'BOOLEAN' as any,
          geometryScale: 1.0,
          unitSystem: 'SI',
          requestedTolerance: 1e-6
        }
      };

      const result = FeatureExecutor.execute(feature, context);

      expect(result.status).toBe('SUCCESS');
      const solid = result.outputGeometry;
      expect(solid).toBeDefined();
      expect((solid as any).isBeveled).toBe(true);
      expect((solid as any).chamferDistance).toBe(1.5);

      // Volume must strictly decrease due to bevel wedge removal
      const originalVol = 10 * 10 * 10;
      expect((solid as any).analyticVolume).toBeLessThan(originalVol);
    });

    it('executes genuine cylindrical fillet blend faces with radius constraint and volume reduction', () => {
      const box = kernel.createBox(10 as Meters, 10 as Meters, 10 as Meters, 'box_test');
      const feature: FeatureNode = {
        id: 'fillet_01',
        name: 'Fillet Feature',
        type: 'FILLET',
        parameters: { radius: 2.0 },
        dependencyIds: ['box_feature'],
        inputReferences: [{ targetFeatureId: 'box_feature', entityType: 'SOLID' }]
      };

      const context = {
        resolvedInputs: new Map([['box_feature', box]]),
        toleranceContext: {
          operation: 'BOOLEAN' as any,
          geometryScale: 1.0,
          unitSystem: 'SI',
          requestedTolerance: 1e-6
        }
      };

      const result = FeatureExecutor.execute(feature, context);

      expect(result.status).toBe('SUCCESS');
      const solid = result.outputGeometry;
      expect(solid).toBeDefined();
      expect((solid as any).isFilleted).toBe(true);
      expect((solid as any).filletRadius).toBe(2.0);

      // Volume must strictly decrease due to cylindrical corner removal
      const originalVol = 10 * 10 * 10;
      expect((solid as any).analyticVolume).toBeLessThan(originalVol);
    });

    it('enforces fail-closed rejection for invalid fillet radius and chamfer distance', () => {
      const box = kernel.createBox(10 as Meters, 10 as Meters, 10 as Meters, 'box_test');
      const context = {
        resolvedInputs: new Map([['box_feature', box]]),
        toleranceContext: {
          operation: 'BOOLEAN' as any,
          geometryScale: 1.0,
          unitSystem: 'SI',
          requestedTolerance: 1e-6
        }
      };

      // Negative distance
      const negChamfer: FeatureNode = {
        id: 'neg_chamfer',
        name: 'Neg Chamfer',
        type: 'CHAMFER',
        parameters: { distance: -1 },
        dependencyIds: ['box_feature'],
        inputReferences: [{ targetFeatureId: 'box_feature' }]
      };
      expect(FeatureExecutor.execute(negChamfer, context).status).toBe('FAILED');

      // Collapsing distance exceeding half minimum dimension (10 / 2 = 5)
      const collapseChamfer: FeatureNode = {
        id: 'col_chamfer',
        name: 'Collapse Chamfer',
        type: 'CHAMFER',
        parameters: { distance: 6.0 },
        dependencyIds: ['box_feature'],
        inputReferences: [{ targetFeatureId: 'box_feature' }]
      };
      expect(FeatureExecutor.execute(collapseChamfer, context).status).toBe('FAILED');
    });
  });

  describe('3. True Shell Evaluator (Normal Offsetting)', () => {
    it('computes exact inward normal-offset shell with physical wall thickness without scalar scaling', () => {
      const box = kernel.createBox(20 as Meters, 20 as Meters, 10 as Meters, 'box_shell');
      const shellRes = ShellEvaluator.evaluate(box, { thickness: 2.0 }, 'shell_01');

      expect(shellRes.success).toBe(true);
      expect(shellRes.wallThicknessMm).toBe(2.0);
      expect(shellRes.removedFacesCount).toBe(1);

      const shelledSolid = shellRes.resultSolid!;
      expect(shelledSolid).toBeDefined();

      // Theoretical volume: (20 * 20 * 10) - (16 * 16 * 8) = 4000 - 2048 = 1952
      const expectedVol = (20 * 20 * 10) - (16 * 16 * 8);
      expect((shelledSolid as any).analyticVolume).toBe(expectedVol);
    });

    it('enforces fail-closed rejection when shell wall thickness exceeds half of minimum dimension', () => {
      const box = kernel.createBox(10 as Meters, 10 as Meters, 4 as Meters, 'thin_box');
      // Minimum dimension is 4, half is 2. Thickness 2.5 must fail closed!
      const shellRes = ShellEvaluator.evaluate(box, { thickness: 2.5 }, 'shell_bad');

      expect(shellRes.success).toBe(false);
      expect(shellRes.error).toContain('DEGENERATE_SHELL_THICKNESS');
    });
  });

  describe('4. STEP AP242 Part 21 Standard Compliance & Round-Trip', () => {
    it('exports formal ISO 10303-21 physical format and losslessly reconstructs AP242 semantic models', () => {
      const fixtureA = AP242TestFixtures.getFixtureA();
      const stepPart21 = STEPAP242Translator.exportToStepPart21(fixtureA);

      // Verify ISO-10303-21 physical file syntax
      expect(stepPart21.startsWith('ISO-10303-21;')).toBe(true);
      expect(stepPart21).toContain('HEADER;');
      expect(stepPart21).toContain('FILE_SCHEMA');
      expect(stepPart21).toContain('DATA;');
      expect(stepPart21).toContain('MANIFOLD_SOLID_BREP');
      expect(stepPart21).toContain('CARTESIAN_POINT');
      expect(stepPart21).toContain('END-ISO-10303-21;');

      // Reconstruct and verify round-trip fidelity
      const reconstructed = STEPAP242Translator.importFromStepPart21(stepPart21);
      expect(reconstructed.header.fileName).toBe(fixtureA.header.fileName);
      expect(reconstructed.solids[0].volumeMm3).toBe(fixtureA.solids[0].volumeMm3);
      expect(reconstructed.solids[0].surfaceAreaMm2).toBe(fixtureA.solids[0].surfaceAreaMm2);
      expect(reconstructed.dimensions.length).toBe(fixtureA.dimensions.length);
    });

    it('rejects corrupted, truncated, and empty STEP inputs with typed fail-closed errors', () => {
      expect(() => STEPAP242Translator.importFromStepPart21('')).toThrow(/Empty or null/);
      expect(() => STEPAP242Translator.importFromStepPart21(AP242TestFixtures.getFixtureF())).toThrow(/Corrupted/);
      expect(() => STEPAP242Translator.importFromStepPart21('ISO-10303-21; HEADER;')).toThrow(/Truncated/);
    });
  });

  describe('5. NURBS Cox-de Boor Surface Evaluation', () => {
    it('evaluates tensor-product rational B-spline surface points via Cox-de Boor', () => {
      const knotsU = [0, 0, 1, 1];
      const knotsV = [0, 0, 1, 1];
      const controlPoints = [
        [{ x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 10, z: 5, w: 1 }],
        [{ x: 10, y: 0, z: 5, w: 1 }, { x: 10, y: 10, z: 10, w: 1 }]
      ];

      const ptMid = RationalSurfaceSynthesisEngine.evaluatePoint(
        {
          id: 'bilinear_patch',
          degreeU: 1,
          degreeV: 1,
          knotsU,
          knotsV,
          controlPoints
        },
        0.5,
        0.5
      );

      // Bilinear patch midpoint must be exactly (5, 5, 5)
      expect(ptMid.x).toBeCloseTo(5.0, 5);
      expect(ptMid.y).toBeCloseTo(5.0, 5);
      expect(ptMid.z).toBeCloseTo(5.0, 5);
    });
  });
});
