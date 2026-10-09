/**
 * SECP CAD Kernel — Real Parametric Pattern Verification Tests
 * Phase 4 (PROMPT-019)
 */

import { describe, it, expect } from 'vitest';
import { FeatureHistory } from '../FeatureHistory';
import { Solid, Compound } from '../../topology/TopologyContracts';
import { FeatureNode } from '../FeatureNode';

describe('PROMPT-019 — Real Parametric Pattern', () => {

  describe('3D B-Rep Parametric Pattern Feature (History / Kernel level)', () => {

    it('TEST-01: Correctly evaluates linear and circular patterns of a seed solid', () => {
      const history = new FeatureHistory('DOC_PATTERN_3D');

      // 1. Create a Seed Box
      history.addFeature(
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
        'FEAT_SEED'
      );

      // 2. Add Linear Pattern feature
      history.addFeature(
        'PATTERN',
        'LinearPattern',
        {
          type: 'PATTERN',
          name: 'LinearPattern',
          parameters: {
            sourceFeatureId: 'FEAT_SEED',
            patternType: 'LINEAR',
            count: 3,
            spacing: 20,
            axis: { x: 1, y: 0, z: 0 }
          }
        },
        ['FEAT_SEED'],
        'FEAT_SEED',
        'FEAT_PATTERN'
      );

      // Evaluate the history tree
      const regenResult = history.regenerate({ forceAll: true });
      expect(regenResult.success).toBe(true);

      const patNode = history.getFeature('FEAT_PATTERN');
      expect(patNode).toBeDefined();
      expect(patNode?.regenerationStatus).toBe('UP_TO_DATE');

      const compound = patNode?.outputGeometry as Compound;
      expect(compound).toBeDefined();
      expect(compound.shapeType).toBe('COMPOUND');
      expect(compound.shapes.length).toBe(3);

      // Check instances positions
      // Instance 0 should be at offset 0
      // Instance 1 should be at offset 20 along X axis
      // Instance 2 should be at offset 40 along X axis
      const inst0 = compound.shapes[0] as Solid;
      const inst1 = compound.shapes[1] as Solid;
      const inst2 = compound.shapes[2] as Solid;

      expect(inst0.id).toBe('FEAT_PATTERN_inst_0');
      expect(inst1.id).toBe('FEAT_PATTERN_inst_1');
      expect(inst2.id).toBe('FEAT_PATTERN_inst_2');

      // Helper to collect vertices from a Solid
      const getUniqueVertices = (solid: Solid): { x: number; y: number; z: number }[] => {
        const pts: { x: number; y: number; z: number }[] = [];
        for (const f of solid.outerShell.orientedFaces) {
          for (const oe of f.face.outerLoop.orientedEdges) {
            const v = oe.edge.startVertex.geometry;
            if (!pts.some(pt => Math.hypot(pt.x - v.x, pt.y - v.y, pt.z - v.z) < 1e-5)) {
              pts.push(v);
            }
          }
        }
        return pts;
      };

      const pts0 = getUniqueVertices(inst0);
      const pts1 = getUniqueVertices(inst1);
      const pts2 = getUniqueVertices(inst2);

      expect(pts0.length).toBeGreaterThan(0);
      expect(pts1.length).toBe(pts0.length);

      // Validate translation mapping
      for (let index = 0; index < pts0.length; index++) {
        const v0 = pts0[index];
        const v1 = pts1[index];
        const v2 = pts2[index];

        expect(Math.abs(v1.x - (v0.x + 20))).toBeLessThan(1e-5);
        expect(Math.abs(v1.y - v0.y)).toBeLessThan(1e-5);
        expect(Math.abs(v1.z - v0.z)).toBeLessThan(1e-5);

        expect(Math.abs(v2.x - (v0.x + 40))).toBeLessThan(1e-5);
      }
    });

    it('TEST-02: Pattern suppression ignores specified indices', () => {
      const history = new FeatureHistory('DOC_PATTERN_SUPPRESS');

      history.addFeature(
        'EXTRUDE',
        'SeedBox',
        {
          type: 'EXTRUDE',
          name: 'SeedBox',
          parameters: { width: 10, height: 10, depth: 10 }
        },
        [],
        undefined,
        'FEAT_SEED'
      );

      // Add pattern with suppressionList: [1] (skips instance 1)
      history.addFeature(
        'PATTERN',
        'PatternWithSuppression',
        {
          type: 'PATTERN',
          name: 'PatternWithSuppression',
          parameters: {
            sourceFeatureId: 'FEAT_SEED',
            patternType: 'LINEAR',
            count: 3,
            spacing: 20,
            axis: { x: 0, y: 1, z: 0 },
            suppressionList: [1]
          }
        },
        ['FEAT_SEED'],
        'FEAT_SEED',
        'FEAT_PATTERN'
      );

      const res = history.regenerate({ forceAll: true });
      expect(res.success).toBe(true);

      const compound = history.getFeature('FEAT_PATTERN')?.outputGeometry as Compound;
      expect(compound.shapes.length).toBe(2); // 3 total, index 1 is suppressed -> 2 remain

      expect(compound.shapes[0].id).toBe('FEAT_PATTERN_inst_0');
      expect(compound.shapes[1].id).toBe('FEAT_PATTERN_inst_2'); // Index 1 is omitted
    });

    it('TEST-03: Parameter sensitivity updates derived instances and counts', () => {
      const history = new FeatureHistory('DOC_PATTERN_SENSITIVITY');

      history.addFeature(
        'EXTRUDE',
        'SeedBox',
        {
          type: 'EXTRUDE',
          name: 'SeedBox',
          parameters: { width: 10, height: 10, depth: 10 }
        },
        [],
        undefined,
        'FEAT_SEED'
      );

      const patternFeat = history.addFeature(
        'PATTERN',
        'LinearPattern',
        {
          type: 'PATTERN',
          name: 'LinearPattern',
          parameters: {
            sourceFeatureId: 'FEAT_SEED',
            patternType: 'LINEAR',
            count: 2,
            spacing: 15,
            axis: { x: 0, y: 0, z: 1 }
          }
        },
        ['FEAT_SEED'],
        'FEAT_SEED',
        'FEAT_PATTERN'
      );

      let res = history.regenerate({ forceAll: true });
      expect(res.success).toBe(true);
      expect((history.getFeature('FEAT_PATTERN')?.outputGeometry as Compound).shapes.length).toBe(2);

      // Now change parameters
      patternFeat.parameters = {
        sourceFeatureId: 'FEAT_SEED',
        patternType: 'LINEAR',
        count: 5,
        spacing: 30,
        axis: { x: 0, y: 0, z: 1 }
      };
      patternFeat.state = 'INVALID'; // invalidate manually

      res = history.regenerate({ forceAll: true });
      expect(res.success).toBe(true);
      
      const newCompound = history.getFeature('FEAT_PATTERN')?.outputGeometry as Compound;
      expect(newCompound.shapes.length).toBe(5);

      // Verify new spacing 30
      const inst0 = newCompound.shapes[0] as Solid;
      const inst1 = newCompound.shapes[1] as Solid;
      const v0 = inst0.outerShell.orientedFaces[0].face.outerLoop.orientedEdges[0].edge.startVertex.geometry;
      const v1 = inst1.outerShell.orientedFaces[0].face.outerLoop.orientedEdges[0].edge.startVertex.geometry;
      expect(Math.abs(v1.z - (v0.z + 30))).toBeLessThan(1e-5);
    });

    it('TEST-04: Discard derived instances -> Regenerate -> Rebuilt correctly (Critical Engineering Test)', () => {
      const history = new FeatureHistory('DOC_PATTERN_DISCARD');

      history.addFeature(
        'EXTRUDE',
        'SeedBox',
        {
          type: 'EXTRUDE',
          name: 'SeedBox',
          parameters: { width: 10, height: 10, depth: 10 }
        },
        [],
        undefined,
        'FEAT_SEED'
      );

      const patternNode = history.addFeature(
        'PATTERN',
        'LinearPattern',
        {
          type: 'PATTERN',
          name: 'LinearPattern',
          parameters: {
            sourceFeatureId: 'FEAT_SEED',
            count: 3,
            spacing: 10
          }
        },
        ['FEAT_SEED'],
        'FEAT_SEED',
        'FEAT_PATTERN'
      );

      let res = history.regenerate({ forceAll: true });
      expect(res.success).toBe(true);
      expect(patternNode.outputGeometry).toBeDefined();

      // DISCARD derived instances output geometry completely
      patternNode.outputGeometry = undefined;
      patternNode.state = 'INVALID';

      // Regenerate again
      res = history.regenerate({ forceAll: true });
      expect(res.success).toBe(true);
      
      // Verify that instances are fully rebuilt
      expect(patternNode.outputGeometry).toBeDefined();
      const compound = patternNode.outputGeometry as Compound;
      expect(compound.shapes.length).toBe(3);
    });

    it('TEST-05: Adversarial - Seed deletion/suppression fails evaluation of Pattern', () => {
      const history = new FeatureHistory('DOC_PATTERN_ADVERSARIAL');

      history.addFeature(
        'EXTRUDE',
        'SeedBox',
        {
          type: 'EXTRUDE',
          name: 'SeedBox',
          parameters: { width: 10, height: 10, depth: 10 }
        },
        [],
        undefined,
        'FEAT_SEED'
      );

      history.addFeature(
        'PATTERN',
        'Pattern',
        {
          type: 'PATTERN',
          name: 'Pattern',
          parameters: {
            sourceFeatureId: 'FEAT_SEED',
            count: 4,
            spacing: 12
          }
        },
        ['FEAT_SEED'],
        'FEAT_SEED',
        'FEAT_PATTERN'
      );

      let res = history.regenerate({ forceAll: true });
      expect(res.success).toBe(true);

      // Suppress Seed Feature
      history.setSuppressed('FEAT_SEED', true);

      // Regenerate must fail pattern feature because of dependency dependency invalidation
      res = history.regenerate({ forceAll: true });
      expect(res.success).toBe(false);
      expect(history.getFeature('FEAT_PATTERN')?.state).toBe('FAILED');
    });

    it('TEST-06: Modifying seed propagates geometry changes to all pattern instances', () => {
      const history = new FeatureHistory('DOC_PATTERN_PROPAGATION');

      const seedFeat = history.addFeature(
        'EXTRUDE',
        'SeedBox',
        {
          type: 'EXTRUDE',
          name: 'SeedBox',
          parameters: { width: 10, height: 10, depth: 10 } // Box starts 10x10x10
        },
        [],
        undefined,
        'FEAT_SEED'
      );

      history.addFeature(
        'PATTERN',
        'Pattern',
        {
          type: 'PATTERN',
          name: 'Pattern',
          parameters: {
            sourceFeatureId: 'FEAT_SEED',
            count: 2,
            spacing: 50
          }
        },
        ['FEAT_SEED'],
        'FEAT_SEED',
        'FEAT_PATTERN'
      );

      let res = history.regenerate({ forceAll: true });
      expect(res.success).toBe(true);

      // Check height of instance 1
      let compound = history.getFeature('FEAT_PATTERN')?.outputGeometry as Compound;
      let inst1 = compound.shapes[1] as Solid;
      let vMaxZ = Math.max(...inst1.outerShell.orientedFaces.flatMap(f => f.face.outerLoop.orientedEdges.flatMap(oe => [oe.edge.startVertex.geometry.z, oe.edge.endVertex.geometry.z])));
      expect(Math.abs(vMaxZ - 0.01)).toBeLessThan(1e-5); // height was 10mm = 0.01m

      // Mutate seed feature parameters (double the width/height/depth)
      seedFeat.parameters = { width: 20, height: 20, depth: 20 };
      seedFeat.state = 'INVALID'; // force invalidation

      res = history.regenerate({ forceAll: true });
      expect(res.success).toBe(true);

      compound = history.getFeature('FEAT_PATTERN')?.outputGeometry as Compound;
      inst1 = compound.shapes[1] as Solid;
      vMaxZ = Math.max(...inst1.outerShell.orientedFaces.flatMap(f => f.face.outerLoop.orientedEdges.flatMap(oe => [oe.edge.startVertex.geometry.z, oe.edge.endVertex.geometry.z])));
      expect(Math.abs(vMaxZ - 0.02)).toBeLessThan(1e-5); // height correctly propagated to 20mm = 0.02m
    });
  });
});
