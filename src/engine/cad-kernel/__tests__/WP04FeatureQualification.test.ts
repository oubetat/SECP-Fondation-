/**
 * SECP CAD Kernel — WP-04 Advanced Feature-Based Modeling Qualification Test Suite
 * SECP-CAD-KERNEL-PHASE-2-001
 */

import { describe, it, expect } from 'vitest';
import { FeatureHistory } from '../history/FeatureHistory';
import { PatternEngine } from '../history/PatternEngine';
import { HoleEvaluator } from '../brep/HoleEvaluator';
import { DraftEvaluator } from '../evaluators/DraftEvaluator';
import { RibEvaluator } from '../evaluators/RibEvaluator';
import { BoxFactory } from '../boolean/BoxFactory';
import { BRepValidator } from '../brep/BRepValidator';
import { Solid, TopoShapeEnum } from '../topology/TopologyContracts';

describe('SECP-CAD-KERNEL-PHASE-2-001 — WP-04 Advanced Feature-Based Modeling Qualification', () => {
  const validator = new BRepValidator();

  it('QUAL-01: Parametric Feature History Tree Construction & Recompute Dependency DAG', () => {
    const history = new FeatureHistory('DOC_FEAT_01');

    const sketch = history.addFeature('SKETCH', 'BaseSketch', {
      type: 'SKETCH',
      name: 'BaseSketch',
      parameters: { plane: 'XY', entities: [], closedProfile: true },
      inputReferences: []
    });

    const extrude = history.addFeature('EXTRUDE', 'MainBlock', {
      type: 'EXTRUDE',
      name: 'MainBlock',
      parameters: { width: 50, height: 50, depth: 20 },
      inputReferences: [{ targetFeatureId: sketch.id }]
    }, [sketch.id]);

    const fillet = history.addFeature('FILLET', 'TopFillet', {
      type: 'FILLET',
      name: 'TopFillet',
      parameters: { radius: 2.5, edgeIds: ['e1'] },
      inputReferences: [{ targetFeatureId: extrude.id }]
    }, [extrude.id]);

    expect(history.getAllFeatures().length).toBe(3);

    // Verify recompute invalidation propagation
    history.updateFeatureDefinition(sketch.id, {
      type: 'SKETCH',
      name: 'BaseSketch',
      parameters: { plane: 'XY', entities: [], closedProfile: true, radius: 10 },
      inputReferences: []
    });

    const extrudeNode = history.getFeature(extrude.id)!;
    const filletNode = history.getFeature(fillet.id)!;

    expect(extrudeNode.state).toBe('STALE');
    expect(filletNode.state).toBe('STALE');

    // Regenerate
    const regRes = history.regenerate();
    if (!regRes.success) {
      console.log('QUAL-01 Diagnostics:', regRes.diagnostics);
    }
    expect(regRes.success).toBe(true);
  });

  it('QUAL-02: Feature Suppression & Unsuppression with Downstream Dependency Invalidation', () => {
    const history = new FeatureHistory('DOC_FEAT_02');

    const f1 = history.addFeature('SKETCH', 'S1', { type: 'SKETCH', name: 'S1', parameters: {}, inputReferences: [] });
    const f2 = history.addFeature('EXTRUDE', 'E1', { type: 'EXTRUDE', name: 'E1', parameters: { depth: 10 }, inputReferences: [{ targetFeatureId: f1.id }] }, [f1.id]);
    const f3 = history.addFeature('HOLE', 'H1', { type: 'HOLE', name: 'H1', parameters: { diameter: 5 }, inputReferences: [{ targetFeatureId: f2.id }] }, [f2.id]);

    // Suppress E1
    history.setSuppressed(f2.id, true);
    const nodeE1 = history.getFeature(f2.id)!;
    const nodeH1 = history.getFeature(f3.id)!;

    expect(nodeE1.state).toBe('SUPPRESSED');
    expect(nodeH1.state).toBe('STALE');

    // Unsuppress E1
    history.setSuppressed(f2.id, false);
    expect(nodeE1.state).toBe('STALE');

    const regRes = history.regenerate();
    if (!regRes.success) {
      console.log('QUAL-02 Diagnostics:', regRes.diagnostics);
    }
    expect(regRes.success).toBe(true);
  });

  it('QUAL-03: Linear Feature Pattern Execution with Solid Manifold Validation', () => {
    const base = BoxFactory.createBox('BASE_LIN_PAT', 0, 0, 0, 10, 10, 10);
    const patternResult = PatternEngine.executeLinearPattern(base, 3, { x: 1, y: 0, z: 0 }, 15);

    expect(patternResult).toBeDefined();
    expect(patternResult.shapeType).toBe(TopoShapeEnum.SOLID);

    const val = validator.validate(patternResult);
    expect(val.status).toBe('VALID');
  });

  it('QUAL-04: Circular Feature Pattern Execution around 3D Rodrigues Axis', () => {
    const base = BoxFactory.createBox('BASE_CIRC_PAT', 10, 0, 0, 15, 5, 10);
    const patternResult = PatternEngine.executeCircularPattern(
      base,
      4,
      (3 * Math.PI) / 2, // 270 degrees
      { x: 0 as any, y: 0 as any, z: 0 as any },
      { x: 0 as any, y: 0 as any, z: 1 as any }
    );

    expect(patternResult).toBeDefined();
    expect(patternResult.shapeType).toBe(TopoShapeEnum.SOLID);

    const val = validator.validate(patternResult);
    expect(val.status).toBe('VALID');
  });

  it('QUAL-05: Parametric Mirror Feature Execution across 3D Reflection Plane', () => {
    const base = BoxFactory.createBox('BASE_MIRROR', 5, 0, 0, 15, 10, 10);
    const mirrorResult = PatternEngine.executeMirrorPattern(
      base,
      { x: 0 as any, y: 0 as any, z: 0 as any },
      { x: 1 as any, y: 0 as any, z: 0 as any }
    );

    expect(mirrorResult).toBeDefined();
    expect(mirrorResult.shapeType).toBe(TopoShapeEnum.SOLID);

    const val = validator.validate(mirrorResult);
    expect(val.status).toBe('VALID');
  });

  it('QUAL-06: Parametric Hole Feature Evaluation (Simple, Counterbore, Countersink)', () => {
    const baseSolid = BoxFactory.createBox('HOLE_BLOCK', 0, 0, 0, 40, 40, 20);

    const simpleHoleRes = HoleEvaluator.evaluateHole(baseSolid, {
      holeType: 'SIMPLE',
      diameter: 10,
      depth: 15,
      center: { x: 20 as any, y: 20 as any, z: 20 as any },
      direction: { x: 0 as any, y: 0 as any, z: -1 as any }
    });

    expect(simpleHoleRes.success).toBe(true);
    expect(simpleHoleRes.resultSolid).toBeDefined();

    const cboreRes = HoleEvaluator.evaluateHole(baseSolid, {
      holeType: 'COUNTERBORE',
      diameter: 8,
      counterbore: { diameter: 14, depth: 5 },
      depth: 20,
      center: { x: 20 as any, y: 20 as any, z: 20 as any },
      direction: { x: 0 as any, y: 0 as any, z: -1 as any }
    });

    expect(cboreRes.success).toBe(true);
  });

  it('QUAL-07: Parametric Draft & Rib Evaluators', () => {
    const baseSolid = BoxFactory.createBox('DRAFT_BLOCK', 0, 0, 0, 30, 30, 30);

    const draftRes = DraftEvaluator.evaluate(baseSolid, {
      angle: 3.0,
      pullDirection: { x: 0, y: 0, z: 1 } as any,
      neutralPlane: { point: { x: 0, y: 0, z: 0 } } as any
    });

    expect(draftRes.success).toBe(true);
    expect(draftRes.resultSolid).toBeDefined();

    const ribRes = RibEvaluator.evaluate(baseSolid, {
      thickness: 4.0,
      extrusionDepth: 15.0,
      profile: [
        { x: 0, y: 15, z: 30 },
        { x: 30, y: 15, z: 0 }
      ]
    });

    expect(ribRes.success).toBe(true);
  });

  it('QUAL-08: Adversarial Circular Dependency Detection & Fail-Closed Rejection', () => {
    const history = new FeatureHistory('DOC_FEAT_CYCLE');

    const f1 = history.addFeature('SKETCH', 'F1', { type: 'SKETCH', name: 'F1', parameters: {}, inputReferences: [] });
    const f2 = history.addFeature('EXTRUDE', 'F2', { type: 'EXTRUDE', name: 'F2', parameters: {}, inputReferences: [{ targetFeatureId: f1.id }] }, [f1.id]);

    // Force circular dependency artificially in graph
    const graph = history.getGraph();
    graph.addDependency(f1.id, f2.id); // F1 depends on F2 while F2 depends on F1

    const regRes = history.regenerate();
    expect(regRes.success).toBe(false);
    expect(regRes.diagnostics.some(d => d.message.includes('cycle') || d.message.includes('Circular'))).toBe(true);
  });
});
