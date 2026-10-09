import { PatternEngine } from '../cad/pattern/PatternEngine';
import { PatternBRepValidator } from '../cad/pattern/PatternBRepValidator';

export class HardAcceptanceGate208 {

  public evaluate(): { verdict: 'PROVEN' | 'SIMULATED' | 'FAIL'; checks: any[] } {
    const checks = [];
    let passed = 0;
    let total = 0;

    const engine = new PatternEngine();

    // Check 1: 1D & 2D Linear Grid Matrix Pattern
    try {
      total++;
      const linPattern = engine.createLinearPattern(
        'Matrix Holes',
        ['hole_feature_01'],
        {
          direction1: { x: 1, y: 0, z: 0 },
          count1: 4,
          spacing1: 25,
          direction2: { x: 0, y: 1, z: 0 },
          count2: 3,
          spacing2: 20
        }
      );

      // Matrix 4x3 = 12 instances
      if (linPattern.instances.length === 12 && linPattern.status === 'VALID') {
        const instCorner = linPattern.instances[11]; // i=3, j=2 => x=75, y=40
        if (instCorner.position.x === 75 && instCorner.position.y === 40) {
          checks.push({ name: '2D Linear Matrix Pattern (4x3 Grid Math)', status: 'PASS' });
          passed++;
        } else {
          checks.push({ name: '2D Linear Matrix Pattern (4x3 Grid Math)', status: 'FAIL', reason: `Unexpected position x:${instCorner.position.x}, y:${instCorner.position.y}` });
        }
      } else {
        checks.push({ name: '2D Linear Matrix Pattern (4x3 Grid Math)', status: 'FAIL', reason: `Instance count was ${linPattern.instances.length}` });
      }
    } catch (e: any) {
      checks.push({ name: '2D Linear Matrix Pattern (4x3 Grid Math)', status: 'FAIL', reason: e.message });
    }

    // Check 2: Circular Pattern (360° Axis Rotation)
    try {
      total++;
      const circPattern = engine.createCircularPattern(
        'Circular Flange Holes',
        ['flange_hole_01'],
        {
          axisOrigin: { x: 0, y: 0, z: 0 },
          axisDirection: { x: 0, y: 0, z: 1 },
          count: 8,
          angleDegrees: 360,
          isTotalAngle: true
        }
      );

      if (circPattern.instances.length === 8 && circPattern.status === 'VALID') {
        checks.push({ name: 'Circular Pattern 360° Axis Rotation', status: 'PASS' });
        passed++;
      } else {
        checks.push({ name: 'Circular Pattern 360° Axis Rotation', status: 'FAIL', reason: 'Circular pattern creation failed.' });
      }
    } catch (e: any) {
      checks.push({ name: 'Circular Pattern 360° Axis Rotation', status: 'FAIL', reason: e.message });
    }

    // Check 3: Variable Pattern (Scale & Position Overrides)
    try {
      total++;
      const varPattern = engine.createVariablePattern(
        'Variable Spaced Ribs',
        ['rib_feature_01'],
        {
          baseType: 'LINEAR',
          linearDef: {
            direction1: { x: 1, y: 0, z: 0 },
            count1: 5,
            spacing1: 15
          },
          overrides: [
            { instanceIndex: 2, customOffset: { x: 5, y: 0, z: 0 }, scaleFactor: 1.2 }
          ]
        }
      );

      const inst2 = varPattern.instances[2]; // base x=30 + offset 5 = 35
      if (inst2.position.x === 35 && inst2.scale?.x === 1.2) {
        checks.push({ name: 'Variable Pattern Parameter Overrides', status: 'PASS' });
        passed++;
      } else {
        checks.push({ name: 'Variable Pattern Parameter Overrides', status: 'FAIL', reason: `Position x:${inst2.position.x}, scale:${inst2.scale?.x}` });
      }
    } catch (e: any) {
      checks.push({ name: 'Variable Pattern Parameter Overrides', status: 'FAIL', reason: e.message });
    }

    // Check 4: Instance Suppression & Rebuild
    try {
      total++;
      const pat = engine.createLinearPattern(
        'Suppression Test Pattern',
        ['slot_01'],
        { direction1: { x: 1, y: 0, z: 0 }, count1: 10, spacing1: 10 }
      );

      engine.toggleInstanceSuppression(pat.id, 3); // Suppress instance 3
      engine.toggleInstanceSuppression(pat.id, 7); // Suppress instance 7

      const recomputed = engine.getPattern(pat.id);
      const activeCount = recomputed?.instances.filter(i => !i.isSuppressed).length;

      if (activeCount === 8 && recomputed?.suppressionList.length === 2) {
        checks.push({ name: 'Instance Suppression & Rebuild', status: 'PASS' });
        passed++;
      } else {
        checks.push({ name: 'Instance Suppression & Rebuild', status: 'FAIL', reason: `Active count was ${activeCount}` });
      }
    } catch (e: any) {
      checks.push({ name: 'Instance Suppression & Rebuild', status: 'FAIL', reason: e.message });
    }

    // Check 5: Parametric Rebuild on Parameter Change
    try {
      total++;
      const pat = engine.createLinearPattern(
        'Rebuild Test Pattern',
        ['pocket_01'],
        { direction1: { x: 1, y: 0, z: 0 }, count1: 3, spacing1: 20 }
      );

      const hashBefore = pat.outputBRepHash;
      pat.linearDef!.count1 = 6;
      engine.recomputePattern(pat.id, 'brep_root_modified_002');

      const patAfter = engine.getPattern(pat.id);
      if (patAfter?.instances.length === 6 && patAfter.outputBRepHash !== hashBefore) {
        checks.push({ name: 'Parametric Rebuild on Parameter Modification', status: 'PASS' });
        passed++;
      } else {
        checks.push({ name: 'Parametric Rebuild on Parameter Modification', status: 'FAIL', reason: 'Rebuild failed to update instance count or B-Rep hash.' });
      }
    } catch (e: any) {
      checks.push({ name: 'Parametric Rebuild on Parameter Modification', status: 'FAIL', reason: e.message });
    }

    // Check 6: Self-Intersection Collision Detection
    try {
      total++;
      const patSelfIntersect = engine.createLinearPattern(
        'Self Intersecting Zero Spacing',
        ['boss_01'],
        { direction1: { x: 1, y: 0, z: 0 }, count1: 4, spacing1: 0 } // spacing = 0 => identical overlap
      );

      if (patSelfIntersect.status === 'BREP_ERROR' && patSelfIntersect.diagnostics.some(d => d.code === 'PATTERN_SELF_INTERSECTION' || d.code === 'PATTERN_ZERO_SPACING')) {
        checks.push({ name: 'B-Rep Topological Validation & Self-Intersection Diagnostics', status: 'PASS' });
        passed++;
      } else {
        checks.push({ name: 'B-Rep Topological Validation & Self-Intersection Diagnostics', status: 'FAIL', reason: 'Failed to flag zero spacing or self intersection.' });
      }
    } catch (e: any) {
      checks.push({ name: 'B-Rep Topological Validation & Self-Intersection Diagnostics', status: 'FAIL', reason: e.message });
    }

    // Check 7: Invalid Axis / Direction Diagnostic Error Handling
    try {
      total++;
      const invalidCirc = engine.createCircularPattern(
        'Zero Axis Circular',
        ['hole_01'],
        {
          axisOrigin: { x: 0, y: 0, z: 0 },
          axisDirection: { x: 0, y: 0, z: 0 }, // Degenerate vector
          count: 4,
          angleDegrees: 360
        }
      );

      if (invalidCirc.status === 'BREP_ERROR' && invalidCirc.diagnostics.some(d => d.code === 'PATTERN_INVALID_AXIS')) {
        checks.push({ name: 'Invalid Axis & Degenerate Vector Diagnostics', status: 'PASS' });
        passed++;
      } else {
        checks.push({ name: 'Invalid Axis & Degenerate Vector Diagnostics', status: 'FAIL', reason: 'Failed to flag degenerate axis vector.' });
      }
    } catch (e: any) {
      checks.push({ name: 'Invalid Axis & Degenerate Vector Diagnostics', status: 'FAIL', reason: e.message });
    }

    // Check 8: Determinism & Reproducibility Test
    try {
      total++;
      const engine1 = new PatternEngine();
      const engine2 = new PatternEngine();

      const def = { direction1: { x: 0, y: 1, z: 0 }, count1: 5, spacing1: 12.5 };
      const pat1 = engine1.createLinearPattern('Det Pattern', ['f1'], def, 'brep_seed_x');
      const pat2 = engine2.createLinearPattern('Det Pattern', ['f1'], def, 'brep_seed_x');

      const samePositions = pat1.instances.every((inst, i) => 
        inst.position.y === pat2.instances[i].position.y
      );

      if (samePositions && pat1.instances.length === pat2.instances.length) {
        checks.push({ name: 'Determinism & Mathematical Reproducibility', status: 'PASS' });
        passed++;
      } else {
        checks.push({ name: 'Determinism & Mathematical Reproducibility', status: 'FAIL', reason: 'Instances produced non-deterministic positions.' });
      }
    } catch (e: any) {
      checks.push({ name: 'Determinism & Mathematical Reproducibility', status: 'FAIL', reason: e.message });
    }

    // Check 9: Feature Tree Integration
    try {
      total++;
      const patterns = engine.getPatterns();
      if (patterns.length >= 4 && patterns.every(p => p.id && p.dependencies.length > 0)) {
        checks.push({ name: 'Feature Tree & Dependency Graph Registration', status: 'PASS' });
        passed++;
      } else {
        checks.push({ name: 'Feature Tree & Dependency Graph Registration', status: 'FAIL', reason: 'Patterns not correctly linked to feature tree.' });
      }
    } catch (e: any) {
      checks.push({ name: 'Feature Tree & Dependency Graph Registration', status: 'FAIL', reason: e.message });
    }

    // Check 10: Evidence Bus Event Generation
    try {
      total++;
      const ledger = engine.getEvidenceLedger();
      if (ledger.length > 0 && ledger.every(ev => ev.eventId && ev.hash && ev.timestamp)) {
        checks.push({ name: 'Evidence Ledger Event Generation', status: 'PASS' });
        passed++;
      } else {
        checks.push({ name: 'Evidence Ledger Event Generation', status: 'FAIL', reason: 'Evidence ledger missing expected event entries.' });
      }
    } catch (e: any) {
      checks.push({ name: 'Evidence Ledger Event Generation', status: 'FAIL', reason: e.message });
    }

    const verdict = passed === total ? 'PROVEN' : 'FAIL';
    return { verdict, checks };
  }
}
