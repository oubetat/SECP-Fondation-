/**
 * SECP CAD Kernel — Real Parametric Mirror Verification Tests
 * Phase 4 (PROMPT-018)
 */

import { describe, it, expect } from 'vitest';
import { FeatureHistory } from '../FeatureHistory';
import { solveCanonicalSketch, regenerateSketchMirrors } from '../../../sketch/canonical/CanonicalSketchContract';
import { CanonicalSketchAdapter } from '../../../sketch/canonical/CanonicalSketchAdapter';
import { Solid } from '../../topology/TopologyContracts';
import { FeatureExecutor } from '../FeatureExecution';
import { FeatureNode } from '../FeatureNode';

describe('PROMPT-018 — Real Parametric Mirror', () => {
  
  describe('Part 1: 3D B-Rep Parametric Mirror Feature (History / Kernel level)', () => {
    
    it('TEST-01: Correctly evaluates mirror of a B-Rep box across different plane references', () => {
      const history = new FeatureHistory('DOC_MIRROR_3D');

      // 1. Create a box (Seed Feature)
      const boxFeat = history.addFeature(
        'EXTRUDE',
        'SeedBox',
        {
          type: 'EXTRUDE',
          name: 'SeedBox',
          parameters: {
            width: 10,
            height: 10,
            depth: 10
          }
        },
        [],
        undefined,
        'FEAT_SEED_BOX'
      );

      // 2. Add Mirror Feature across YZ plane (x reflection)
      const mirrorFeat = history.addFeature(
        'MIRROR',
        'MirrorBox_YZ',
        {
          type: 'MIRROR',
          name: 'MirrorBox_YZ',
          parameters: {
            sourceFeatureId: 'FEAT_SEED_BOX',
            mirrorPlane: 'YZ'
          }
        },
        ['FEAT_SEED_BOX'],
        'FEAT_SEED_BOX',
        'FEAT_MIRROR_YZ'
      );

      // Evaluate the history tree
      const regenResult = history.regenerate({ forceAll: true });
      expect(regenResult.success).toBe(true);

      const resolvedMirrorNode = history.getFeature('FEAT_MIRROR_YZ');
      expect(resolvedMirrorNode).toBeDefined();
      expect(resolvedMirrorNode?.regenerationStatus).toBe('UP_TO_DATE');

      const mirroredSolid = resolvedMirrorNode?.outputGeometry as Solid;
      expect(mirroredSolid).toBeDefined();
      expect(mirroredSolid.shapeType).toBe('SOLID');

      // Check coordinates of mirrored vertices to prove YZ mirror (x reflected)
      const origNode = history.getFeature('FEAT_SEED_BOX');
      const origSolid = origNode?.outputGeometry as Solid;

      const origVertices: { x: number; y: number; z: number }[] = [];
      const mirroredVertices: { x: number; y: number; z: number }[] = [];

      for (const f of origSolid.outerShell.orientedFaces) {
        for (const oe of f.face.outerLoop.orientedEdges) {
          const v = oe.edge.startVertex.geometry;
          if (!origVertices.some(pt => Math.hypot(pt.x - v.x, pt.y - v.y, pt.z - v.z) < 1e-6)) {
            origVertices.push(v);
          }
        }
      }

      for (const f of mirroredSolid.outerShell.orientedFaces) {
        for (const oe of f.face.outerLoop.orientedEdges) {
          const v = oe.edge.startVertex.geometry;
          if (!mirroredVertices.some(pt => Math.hypot(pt.x - v.x, pt.y - v.y, pt.z - v.z) < 1e-6)) {
            mirroredVertices.push(v);
          }
        }
      }

      expect(mirroredVertices.length).toBe(origVertices.length);

      for (const mv of mirroredVertices) {
        // There must be a matching original vertex with x reflected
        const matched = origVertices.some(ov => 
          Math.abs(mv.x - (-ov.x)) < 1e-6 &&
          Math.abs(mv.y - ov.y) < 1e-6 &&
          Math.abs(mv.z - ov.z) < 1e-6
        );
        expect(matched).toBe(true);
      }
    });

    it('TEST-02: Adversarial - deletion of seed or reference invalidates or clears the mirror result upon regenerate()', () => {
      const history = new FeatureHistory('DOC_MIRROR_ADVERSARIAL');

      // 1. Add box
      const boxFeat = history.addFeature(
        'EXTRUDE',
        'SeedBox',
        {
          type: 'EXTRUDE',
          name: 'SeedBox',
          parameters: { width: 10, height: 10, depth: 10 }
        },
        [],
        undefined,
        'FEAT_SEED_BOX'
      );

      // 2. Add mirror
      const mirrorFeat = history.addFeature(
        'MIRROR',
        'MirrorBox',
        {
          type: 'MIRROR',
          name: 'MirrorBox',
          parameters: {
            sourceFeatureId: 'FEAT_SEED_BOX',
            mirrorPlane: 'YZ'
          }
        },
        ['FEAT_SEED_BOX'],
        'FEAT_SEED_BOX',
        'FEAT_MIRROR'
      );

      // Initially evaluates fine
      let res = history.regenerate({ forceAll: true });
      expect(res.success).toBe(true);
      expect(history.getFeature('FEAT_MIRROR')?.regenerationStatus).toBe('UP_TO_DATE');

      // Now, suppress/delete/invalidate the Seed.
      history.setSuppressed('FEAT_SEED_BOX', true);

      // Regenerating must trigger a downstream invalidation!
      res = history.regenerate({ forceAll: true });
      expect(res.success).toBe(false);
      expect(res.diagnostics.some(d => d.message.includes('suppressed') && d.featureId === 'FEAT_MIRROR')).toBe(true);
    });

    it('TEST-03: Parameter sensitivity - modifying seed dimension propagates to mirror solid upon regenerate()', () => {
      const history = new FeatureHistory('DOC_MIRROR_SENSITIVITY');

      const boxFeat = history.addFeature(
        'EXTRUDE',
        'SeedBox',
        {
          type: 'EXTRUDE',
          name: 'SeedBox',
          parameters: { width: 10, height: 10, depth: 10 }
        },
        [],
        undefined,
        'FEAT_SEED_BOX'
      );

      const mirrorFeat = history.addFeature(
        'MIRROR',
        'MirrorBox',
        {
          type: 'MIRROR',
          name: 'MirrorBox',
          parameters: { sourceFeatureId: 'FEAT_SEED_BOX', mirrorPlane: 'XY' } // xy mirror -> z reflected
        },
        ['FEAT_SEED_BOX'],
        'FEAT_SEED_BOX',
        'FEAT_MIRROR'
      );

      // Eval first state (depth=10)
      let res = history.regenerate({ forceAll: true });
      expect(res.success).toBe(true);
      
      let origSolid = history.getFeature('FEAT_SEED_BOX')?.outputGeometry as Solid;
      let mirrSolid = history.getFeature('FEAT_MIRROR')?.outputGeometry as Solid;

      // Find vertex with non-zero Z depth
      let origZ = 0;
      for (const f of origSolid.outerShell.orientedFaces) {
        for (const oe of f.face.outerLoop.orientedEdges) {
          if (oe.edge.startVertex.geometry.z > 0) {
            origZ = oe.edge.startVertex.geometry.z;
            break;
          }
        }
      }
      expect(origZ).toBeGreaterThan(0);

      // Verify mirrored Z is negative
      let mirrZ = -origZ;
      let foundMirrZ = false;
      for (const f of mirrSolid.outerShell.orientedFaces) {
        for (const oe of f.face.outerLoop.orientedEdges) {
          if (Math.abs(oe.edge.startVertex.geometry.z - mirrZ) < 1e-6) {
            foundMirrZ = true;
          }
        }
      }
      expect(foundMirrZ).toBe(true);

      // Now mutate the seed depth parameter from 10 to 45
      history.updateFeatureDefinition('FEAT_SEED_BOX', {
        type: 'EXTRUDE',
        name: 'SeedBox',
        parameters: { width: 10, height: 10, depth: 45 }
      });

      // Regenerate!
      res = history.regenerate({ forceAll: true });
      expect(res.success).toBe(true);

      origSolid = history.getFeature('FEAT_SEED_BOX')?.outputGeometry as Solid;
      mirrSolid = history.getFeature('FEAT_MIRROR')?.outputGeometry as Solid;

      let newOrigZ = 0;
      for (const f of origSolid.outerShell.orientedFaces) {
        for (const oe of f.face.outerLoop.orientedEdges) {
          if (oe.edge.startVertex.geometry.z > 0) {
            newOrigZ = oe.edge.startVertex.geometry.z;
            break;
          }
        }
      }
      // The depth parameter propagates to vertices (converted to meters)
      expect(newOrigZ).toBeCloseTo(0.045); // 45mm is 0.045m

      // Check that the mirror solid is dynamically updated to the new mirrored position!
      let foundNewMirrZ = false;
      for (const f of mirrSolid.outerShell.orientedFaces) {
        for (const oe of f.face.outerLoop.orientedEdges) {
          if (Math.abs(oe.edge.startVertex.geometry.z - (-newOrigZ)) < 1e-6) {
            foundNewMirrZ = true;
          }
        }
      }
      expect(foundNewMirrZ).toBe(true);
    });

  });

  describe('Part 2: 2D Parametric Sketch Mirror (Sketch / Solver level)', () => {

    it('TEST-04: Creates and regenerates 2D sketch mirror with symmetric constraints and centerlines', () => {
      // 1. Establish an initial sketch containing a centerline L_axis, and a seed point P_seed
      const baseSketch = {
        id: 'SK1',
        name: 'Sketch1',
        plane: 'XY',
        revision: 1,
        entities: {
          'p1': { id: 'p1', type: 'POINT', x: 0, y: 0 },
          'p2': { id: 'p2', type: 'POINT', x: 0, y: 10 },
          'l_axis': { id: 'l_axis', type: 'LINE', startPointId: 'p1', endPointId: 'p2', isCenterline: true },
          'p_seed': { id: 'p_seed', type: 'POINT', x: 15, y: 5 }
        },
        constraints: {}
      };

      // 2. Add mirror definition in the sketch
      const sketchWithMirror = {
        ...baseSketch,
        mirrors: [
          {
            id: 'mir-001',
            seedEntityIds: ['p_seed'],
            mirrorLineId: 'l_axis',
            generatedEntityIds: []
          }
        ]
      } as any;

      // 3. Regenerate!
      const regenerated = regenerateSketchMirrors(sketchWithMirror);

      // Check that mirrored point was dynamically created at correct mirrored coordinates (-15, 5)
      const mirroredPt = regenerated.entities['pt-mirror-p_seed-mir-001'] as any;
      expect(mirroredPt).toBeDefined();
      expect(mirroredPt.x).toBeCloseTo(-15);
      expect(mirroredPt.y).toBeCloseTo(5);

      // Verify that a canonical symmetric constraint is registered!
      const symmetricConstraint = regenerated.constraints['c-symmetric-p_seed-mir-001'];
      expect(symmetricConstraint).toBeDefined();
      expect(symmetricConstraint.type).toBe('SYMMETRIC');
      expect(symmetricConstraint.entityIds).toEqual(['p_seed', 'pt-mirror-p_seed-mir-001', 'l_axis']);
    });

    it('TEST-05: Deleting the seed entity removes it from the mirrored geometry on solve / regenerate', () => {
      const sketch = {
        id: 'SK1',
        name: 'Sketch1',
        plane: 'XY',
        revision: 1,
        entities: {
          'p1': { id: 'p1', type: 'POINT', x: 0, y: 0 },
          'p2': { id: 'p2', type: 'POINT', x: 0, y: 10 },
          'l_axis': { id: 'l_axis', type: 'LINE', startPointId: 'p1', endPointId: 'p2' },
          'p_seed': { id: 'p_seed', type: 'POINT', x: 15, y: 5 }
        },
        constraints: {},
        mirrors: [
          {
            id: 'mir-001',
            seedEntityIds: ['p_seed'],
            mirrorLineId: 'l_axis',
            generatedEntityIds: []
          }
        ]
      } as any;

      // 1. Solve first
      const { solvedSketch } = solveCanonicalSketch(sketch);
      expect(solvedSketch.entities['pt-mirror-p_seed-mir-001']).toBeDefined();

      // 2. Simulate deletion of the seed entity 'p_seed' from entities
      const entitiesNoSeed = { ...solvedSketch.entities };
      delete entitiesNoSeed['p_seed'];

      const modifiedSketch = {
        ...solvedSketch,
        entities: entitiesNoSeed
      };

      // 3. Solve/Regenerate again
      const { solvedSketch: nextSolved } = solveCanonicalSketch(modifiedSketch);

      // The mirrored point MUST not be recreated since seed 'p_seed' is gone!
      expect(nextSolved.entities['pt-mirror-p_seed-mir-001']).toBeUndefined();
    });

  });

});
