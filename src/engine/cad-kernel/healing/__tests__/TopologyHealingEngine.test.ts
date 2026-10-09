/**
 * SECP CAD Kernel — Topology Healing Engine Test Suite
 * Phase 2 (PATCH-020)
 */

import { describe, it, expect } from 'vitest';
import { TopologyHealingEngine } from '../TopologyHealingEngine';
import { HardAcceptanceGate020 } from '../HardAcceptanceGate020';
import { BoxFactory } from '../../boolean/BoxFactory';

describe('PATCH-020: Topology Healing Engine', () => {
  const engine = new TopologyHealingEngine();

  it('TEST-001: should leave an already-valid solid unchanged', () => {
    const box = BoxFactory.createBox('box_test_1', 0, 0, 0, 10, 10, 10);
    const result = engine.heal(box);

    expect(result.status).toBe('UNCHANGED_VALID');
    expect(result.defectsDetected).toHaveLength(0);
    expect(result.repairsApplied).toHaveLength(0);
    expect(result.validation.isValid).toBe(true);
  });

  it('TEST-002 & TEST-003: should detect and merge duplicate vertices', () => {
    const box = BoxFactory.createBox('box_test_dup', 0, 0, 0, 10, 10, 10);
    const v0 = box.outerShell.orientedFaces[0].face.outerLoop.orientedEdges[0].edge.startVertex;
    const vDup = { id: 'v_dup_1', shapeType: v0.shapeType, geometry: { ...v0.geometry }, tolerance: 1e-7 };
    box.outerShell.orientedFaces[0].face.outerLoop.orientedEdges[1].edge.startVertex = vDup;

    const result = engine.heal(box);
    expect(result.defectsDetected.some(d => d.defectType === 'DUPLICATE_VERTEX')).toBe(true);
    expect(result.repairsApplied.some(r => r.action === 'MERGE_VERTEX')).toBe(true);
  });

  it('TEST-018: should be idempotent (Heal(Heal(Model)) === Heal(Model))', () => {
    const box = BoxFactory.createBox('box_test_idemp', 0, 0, 0, 10, 10, 10);
    const res1 = engine.heal(box);
    const res2 = engine.heal(box);

    expect(res2.status).toBe('UNCHANGED_VALID');
    expect(res2.repairsApplied).toHaveLength(0);
    expect(res2.determinismHash).toBe(res1.determinismHash);
  });

  it('TEST-024: should not mutate original input shape during transaction', () => {
    const box = BoxFactory.createBox('box_test_trans', 0, 0, 0, 10, 10, 10);
    const initialJSON = JSON.stringify(box);

    engine.heal(box);

    expect(JSON.stringify(box)).toBe(initialJSON);
  });

  it('GATE-020: HardAcceptanceGate020 should pass all checks with verdict PASS', () => {
    const report = HardAcceptanceGate020.evaluateAll();

    expect(report.verdict).toBe('PASS');
    expect(report.failures).toHaveLength(0);
    expect(report.checks.length).toBe(24);
    expect(report.checks.every(c => c.passed)).toBe(true);
  });
});
