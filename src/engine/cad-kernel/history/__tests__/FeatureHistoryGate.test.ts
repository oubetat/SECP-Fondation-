/**
 * SECP CAD Kernel — Feature History Acceptance Gate Test
 * Phase 2 (PATCH-022)
 */

import { describe, it, expect } from 'vitest';
import { FeatureHistory } from '../FeatureHistory';
import { FeatureHistoryAcceptanceGate } from '../FeatureHistoryAcceptanceGate';

describe('PATCH-022 — Feature History Acceptance Gate Verification', () => {
  it('passes the Acceptance Gate for a valid parametric CAD feature history', () => {
    const history = new FeatureHistory('DOC_GATE_022');

    // Build valid parametric feature history: Sketch -> Extrude -> Fillet
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
      inputReferences: [{ type: 'SKETCH', targetFeatureId: sketch.id }]
    }, [sketch.id]);

    const fillet = history.addFeature('FILLET', 'EdgeBlend', {
      type: 'FILLET',
      name: 'EdgeBlend',
      parameters: { radius: 3.0 },
      inputReferences: [{ type: 'FEATURE', targetFeatureId: extrude.id }]
    }, [extrude.id]);

    // Perform regeneration
    const regen = history.regenerate();
    if (!regen.success) {
      console.log('REGEN DIAGNOSTICS:', JSON.stringify(regen.diagnostics, null, 2));
    }
    expect(regen.success).toBe(true);

    // Evaluate Acceptance Gate
    const report = FeatureHistoryAcceptanceGate.evaluate(history);
    console.log('PATCH-022 GATE REPORT:', JSON.stringify(report, null, 2));

    expect(report.patchId).toBe('PATCH-022');
    expect(report.verdict).toBe('PASS');
    expect(report.dimensions.IDENTITY.verdict).toBe('PASS');
    expect(report.dimensions.DEFINITION.verdict).toBe('PASS');
    expect(report.dimensions.DEPENDENCIES.verdict).toBe('PASS');
    expect(report.dimensions.ORDERING.verdict).toBe('PASS');
    expect(report.dimensions.REGENERATION.verdict).toBe('PASS');
    expect(report.dimensions.STATE.verdict).toBe('PASS');
    expect(report.dimensions.HASH.verdict).toBe('PASS');
    expect(report.dimensions.PROVENANCE.verdict).toBe('PASS');
    expect(report.dimensions.DETERMINISM.verdict).toBe('PASS');
    expect(report.dimensions.ADVERSARIAL.verdict).toBe('PASS');
    expect(report.evidenceHash).toBeDefined();
  });
});
