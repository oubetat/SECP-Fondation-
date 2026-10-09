/**
 * SECP — PATCH-042 Qualification Battery
 * MOLD & TOOLING TRUTH CLOSURE
 */

import { describe, it, expect } from 'vitest';
import { asM } from '../../../engine/cad-kernel/core/Units';
import { 
  MoldEngine, 
  MoldVerifier,
  MoldSplitDefinition
} from '../../../engine/cad/mold/MoldEngine';
import { MoldTruthAcceptanceGate } from '../../../engine/cad/mold/MoldTruthAcceptanceGate';

describe('PATCH-042 Mold & Tooling Truth Closure Battery', () => {

  // TEST 1 — SIMPLE PARTING
  it('should verify Simple Parting creates canonical geometric representation and pull direction', () => {
    const parting = MoldEngine.createPartingDefinition(
      'PART_01',
      'SRC_BODY_1',
      { x: asM(0), y: asM(0), z: asM(0) },
      { x: asM(0), y: asM(0), z: asM(1) },
      { x: asM(0), y: asM(0), z: asM(1) },
      1
    );

    expect(parting.partingId).toBe('PART_01');
    expect(parting.pullDirection.z).toBe(asM(1));
    expect(parting.partingSurfaceType).toBe('PLANAR');
    expect(parting.partingFaces.length).toBeGreaterThan(0);
  });

  // TEST 2 — CORE / CAVITY
  it('should verify Core and Cavity generate distinct canonical B-Rep identities', () => {
    const parting = MoldEngine.createPartingDefinition(
      'PART_01', 'SRC_BODY_1', { x: asM(0), y: asM(0), z: asM(0) }, { x: asM(0), y: asM(0), z: asM(1) }, { x: asM(0), y: asM(0), z: asM(1) }, 1
    );

    const split = MoldEngine.performMoldSplit('SPLIT_01', parting, 500, 2000, 1);

    expect(split.core.coreBodyIdentity).not.toBe(split.cavity.cavityBodyIdentity);
    expect(split.core.volumeMm3).toBeGreaterThan(0);
    expect(split.cavity.volumeMm3).toBeGreaterThan(0);
  });

  // TEST 3 — REAL SPLIT
  it('should prove Split results in verified canonical geometry volumes matching conservation of volume', () => {
    const partVolume = 500;
    const moldBlockVolume = 2000;
    const parting = MoldEngine.createPartingDefinition(
      'PART_01', 'SRC_BODY_1', { x: asM(0), y: asM(0), z: asM(0) }, { x: asM(0), y: asM(0), z: asM(1) }, { x: asM(0), y: asM(0), z: asM(1) }, 1
    );
    const split = MoldEngine.performMoldSplit('SPLIT_01', parting, partVolume, moldBlockVolume, 1);

    const isSplitValid = MoldVerifier.verifySplitGeometry(split);
    expect(isSplitValid).toBe(true);

    const sumToolingVolumes = split.core.volumeMm3 + split.cavity.volumeMm3 + partVolume;
    expect(sumToolingVolumes).toBeCloseTo(moldBlockVolume, 5); // 0.4*2000 + 0.6*2000-500 + 500 = 800 + 700 + 500 = 2000
  });

  // TEST 4 — PULL DIRECTION CHANGE / DRAFT ANALYSIS
  it('should detect undercuts when face normals conflict with pull direction draft requirements', () => {
    const parting = MoldEngine.createPartingDefinition(
      'PART_01', 'SRC_BODY_1', { x: asM(0), y: asM(0), z: asM(0) }, { x: asM(0), y: asM(0), z: asM(1) }, { x: asM(0), y: asM(0), z: asM(1) }, 1
    );

    // Draft angle requirement of 2 degrees
    const moldable = MoldEngine.verifyDraftMoldability(parting, [
      { x: asM(0), y: asM(0.998), z: asM(0.05) } // Sufficient draft > 2 degrees (sin(2.86deg)=0.05)
    ], 2.0);
    expect(moldable).toBe(true);

    const notMoldable = MoldEngine.verifyDraftMoldability(parting, [
      { x: asM(0), y: asM(1), z: asM(0) } // Exactly 0 draft -> Undercut
    ], 2.0);
    expect(notMoldable).toBe(false);
  });

  // TEST 5 — INSERT
  it('should verify Insert physical connection to a host region', () => {
    const insert = MoldEngine.createInsert('IN_01', 'HOST_CAVITY_1', { x: asM(10), y: asM(10), z: asM(10) }, 1);
    
    expect(insert.hostRegionBodyId).toBe('HOST_CAVITY_1');
    expect(insert.insertBodyIdentity).toBeTruthy();
    expect(MoldVerifier.verifyInsert(insert)).toBe(true);
  });

  // TEST 6 — SLIDER
  it('should verify Slider possesses actual direction and stroke motion linked to undercut', () => {
    const slider = MoldEngine.createSlider('SLD_01', 'UNDERCUT_REGION', { x: asM(1), y: asM(0), z: asM(0) }, 25, 1);
    
    expect(slider.sliderAxis.x).toBe(1);
    expect(slider.motionLimits.extended).toBe(25);
    expect(slider.undercutRegionReference).toBe('UNDERCUT_REGION');
  });

  // TEST 7 — SLIDER MOVEMENT
  it('should verify Slider motion physically clears the required undercut depth', () => {
    const slider = MoldEngine.createSlider('SLD_01', 'UNDERCUT_REGION', { x: asM(1), y: asM(0), z: asM(0) }, 50, 1);
    
    // Undercut depth is 30mm. Slider retracts 50mm. Should pass.
    expect(MoldEngine.verifySliderMotion(slider, 30)).toBe(true);

    // Undercut depth is 60mm. Slider retracts 50mm. Should fail.
    expect(MoldEngine.verifySliderMotion(slider, 60)).toBe(false);
  });

  // TEST 8 — SOURCE MODIFICATION
  it('should trigger geometry revision invalidation across mold lineages when source mutates', () => {
    const parting = MoldEngine.createPartingDefinition(
      'PART_01', 'SRC_BODY_1', { x: asM(0), y: asM(0), z: asM(0) }, { x: asM(0), y: asM(0), z: asM(1) }, { x: asM(0), y: asM(0), z: asM(1) }, 1
    );

    const splitRev1 = MoldEngine.performMoldSplit('SPLIT_01', parting, 500, 2000, 1);
    
    // Mutation happens -> revision bumps to 2
    const splitRev2 = MoldEngine.performMoldSplit('SPLIT_01', parting, 520, 2000, 2);

    expect(splitRev1.geometryRevision).toBe(1);
    expect(splitRev2.geometryRevision).toBe(2);
    expect(splitRev1.core.volumeMm3).toBe(splitRev2.core.volumeMm3); // Core is proportional to block
    expect(splitRev1.cavity.volumeMm3).not.toBe(splitRev2.cavity.volumeMm3); // Cavity absorbs the part volume change
  });

  // TEST 9 & 10 — ACCEPTANCE GATE & NEGATIVE PROOFS
  it('should run Acceptance Gate Audit and yield PASS verdicts exclusively (no fake IDs / mesh-only toolings)', () => {
    const verdicts = MoldTruthAcceptanceGate.runAudit();
    
    expect(verdicts.length).toBeGreaterThan(0);
    verdicts.forEach(v => {
      expect(v.verdict).toBe('PASS');
    });
  });

  // Negative Proof check
  it('should FAIL invalid split geometries lacking core or cavity identities', () => {
    const fakeSplit: MoldSplitDefinition = {
      splitId: 'FAKE',
      sourcePartId: 'FAKE',
      parting: MoldEngine.createPartingDefinition('P1', 'S1', {x:asM(0),y:asM(0),z:asM(0)}, {x:asM(0),y:asM(0),z:asM(1)}, {x:asM(0),y:asM(0),z:asM(1)}, 1),
      core: { coreId: 'C1', sourceBodyId: 'S1', partingId: 'P1', pullDirection: {x:asM(0),y:asM(0),z:asM(1)}, coreBodyIdentity: '', volumeMm3: 0, geometryRevision: 1, topologyLineage: [] }, // FAKE
      cavity: { cavityId: 'C2', sourceBodyId: 'S1', partingId: 'P1', pullDirection: {x:asM(0),y:asM(0),z:asM(-1)}, cavityBodyIdentity: '', volumeMm3: 0, geometryRevision: 1, topologyLineage: [] }, // FAKE
      moldBlockVolume: 0,
      geometryRevision: 1
    };

    expect(MoldVerifier.verifySplitGeometry(fakeSplit)).toBe(false);
  });
});
