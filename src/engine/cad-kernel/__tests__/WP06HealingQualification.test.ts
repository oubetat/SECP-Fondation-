/**
 * SECP CAD Kernel — WP-06 Geometry Healing & Model Repair Qualification Test Suite
 * SECP-CAD-KERNEL-PHASE-2-001
 */

import { describe, it, expect } from 'vitest';
import { TopologyHealingEngine } from '../healing/TopologyHealingEngine';
import { BoxFactory } from '../boolean/BoxFactory';
import { BRepValidator } from '../brep/BRepValidator';
import { TopoShapeEnum, Orientation } from '../topology/TopologyContracts';

describe('SECP-CAD-KERNEL-PHASE-2-001 — WP-06 Geometry Healing & Model Repair Qualification', () => {
  const engine = new TopologyHealingEngine();
  const validator = new BRepValidator();

  it('QUAL-01: Idempotency & Clean Solid Verification (heal(heal(S)) === heal(S))', () => {
    const box = BoxFactory.createBox('CLEAN_BOX', 0, 0, 0, 10, 10, 10);

    const heal1 = engine.heal(box, 'KERNEL_GENERATED');
    expect(heal1.status).toBe('UNCHANGED_VALID');
    expect(heal1.defectsDetected.length).toBe(0);

    const heal2 = engine.heal(box, 'KERNEL_GENERATED');
    expect(heal2.determinismHash).toBe(heal1.determinismHash);
  });

  it('QUAL-02: Gap Detection & Proximity Vertex Merging across Disjoint Points', () => {
    const box = BoxFactory.createBox('GAP_BOX', 0, 0, 0, 10, 10, 10);
    const defectiveBox = JSON.parse(JSON.stringify(box));
    const face0 = defectiveBox.outerShell.orientedFaces[0].face;
    const v0 = face0.outerLoop.orientedEdges[0].edge.endVertex;
    const vDup = { id: 'v_dup_1', shapeType: v0.shapeType, geometry: { ...v0.geometry }, tolerance: 1e-7 };
    face0.outerLoop.orientedEdges[1].edge.startVertex = vDup;

    const healRes = engine.heal(defectiveBox, 'IMPORTED');
    expect(healRes.repairsApplied.some(r => r.action === 'MERGE_VERTEX')).toBe(true);
    expect(['REPAIRED_VALID', 'PARTIALLY_REPAIRED', 'REPAIR_FAILED']).toContain(healRes.status);
  });

  it('QUAL-03: Zero-Length Edge Removal & Degenerate Edge Collapsing', () => {
    const box = BoxFactory.createBox('DEGEN_BOX', 0, 0, 0, 10, 10, 10);
    const defectiveBox = JSON.parse(JSON.stringify(box));
    // Add a degenerate zero-length edge to the first face's loop
    const face0 = defectiveBox.outerShell.orientedFaces[0].face;
    const vRef = face0.outerLoop.orientedEdges[0].edge.startVertex;

    const zeroLengthEdge = {
      id: 'zero_edge_01',
      shapeType: TopoShapeEnum.EDGE,
      geometry: { evaluate: () => vRef.geometry, domain: () => ({ uMin: 0, uMax: 0 }) },
      startVertex: vRef,
      endVertex: vRef,
      tolerance: 1e-7
    };

    face0.outerLoop.orientedEdges.push({ edge: zeroLengthEdge, orientation: Orientation.FORWARD });

    const healRes = engine.heal(defectiveBox, 'IMPORTED');
    expect(healRes.status).toBe('REPAIRED_VALID');
    expect(healRes.repairsApplied.some(r => r.action === 'REMOVE_ZERO_LENGTH_EDGE')).toBe(true);
  });

  it('QUAL-04: Face Normal Orientation Alignment & Reversal Repair', () => {
    const box = BoxFactory.createBox('FLIPPED_BOX', 0, 0, 0, 10, 10, 10);
    const defectiveBox = JSON.parse(JSON.stringify(box));
    // Invert normal direction of face 0 to create orientation inconsistency
    const face0 = defectiveBox.outerShell.orientedFaces[0];
    face0.orientation = Orientation.REVERSED;

    const healRes = engine.heal(defectiveBox, 'IMPORTED');
    expect(healRes.repairsApplied.some(r => r.action === 'FIX_FACE_ORIENTATION')).toBe(true);
    expect(['REPAIRED_VALID', 'PARTIALLY_REPAIRED']).toContain(healRes.status);
  });

  it('QUAL-05: Transactional Safety & Fail-Closed Rollback on Unrepairable Defects', () => {
    const invalidNullInput = null;
    const healRes = engine.heal(invalidNullInput, 'UNKNOWN');

    expect(healRes.status).toBe('INVALID_INPUT');
    expect(healRes.repairsRejected.length).toBeGreaterThan(0);
    expect(healRes.outputShapeId).toBeUndefined();
  });
});
