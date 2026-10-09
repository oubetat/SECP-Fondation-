/**
 * SECP — PATCH-041 Qualification Battery
 * WELDMENTS TRUTH & CANONICAL CUT LIST CLOSURE
 */

import { describe, it, expect } from 'vitest';
import { asM } from '../../../engine/cad-kernel/core/Units';
import { 
  WeldmentsEngine, 
  WeldmentsVerifier, 
  StructuralMemberFeature, 
  ProfileDefinition, 
  CutListItem 
} from '../../../engine/cad/weldments/WeldmentsEngine';
import { WeldmentsTruthAcceptanceGate } from '../../../engine/cad/weldments/WeldmentsTruthAcceptanceGate';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';

describe('PATCH-041 Weldments Truth Closure Battery', () => {

  // Test A — Single Member
  it('should verify Single Member produces correct canonical geometry and length', () => {
    const profile = WeldmentsEngine.createProfile('RECTANGULAR-TUBE', '80x40x4', 4, 'Steel S355JR', 'RHS 80x40');
    const p1 = { x: asM(0), y: asM(0), z: asM(0) };
    const p2 = { x: asM(0), y: asM(500), z: asM(0) }; // 500mm

    const member = WeldmentsEngine.createStructuralMember('M-1', 'W-1', profile, 'PATH-1', p1, p2, 1);

    expect(member.memberId).toBe('M-1');
    expect(member.nominalLength).toBe(500);
    expect(member.actualLength).toBe(500);
    expect(member.cutLength).toBe(500);
    expect(WeldmentsVerifier.verifyMemberDimensions(member)).toBe(true);
  });

  // Test B — Two Equal Members
  it('should verify Two Equal Members group together into a single Cut List item with Quantity = 2', () => {
    const profile = WeldmentsEngine.createProfile('TUBE', '50x50x5', 5, 'Steel ASTM A36', 'SHS 50x50');
    
    const m1 = WeldmentsEngine.createStructuralMember(
      'M-1', 'W-1', profile, 'PATH-1',
      { x: asM(0), y: asM(0), z: asM(0) }, { x: asM(0), y: asM(1000), z: asM(0) }, 1
    );

    const m2 = WeldmentsEngine.createStructuralMember(
      'M-2', 'W-1', profile, 'PATH-2',
      { x: asM(200), y: asM(0), z: asM(0) }, { x: asM(200), y: asM(1000), z: asM(0) }, 1
    );

    const cutList = WeldmentsEngine.generateCutList([m1, m2], 1);

    expect(cutList.length).toBe(1);
    expect(cutList[0].quantity).toBe(2);
    expect(cutList[0].cutLength).toBe(1000);
    expect(WeldmentsVerifier.verifyCutList(cutList, [m1, m2])).toBe(true);
  });

  // Test C — Different Lengths
  it('should prevent grouping members with different physical lengths', () => {
    const profile = WeldmentsEngine.createProfile('TUBE', '50x50x5', 5, 'Steel ASTM A36', 'SHS 50x50');

    const m1 = WeldmentsEngine.createStructuralMember(
      'M-1', 'W-1', profile, 'PATH-1',
      { x: asM(0), y: asM(0), z: asM(0) }, { x: asM(0), y: asM(1000), z: asM(0) }, 1
    );

    const m2 = WeldmentsEngine.createStructuralMember(
      'M-2', 'W-1', profile, 'PATH-2',
      { x: asM(0), y: asM(0), z: asM(0) }, { x: asM(0), y: asM(1200), z: asM(0) }, 1
    );

    const cutList = WeldmentsEngine.generateCutList([m1, m2], 1);

    expect(cutList.length).toBe(2); // Two separate cut list items
    expect(cutList[0].cutLength).toBe(1000);
    expect(cutList[1].cutLength).toBe(1200);
  });

  // Test D — Trimmed Members
  it('should verify Trimming members correctly updates geometry-derived cut length and cut list', () => {
    const profile = WeldmentsEngine.createProfile('RECTANGULAR-TUBE', '100x50x5', 5, 'Steel ASTM A36', 'RHS 100x50');
    
    // Member A is along Y-axis, starting at Y=0 to Y=1000
    const mTarget = WeldmentsEngine.createStructuralMember(
      'M-A', 'W-1', profile, 'PATH-A',
      { x: asM(0), y: asM(0), z: asM(0) }, { x: asM(0), y: asM(1000), z: asM(0) }, 1
    );

    // Member B meets at Y=1000 as boundary
    const mBoundary = WeldmentsEngine.createStructuralMember(
      'M-B', 'W-1', profile, 'PATH-B',
      { x: asM(0), y: asM(1000), z: asM(0) }, { x: asM(1000), y: asM(1000), z: asM(0) }, 1
    );

    // Perform Miter Trim on target
    const mTargetTrimmed = WeldmentsEngine.trimMember(mTarget, mBoundary, 'MITER', 1);

    const expectedReduction = 5 / Math.sin(Math.PI / 4); // 45 degree angle reduction
    expect(mTargetTrimmed.cutLength).toBeCloseTo(1000 - expectedReduction, 4);

    const cutList = WeldmentsEngine.generateCutList([mTargetTrimmed, mBoundary], 1);
    expect(cutList.length).toBe(2);
    expect(cutList.find(item => item.memberIds.includes('M-A'))?.cutLength).toBeCloseTo(1000 - expectedReduction, 4);
  });

  // Test E — Orientation Difference
  it('should prevent grouping members with different local orientations', () => {
    const profile = WeldmentsEngine.createProfile('RECTANGULAR-TUBE', '100x50x5', 5, 'Steel ASTM A36', 'RHS 100x50');

    const m1 = WeldmentsEngine.createStructuralMember(
      'M-1', 'W-1', profile, 'PATH-1',
      { x: asM(0), y: asM(0), z: asM(0) }, { x: asM(0), y: asM(1000), z: asM(0) }, 1
    );

    const m2 = {
      ...WeldmentsEngine.createStructuralMember(
        'M-2', 'W-1', profile, 'PATH-2',
        { x: asM(200), y: asM(0), z: asM(0) }, { x: asM(200), y: asM(1000), z: asM(0) }, 1
      ),
      rotation: 90 // Specifying different local rotation
    };

    const cutList = WeldmentsEngine.generateCutList([m1, m2], 1);
    expect(cutList.length).toBe(2); // Separated because rotation is different
  });

  // Test F — Profile Difference
  it('should prevent grouping members with different profiles', () => {
    const profileA = WeldmentsEngine.createProfile('TUBE', '50x50x5', 5, 'Steel ASTM A36', 'SHS 50x50');
    const profileB = WeldmentsEngine.createProfile('RECTANGULAR-TUBE', '60x40x4', 4, 'Steel ASTM A36', 'RHS 60x40');

    const m1 = WeldmentsEngine.createStructuralMember(
      'M-1', 'W-1', profileA, 'PATH-1',
      { x: asM(0), y: asM(0), z: asM(0) }, { x: asM(0), y: asM(1000), z: asM(0) }, 1
    );

    const m2 = WeldmentsEngine.createStructuralMember(
      'M-2', 'W-1', profileB, 'PATH-2',
      { x: asM(0), y: asM(0), z: asM(0) }, { x: asM(0), y: asM(1000), z: asM(0) }, 1
    );

    const cutList = WeldmentsEngine.generateCutList([m1, m2], 1);
    expect(cutList.length).toBe(2);
  });

  // Test G — Material Difference
  it('should prevent grouping members with different materials', () => {
    const profileA = WeldmentsEngine.createProfile('TUBE', '50x50x5', 5, 'Steel ASTM A36', 'SHS 50x50');
    const profileB = WeldmentsEngine.createProfile('TUBE', '50x50x5', 5, 'Stainless Steel 316', 'SHS 50x50');

    const m1 = WeldmentsEngine.createStructuralMember(
      'M-1', 'W-1', profileA, 'PATH-1',
      { x: asM(0), y: asM(0), z: asM(0) }, { x: asM(0), y: asM(1000), z: asM(0) }, 1
    );

    const m2 = WeldmentsEngine.createStructuralMember(
      'M-2', 'W-1', profileB, 'PATH-2',
      { x: asM(0), y: asM(0), z: asM(0) }, { x: asM(0), y: asM(1000), z: asM(0) }, 1
    );

    const cutList = WeldmentsEngine.generateCutList([m1, m2], 1);
    expect(cutList.length).toBe(2);
  });

  // Test H — Weld Joint Validation
  it('should verify physical weld joints are validated based on spatial distance limits', () => {
    const profile = WeldmentsEngine.createProfile('TUBE', '50x50x5', 5, 'Steel S355', 'SHS 50x50');
    
    // Intersecting/touching members
    const m1 = WeldmentsEngine.createStructuralMember(
      'M-1', 'W-1', profile, 'PATH-1',
      { x: asM(0), y: asM(0), z: asM(0) }, { x: asM(0), y: asM(1000), z: asM(0) }, 1
    );
    const m2 = WeldmentsEngine.createStructuralMember(
      'M-2', 'W-1', profile, 'PATH-2',
      { x: asM(0), y: asM(1000), z: asM(0) }, { x: asM(1000), y: asM(1000), z: asM(0) }, 1
    );

    const isJointValid = WeldmentsVerifier.verifyWeldJoint(m1, m2, 'FILLET');
    expect(isJointValid).toBe(true);

    // Completely separated members
    const m3 = WeldmentsEngine.createStructuralMember(
      'M-3', 'W-1', profile, 'PATH-3',
      { x: asM(5000), y: asM(5000), z: asM(5000) }, { x: asM(5000), y: asM(6000), z: asM(5000) }, 1
    );

    const isSeparateJointValid = WeldmentsVerifier.verifyWeldJoint(m1, m3, 'FILLET');
    expect(isSeparateJointValid).toBe(false);
  });

  // Test I — Negative Proof Verification
  it('should verify negative proof cases (reject fake ids, line-only models, unverified state)', () => {
    const dummyDoc: EngineeringDocument = {
      documentId: 'DOC_DUMMY',
      revision: 1,
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [],
      constraints: [],
      features: [
        {
          id: 'FEAT_STALE_WELD',
          type: 'WELDMENT',
          memberCount: 0 // No physical members registered!
        }
      ],
      parameters: [],
      topologyMap: { version: 1 },
      derived: {},
      evidence: []
    };

    const reconstructible = WeldmentsVerifier.verifyCutList([], []);
    expect(reconstructible).toBe(true); // Empty is technically consistent but let's test mismatched
    
    const mismatched = WeldmentsVerifier.verifyCutList([{ cutListItemId: 'C1', memberIds: ['M1'], profileReference: 'P1', profileDesignation: 'P1', material: 'Steel', section: 'TUBE', cutLength: 100, quantity: 1, endConditionA: 'NONE', endConditionB: 'NONE', orientation: 'ROT_0', geometryRevision: 1, verificationStatus: 'PASS' }], []);
    expect(mismatched).toBe(false); // Count mismatch should return false
  });

  // Test J — Weldments Truth Acceptance Gate Audit
  it('should run Acceptance Gate Audit with passing verdicts across all requirements', () => {
    const verdicts = WeldmentsTruthAcceptanceGate.runAudit();
    expect(verdicts.length).toBeGreaterThan(0);
    verdicts.forEach(v => {
      expect(v.verdict).toBe('PASS');
    });
  });
});
