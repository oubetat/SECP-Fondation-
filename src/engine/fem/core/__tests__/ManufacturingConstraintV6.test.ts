import { describe, it, expect } from 'vitest';
import { FEMModel, FEMNode, FEMElement, FEMMaterial, FEMSection, DOFComponent } from '../FEMTypes';
import { FEMCore } from '../FEMCore';
import { SpatialMaterialField } from '../SpatialMaterialField';
import { ManufacturingConstraintEngine, ManufacturingConstraintProfile } from '../ManufacturingConstraintEngine';
import { FEMEvidenceEngine } from '../FEMEvidenceEngine';

describe('SECP-PROGRAMMABLE-MATERIAL-V6-001: Manufacturing Constraints Integration & Qualification', () => {

  // Helper to create a standard manufacturing profile
  function createSyntheticProfile(overrides: Partial<ManufacturingConstraintProfile> = {}): ManufacturingConstraintProfile {
    return {
      profileId: 'PROF_SLM_500',
      profileVersion: 'REV_2026_1',
      processType: 'ADDITIVE_PBF',
      unitSystem: 'SI_MM_MPA',
      syntheticProfile: true,
      minWallThickness: 0.5, // mm
      minFeatureSize: 0.8, // mm
      maxSpatialGradient: 1000.0, // MPa/mm
      processResolution: 0.1, // mm
      buildDirection: { x: 0, y: 0, z: 1 },
      minOverhangAngle: 45, // degrees
      materialCompatibility: ['MAT1', 'MAT_TITANIUM', 'MAT_STEEL'],
      qualificationStatus: 'SYNTHETIC_TEST_PROFILE',
      ...overrides
    };
  }

  // Helper to create a 1D Bar model
  function createBarModel(length = 100, area = 10, E_base = 200000): FEMModel {
    const nodes = new Map<string, FEMNode>([
      ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
      ['N2', { nodeId: 'N2', x: length, y: 0, z: 0 }]
    ]);

    const elements = new Map<string, FEMElement>([
      ['E1', {
        elementId: 'E1',
        formulationId: 'BAR_1D',
        nodeIds: ['N1', 'N2'],
        materialId: 'MAT1',
        sectionId: 'SEC1'
      }]
    ]);

    const materials = new Map<string, FEMMaterial>([
      ['MAT1', { materialId: 'MAT1', name: 'Steel', E: E_base, nu: 0.3 }]
    ]);

    const sections = new Map<string, FEMSection>([
      ['SEC1', { sectionId: 'SEC1', name: 'BarSection', area }]
    ]);

    return {
      nodes,
      elements,
      materials,
      sections,
      boundaryConditions: [
        { id: 'BC1', nodeId: 'N1', dof: DOFComponent.UX, value: 0 }
      ],
      loads: [
        { id: 'L1', nodeId: 'N2', dof: DOFComponent.UX, value: 1000 }
      ]
    };
  }

  // Helper to create SpatialMaterialField
  function createScalarField(
    fieldId: string,
    baseMaterialId: string,
    propertyName: 'E' | 'nu',
    expression: (coords: { x: number; y: number; z: number }) => number
  ): SpatialMaterialField {
    return new SpatialMaterialField(
      fieldId,
      'GEO_CANONICAL',
      'REV_001',
      baseMaterialId,
      new Map([
        [
          propertyName,
          {
            propertyName,
            evaluationType: 'ANALYTIC_EXPRESSION',
            expression,
            bounds: { lower: 0.001, upper: 10000000 },
            valueCategory: 'TARGET',
            unit: propertyName === 'E' ? 'MPa' : 'dimensionless'
          }
        ]
      ])
    );
  }

  // =========================================================================
  // SECTION 1: FUNCTIONAL & QUALIFICATION BENCHMARKS
  // =========================================================================

  describe('1. Functional & Manufacturability Benchmarks', () => {

    it('Benchmark 1: Fully Manufacturable Design under Synthetic Profile', () => {
      const model = createBarModel(100, 25, 200000); // length 100 mm, thickness sqrt(25)=5 mm
      const profile = createSyntheticProfile({
        minFeatureSize: 1.0,
        minWallThickness: 1.0,
        maxSpatialGradient: 2000.0
      });
      model.manufacturingProfile = profile;

      const result = ManufacturingConstraintEngine.evaluateManufacturability(model, profile);

      expect(result.ok).toBe(true);
      expect(result.status).toBe('PASS');
      expect(result.qualificationLevel).toBe('SYNTHETIC_TEST_EVALUATED');
      expect(result.summary.totalViolations).toBe(0);
      expect(result.profileHash).toBeDefined();
    });

    it('Benchmark 2: Detects Minimum Feature Size Violation', () => {
      const model = createBarModel(0.4, 25, 200000); // Bar length 0.4 mm < minFeatureSize 0.8 mm
      const profile = createSyntheticProfile({ minFeatureSize: 0.8 });

      const result = ManufacturingConstraintEngine.evaluateManufacturability(model, profile);

      expect(result.ok).toBe(false);
      expect(result.status).toBe('FAIL');
      expect(result.summary.totalViolations).toBeGreaterThan(0);

      const finding = result.findings.find(f => f.ruleId === 'RULE_MIN_FEATURE_SIZE');
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('VIOLATION');
      expect(finding?.measuredValue).toBeCloseTo(0.4, 2);
      expect(finding?.allowableLimit).toBe(0.8);
    });

    it('Benchmark 3: Detects Minimum Wall Thickness Violation', () => {
      const model = createBarModel(100, 0.04, 200000); // area = 0.04 -> sqrt(0.04) = 0.2 mm < minWallThickness 0.5 mm
      const profile = createSyntheticProfile({ minWallThickness: 0.5 });

      const result = ManufacturingConstraintEngine.evaluateManufacturability(model, profile);

      expect(result.ok).toBe(false);
      expect(result.status).toBe('FAIL');

      const finding = result.findings.find(f => f.ruleId === 'RULE_MIN_WALL_THICKNESS');
      expect(finding).toBeDefined();
      expect(finding?.measuredValue).toBeCloseTo(0.2, 2);
      expect(finding?.allowableLimit).toBe(0.5);
    });

    it('Benchmark 4: Detects Spatial Property Gradient Exceedance (|grad E| > maxGradient)', () => {
      // 2 adjacent bar elements from x=0..10 and x=10..20
      const nodes = new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 10, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 20, y: 0, z: 0 }]
      ]);

      const elements = new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', formulationId: 'BAR_1D', nodeIds: ['N1', 'N2'], materialId: 'MAT1', sectionId: 'SEC1', spatialFieldId: 'F_STEEP' }],
        ['E2', { elementId: 'E2', formulationId: 'BAR_1D', nodeIds: ['N2', 'N3'], materialId: 'MAT1', sectionId: 'SEC1', spatialFieldId: 'F_STEEP' }]
      ]);

      // Steep gradient: E(x) = 100000 + 5000 * x -> |grad E| = 5000 MPa/mm
      const field = createScalarField('F_STEEP', 'MAT1', 'E', (c) => 100000 + 5000 * c.x);

      const model: FEMModel = {
        nodes,
        elements,
        materials: new Map([['MAT1', { materialId: 'MAT1', name: 'Steel', E: 100000, nu: 0.3 }]]),
        sections: new Map([['SEC1', { sectionId: 'SEC1', name: 'Sec', area: 10 }]]),
        spatialMaterialFields: new Map([['F_STEEP', field]]),
        boundaryConditions: [{ id: 'BC1', nodeId: 'N1', dof: DOFComponent.UX, value: 0 }],
        loads: [{ id: 'L1', nodeId: 'N3', dof: DOFComponent.UX, value: 1000 }]
      };

      // Profile maxSpatialGradient = 1000 MPa/mm < 5000 MPa/mm
      const profile = createSyntheticProfile({ maxSpatialGradient: 1000.0 });
      model.manufacturingProfile = profile;

      const result = ManufacturingConstraintEngine.evaluateManufacturability(model, profile);

      expect(result.ok).toBe(false);
      expect(result.status).toBe('FAIL');

      const finding = result.findings.find(f => f.ruleId === 'RULE_MAX_SPATIAL_GRADIENT');
      expect(finding).toBeDefined();
      expect(finding?.measuredValue).toBeCloseTo(5000.0, 1);
      expect(finding?.allowableLimit).toBe(1000.0);
    });

    it('Benchmark 5: Detects Material-Process Incompatibility', () => {
      const model = createBarModel(100, 10, 200000);
      model.elements.get('E1')!.materialId = 'MAT_UNSUPPORTED_WOOD';
      model.materials.set('MAT_UNSUPPORTED_WOOD', { materialId: 'MAT_UNSUPPORTED_WOOD', E: 10000, nu: 0.3 });

      const profile = createSyntheticProfile({
        materialCompatibility: ['MAT1', 'MAT_STEEL', 'MAT_TITANIUM']
      });

      const result = ManufacturingConstraintEngine.evaluateManufacturability(model, profile);

      expect(result.ok).toBe(false);
      const finding = result.findings.find(f => f.ruleId === 'RULE_MATERIAL_COMPATIBILITY');
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('VIOLATION');
      expect(finding?.message).toContain('[MATERIAL_PROCESS_INCOMPATIBLE]');
    });

    it('Benchmark 6: Invalidation of Evidence when Manufacturing Profile is Modified', () => {
      const model = createBarModel(100, 10, 200000);
      const profile1 = createSyntheticProfile({ minWallThickness: 0.5 });
      model.manufacturingProfile = profile1;

      const fem = new FEMCore();
      const solveRes = fem.solve(model);

      const evidence = FEMEvidenceEngine.generateEvidence(model, solveRes);
      expect(evidence.manufacturingProfileHash).toBeDefined();
      expect(evidence.manufacturingProfileHash).not.toBe('NONE');

      // Initial check is fresh
      expect(FEMEvidenceEngine.isEvidenceStale(evidence, model).isStale).toBe(false);

      // Modify manufacturing profile limits in updated model
      const profile2 = createSyntheticProfile({ minWallThickness: 2.0 });
      const updatedModel: FEMModel = {
        ...model,
        manufacturingProfile: profile2
      };

      const staleness = FEMEvidenceEngine.isEvidenceStale(evidence, updatedModel);
      expect(staleness.isStale).toBe(true);
      expect(staleness.reason).toContain('Manufacturing constraint profile modified');
    });

  });

  // =========================================================================
  // SECTION 2: ADVERSARIAL TEST BATTERY (V6-ADV-001 to V6-ADV-012)
  // =========================================================================

  describe('2. Adversarial Test Battery (V6-ADV-001 to V6-ADV-012)', () => {

    it('V6-ADV-001: Rejects empty or whitespace profile ID during profile validation', () => {
      const profile = createSyntheticProfile({ profileId: '' });
      expect(() => ManufacturingConstraintEngine.validateProfile(profile)).toThrow(/\[INVALID_PROFILE\]/);
    });

    it('V6-ADV-002: Rejects non-positive minWallThickness or minFeatureSize', () => {
      const p1 = createSyntheticProfile({ minWallThickness: -0.5 });
      expect(() => ManufacturingConstraintEngine.validateProfile(p1)).toThrow(/\[INVALID_PROFILE_VALUE\]/);

      const p2 = createSyntheticProfile({ minFeatureSize: 0 });
      expect(() => ManufacturingConstraintEngine.validateProfile(p2)).toThrow(/\[INVALID_PROFILE_VALUE\]/);
    });

    it('V6-ADV-003: Rejects non-positive maxSpatialGradient', () => {
      const p = createSyntheticProfile({ maxSpatialGradient: -100 });
      expect(() => ManufacturingConstraintEngine.validateProfile(p)).toThrow(/\[INVALID_PROFILE_VALUE\]/);
    });

    it('V6-ADV-004: Rejects empty material compatibility list', () => {
      const p = createSyntheticProfile({ materialCompatibility: [] });
      expect(() => ManufacturingConstraintEngine.validateProfile(p)).toThrow(/\[INVALID_PROFILE\]/);
    });

    it('V6-ADV-005: Rejects synthetic profile attempting non-synthetic qualified claim', () => {
      const p = createSyntheticProfile({
        syntheticProfile: false,
        qualificationStatus: 'SYNTHETIC_TEST_PROFILE'
      });
      expect(() => ManufacturingConstraintEngine.validateProfile(p)).toThrow(/\[INVALID_PROFILE_DECLARATION\]/);
    });

    it('V6-ADV-006: Rejects unnormalized build direction vector', () => {
      const p = createSyntheticProfile({
        buildDirection: { x: 5, y: 0, z: 0 } // Magnitude = 5 != 1.0
      });
      expect(() => ManufacturingConstraintEngine.validateProfile(p)).toThrow(/\[INVALID_BUILD_DIRECTION\]/);
    });

    it('V6-ADV-007: Audits non-synthetic machine qualified profile requiring machine ID', () => {
      const p = createSyntheticProfile({
        syntheticProfile: false,
        qualificationStatus: 'MACHINE_PROFILE_QUALIFIED',
        qualifiedMachineId: undefined // Missing mandatory machine ID
      });
      expect(() => ManufacturingConstraintEngine.validateProfile(p)).toThrow(/\[INVALID_PROFILE_DECLARATION\]/);
    });

    it('V6-ADV-008: Correctly validates machine qualified profile when machine ID is provided', () => {
      const p = createSyntheticProfile({
        syntheticProfile: false,
        qualificationStatus: 'MACHINE_PROFILE_QUALIFIED',
        qualifiedMachineId: 'EOS_M290_001'
      });
      expect(() => ManufacturingConstraintEngine.validateProfile(p)).not.toThrow();
    });

    it('V6-ADV-009: Computes deterministic profile hash for identical definitions', () => {
      const p1 = createSyntheticProfile();
      const p2 = createSyntheticProfile();

      const h1 = ManufacturingConstraintEngine.computeProfileHash(p1);
      const h2 = ManufacturingConstraintEngine.computeProfileHash(p2);

      expect(h1).toBe(h2);
      expect(h1.length).toBe(64); // SHA-256 hex string
    });

    it('V6-ADV-010: Profile hash changes when any manufacturing limit is modified', () => {
      const p1 = createSyntheticProfile({ maxSpatialGradient: 1000.0 });
      const p2 = createSyntheticProfile({ maxSpatialGradient: 1000.1 });

      const h1 = ManufacturingConstraintEngine.computeProfileHash(p1);
      const h2 = ManufacturingConstraintEngine.computeProfileHash(p2);

      expect(h1).not.toBe(h2);
    });

    it('V6-ADV-011: Evaluates manufacturability for 3D TET4 continuum mesh', () => {
      const nodes = new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 10, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 0, y: 10, z: 0 }],
        ['N4', { nodeId: 'N4', x: 0, y: 0, z: 10 }]
      ]);

      const elements = new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', formulationId: 'TET4_3D', nodeIds: ['N1', 'N2', 'N3', 'N4'], materialId: 'MAT1', sectionId: 'SEC1' }]
      ]);

      const model: FEMModel = {
        nodes,
        elements,
        materials: new Map([['MAT1', { materialId: 'MAT1', name: 'Steel', E: 200000, nu: 0.3 }]]),
        sections: new Map(),
        loads: [],
        boundaryConditions: []
      };

      const profile = createSyntheticProfile({ minFeatureSize: 0.5 });
      const result = ManufacturingConstraintEngine.evaluateManufacturability(model, profile);

      expect(result.ok).toBe(true);
      expect(result.status).toBe('PASS');
    });

    it('V6-ADV-012: End-to-end integration: FEM Solve + Manufacturability Audit + Evidence Generation', () => {
      const model = createBarModel(100, 10, 200000);
      const profile = createSyntheticProfile();
      model.manufacturingProfile = profile;

      // 1. Manufacturability check
      const mfgResult = ManufacturingConstraintEngine.evaluateManufacturability(model, profile);
      expect(mfgResult.ok).toBe(true);

      // 2. FEM Solve
      const fem = new FEMCore();
      const solveResult = fem.solve(model);

      // 3. Evidence Generation
      const evidence = FEMEvidenceEngine.generateEvidence(model, solveResult);
      expect(evidence.modelHash).toBeDefined();
      expect(evidence.manufacturingProfileHash).toBeDefined();
      expect(evidence.manufacturingProfileHash).not.toBe('NONE');

      // 4. Verification of freshness
      const staleness = FEMEvidenceEngine.isEvidenceStale(evidence, model, solveResult);
      expect(staleness.isStale).toBe(false);
    });

  });

});
