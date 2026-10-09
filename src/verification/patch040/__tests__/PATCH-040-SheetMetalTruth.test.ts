/**
 * SECP — PATCH-040 Qualification Battery
 * SHEET METAL TRUTH & BEND MODEL CLOSURE
 */

import { describe, it, expect } from 'vitest';
import { asM } from '../../../engine/cad-kernel/core/Units';
import { SheetMetalEngine, SheetMetalVerifier, BendModel, SheetMetalFeature } from '../../../engine/cad/surface/SheetMetalEngine';
import { SheetMetalTruthAcceptanceGate } from '../../../engine/cad/surface/SheetMetalTruthAcceptanceGate';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';

describe('PATCH-040 Sheet Metal Truth Closure Battery', () => {

  // Test A — Simple Plate
  it('should verify Simple Plate produces correct unfolded dimensions', () => {
    const basePlate = { width: 80, length: 120 };
    const flatPattern = SheetMetalEngine.unfoldGeometry(basePlate, [], 1.5, 1);

    expect(flatPattern.overallWidth).toBe(80);
    expect(flatPattern.overallLength).toBe(120); // No bends, so flat length matches base
    expect(flatPattern.area).toBe(80 * 120);
  });

  // Test B — Single Bend
  it('should verify Single Bend calculates correct bend allowance, deduction, and flat length', () => {
    const thickness = 2.0;
    const bendRadius = 3.0;
    const kFactor = 0.44;
    const angleDeg = 90.0;

    const bendP1 = { x: asM(0), y: asM(40), z: asM(0) };
    const bendP2 = { x: asM(80), y: asM(40), z: asM(0) };

    const bendModel = SheetMetalEngine.createBendModel(
      'B-01',
      'FEAT-SM-01',
      angleDeg,
      bendRadius,
      thickness,
      kFactor,
      bendP1,
      bendP2,
      1
    );

    // Mathematical formula assertion:
    // BA = θ * (π / 180) * (R + K * T)
    const expectedBA = (90.0 * Math.PI / 180.0) * (3.0 + 0.44 * 2.0); // 1.570796 * 3.88 = 6.0947
    expect(bendModel.bendAllowance).toBeCloseTo(expectedBA, 4);

    // BD = 2 * (R + T) * tan(θ * π / 360) - BA
    const expectedBD = 2 * (3.0 + 2.0) * Math.tan(90.0 * Math.PI / 360.0) - expectedBA; // 10 * 1.0 - 6.0947 = 3.9053
    expect(bendModel.bendDeduction).toBeCloseTo(expectedBD, 4);

    const basePlate = { width: 80, length: 100 };
    const flatPattern = SheetMetalEngine.unfoldGeometry(basePlate, [bendModel], thickness, 1);

    const expectedFlatLength = 100 + expectedBA;
    expect(flatPattern.overallLength).toBeCloseTo(expectedFlatLength, 4);
  });

  // Test C — Multiple Bends
  it('should verify Multiple Bends calculate cumulative developed length', () => {
    const thickness = 2.0;
    const bendRadius = 3.0;
    const kFactor = 0.44;

    const bend1 = SheetMetalEngine.createBendModel(
      'B-01', 'FEAT-SM-01', 90.0, bendRadius, thickness, kFactor,
      { x: asM(0), y: asM(30), z: asM(0) }, { x: asM(80), y: asM(30), z: asM(0) }, 1
    );

    const bend2 = SheetMetalEngine.createBendModel(
      'B-02', 'FEAT-SM-01', 45.0, bendRadius, thickness, kFactor,
      { x: asM(0), y: asM(60), z: asM(0) }, { x: asM(80), y: asM(60), z: asM(0) }, 1
    );

    const basePlate = { width: 80, length: 150 };
    const flatPattern = SheetMetalEngine.unfoldGeometry(basePlate, [bend1, bend2], thickness, 1);

    const cumulativeBA = bend1.bendAllowance + bend2.bendAllowance;
    const expectedFlatLength = 150 + cumulativeBA;

    expect(flatPattern.overallLength).toBeCloseTo(expectedFlatLength, 4);
    expect(flatPattern.topologyLineage.length).toBe(4); // 2 bends * 2 entries each
  });

  // Test D — K-Factor Mutation
  it('should verify that changing K-Factor dynamically changes flat developed length', () => {
    const thickness = 2.0;
    const bendRadius = 3.0;
    const basePlate = { width: 80, length: 100 };

    const bendK35 = SheetMetalEngine.createBendModel(
      'B-01', 'FEAT-SM-01', 90.0, bendRadius, thickness, 0.35,
      { x: asM(0), y: asM(50), z: asM(0) }, { x: asM(80), y: asM(50), z: asM(0) }, 1
    );

    const bendK50 = SheetMetalEngine.createBendModel(
      'B-01', 'FEAT-SM-01', 90.0, bendRadius, thickness, 0.50,
      { x: asM(0), y: asM(50), z: asM(0) }, { x: asM(80), y: asM(50), z: asM(0) }, 1
    );

    const flatK35 = SheetMetalEngine.unfoldGeometry(basePlate, [bendK35], thickness, 1);
    const flatK50 = SheetMetalEngine.unfoldGeometry(basePlate, [bendK50], thickness, 1);

    expect(flatK35.overallLength).not.toBe(flatK50.overallLength);
    expect(flatK50.overallLength).toBeGreaterThan(flatK35.overallLength); // Larger K-factor -> larger neutral axis radius -> larger BA
  });

  // Test E — Bend Radius Mutation Revision Invalidation
  it('should verify bend radius mutation triggers revision increments and invalidates old result', () => {
    const flatPatternRev1 = SheetMetalEngine.unfoldGeometry(
      { width: 80, length: 100 },
      [
        SheetMetalEngine.createBendModel(
          'B-01', 'FEAT-SM-01', 90.0, 3.0, 2.0, 0.44,
          { x: asM(0), y: asM(50), z: asM(0) }, { x: asM(80), y: asM(50), z: asM(0) }, 1
        )
      ],
      2.0,
      1
    );

    const flatPatternRev2 = SheetMetalEngine.unfoldGeometry(
      { width: 80, length: 100 },
      [
        SheetMetalEngine.createBendModel(
          'B-01', 'FEAT-SM-01', 90.0, 4.0, 2.0, 0.44, // Mutated radius to 4.0
          { x: asM(0), y: asM(50), z: asM(0) }, { x: asM(80), y: asM(50), z: asM(0) }, 2 // Incremented revision
        )
      ],
      2.0,
      2
    );

    expect(flatPatternRev2.geometryRevision).toBe(2);
    expect(flatPatternRev1.overallLength).not.toBe(flatPatternRev2.overallLength);
  });

  // Test F — Fold / Unfold Round Trip
  it('should verify the mathematical reversibility round-trip of fold/unfold', () => {
    const thickness = 2.0;
    const bendRadius = 3.0;
    const kFactor = 0.44;

    const bend = SheetMetalEngine.createBendModel(
      'B-01', 'FEAT-SM-01', 90.0, bendRadius, thickness, kFactor,
      { x: asM(0), y: asM(50), z: asM(0) }, { x: asM(80), y: asM(50), z: asM(0) }, 1
    );

    const flat = SheetMetalEngine.unfoldGeometry({ width: 80, length: 100 }, [bend], thickness, 1);
    const refolded = SheetMetalEngine.foldGeometry(flat, [bend], 1);

    expect(refolded.geometryRevision).toBe(flat.geometryRevision);
    expect(refolded.overallHeight).toBeCloseTo(bendRadius + kFactor * thickness, 4);
  });

  // Test G — Acceptance Gate Audit
  it('should execute Acceptance Gate Audit successfully with PASS verdicts across all truth tests', () => {
    const verdicts = SheetMetalTruthAcceptanceGate.runAudit();
    
    expect(verdicts.length).toBeGreaterThan(0);
    verdicts.forEach(v => {
      expect(v.verdict).toBe('PASS');
    });
  });

  // Test H — Negative Proof Verification
  it('should ensure fake states/mesh flattening are rejected by truth verifiers', () => {
    const dummyDoc: EngineeringDocument = {
      documentId: 'DOC_FAKE',
      revision: 1,
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [],
      constraints: [],
      features: [
        {
          id: 'FEAT_FAKE',
          type: 'SHEET_METAL',
          thickness: 0, // Invalid thickness!
          bendRadius: 0, // Invalid radius!
          kFactor: 0.44
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const reconstructible = SheetMetalVerifier.verifyFlatPatternReconstructibility(dummyDoc, 'FEAT_FAKE');
    expect(reconstructible).toBe(false); // Should FAIL as expected by Negative cases
  });
});
