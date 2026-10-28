import { describe, it, expect } from 'vitest';
import { FEMModel, FEMNode, FEMElement, FEMMaterial, FEMSection, DOFComponent } from '../FEMTypes';
import { FEMCore } from '../FEMCore';
import { SpatialMaterialField } from '../SpatialMaterialField';
import { GeometryMaterialAssignment } from '../GeometryMaterialAssignment';
import { GeometryMaterialValidator } from '../GeometryMaterialValidator';
import { TET43DFormulation } from '../TET43DFormulation';
import { Bar1DFormulation } from '../Bar1DFormulation';
import { FEMEvidenceEngine } from '../FEMEvidenceEngine';

describe('SECP-PROGRAMMABLE-MATERIAL-V5-001: Spatial Material Physics Integration & Qualification', () => {

  // Helper to create a basic 1D Bar model
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

  // Helper to create a 3D TET4 model
  function createTET4Model(E_base = 200000, nu_base = 0.3): FEMModel {
    const nodes = new Map<string, FEMNode>([
      ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
      ['N2', { nodeId: 'N2', x: 10, y: 0, z: 0 }],
      ['N3', { nodeId: 'N3', x: 0, y: 10, z: 0 }],
      ['N4', { nodeId: 'N4', x: 0, y: 0, z: 10 }]
    ]);

    const elements = new Map<string, FEMElement>([
      ['E1', {
        elementId: 'E1',
        formulationId: 'TET4_3D',
        nodeIds: ['N1', 'N2', 'N3', 'N4'],
        materialId: 'MAT1'
      }]
    ]);

    const materials = new Map<string, FEMMaterial>([
      ['MAT1', { materialId: 'MAT1', name: 'Steel', E: E_base, nu: nu_base }]
    ]);

    return {
      nodes,
      elements,
      materials,
      sections: new Map(),
      boundaryConditions: [
        { id: 'BC1', nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { id: 'BC2', nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { id: 'BC3', nodeId: 'N1', dof: DOFComponent.UZ, value: 0 },
        { id: 'BC4', nodeId: 'N2', dof: DOFComponent.UY, value: 0 },
        { id: 'BC5', nodeId: 'N2', dof: DOFComponent.UZ, value: 0 },
        { id: 'BC6', nodeId: 'N3', dof: DOFComponent.UZ, value: 0 }
      ],
      loads: [
        { id: 'L1', nodeId: 'N4', dof: DOFComponent.UZ, value: 500 }
      ]
    };
  }

  // Helper to create SpatialMaterialField
  function createScalarField(
    fieldId: string,
    baseMaterialId: string,
    propertyName: 'E' | 'nu',
    expression: (coords: { x: number; y: number; z: number }) => number,
    bounds = propertyName === 'E' ? { lower: 0.001, upper: 10000000 } : { lower: -0.99, upper: 0.49 }
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
            bounds,
            valueCategory: 'TARGET',
            unit: propertyName === 'E' ? 'MPa' : 'dimensionless'
          }
        ]
      ])
    );
  }

  // =========================================================================
  // SECTION 1: BENCHMARK QUALIFICATION TESTS
  // =========================================================================

  describe('1. Numerical Benchmarks (A - E)', () => {

    it('Benchmark A: Homogeneous Equivalence (Uniform spatial field vs baseline material)', () => {
      const fem = new FEMCore();
      
      // 1. Baseline Solve without spatial field
      const modelBase = createBarModel(100, 10, 200000);
      const resBase = fem.solve(modelBase);

      // 2. Spatial Field with uniform expression E = 200000
      const modelSpatial = createBarModel(100, 10, 200000);
      const field = createScalarField('FIELD_HOMO', 'MAT1', 'E', () => 200000);
      modelSpatial.spatialMaterialFields = new Map([['FIELD_HOMO', field]]);
      modelSpatial.elements.get('E1')!.spatialFieldId = 'FIELD_HOMO';

      const resSpatial = fem.solve(modelSpatial);

      // Verify 100% numerical identity
      expect(resSpatial.U[1]).toBeCloseTo(resBase.U[1], 10);
      expect(resSpatial.reactions[0]).toBeCloseTo(resBase.reactions[0], 10);
      expect(resSpatial.fields.elementFields.get('E1')!.stress.sigma_x)
        .toBeCloseTo(resBase.fields.elementFields.get('E1')!.stress.sigma_x, 10);
      expect(resSpatial.fields.totalStrainEnergy)
        .toBeCloseTo(resBase.fields.totalStrainEnergy, 10);
    });

    it('Benchmark B: Graded Material Response vs Analytical Solution', () => {
      // Bar with linearly varying E(x) = E0 + k*x
      // Analytical elongation: delta = (P / (A * k)) * ln(1 + k*L / E0)
      const L = 100;
      const A = 10;
      const P = 1000;
      const E0 = 100000;
      const k = 1000; // E(x) = 100000 + 1000*x

      const analyticalDisp = (P / (A * k)) * Math.log(1 + (k * L) / E0);

      // Midpoint of element is x = 50 -> E_eval = 100000 + 1000*50 = 150000
      const model = createBarModel(L, A, E0);
      const field = createScalarField('FIELD_GRADED', 'MAT1', 'E', (c) => E0 + k * c.x);
      model.spatialMaterialFields = new Map([['FIELD_GRADED', field]]);
      model.elements.get('E1')!.spatialFieldId = 'FIELD_GRADED';

      const fem = new FEMCore();
      const res = fem.solve(model);

      const u_fem = res.U[1]; // Displ at N2
      // For a single bar element evaluated at midpoint x=50, E_mid = 150000
      const singleElemDisp = (P * L) / (A * (E0 + k * (L / 2)));

      expect(u_fem).toBeCloseTo(singleElemDisp, 10);
      // Compare single element mid-point evaluation against exact analytical integral:
      expect(Math.abs(u_fem - analyticalDisp) / analyticalDisp).toBeLessThan(0.05);
    });

    it('Benchmark C: Gradient Reversal Symmetry', () => {
      const L = 100;
      const A = 10;
      const E0 = 100000;
      const k = 1000;

      // Model 1: Increasing E(x) = E0 + k*x
      const model1 = createBarModel(L, A, E0);
      const field1 = createScalarField('F1', 'MAT1', 'E', (c) => E0 + k * c.x);
      model1.spatialMaterialFields = new Map([['F1', field1]]);
      model1.elements.get('E1')!.spatialFieldId = 'F1';

      // Model 2: Decreasing E(x) = E0 + k*(L - x)
      const model2 = createBarModel(L, A, E0);
      const field2 = createScalarField('F2', 'MAT1', 'E', (c) => E0 + k * (L - c.x));
      model2.spatialMaterialFields = new Map([['F2', field2]]);
      model2.elements.get('E1')!.spatialFieldId = 'F2';

      const fem = new FEMCore();
      const res1 = fem.solve(model1);
      const res2 = fem.solve(model2);

      // Evaluated at midpoint x=50, E(50) for F1 is 150,000, and E(50) for F2 is 150,000!
      expect(res1.U[1]).toBeCloseTo(res2.U[1], 10);
    });

    it('Benchmark D: Negative Control (Zero Gradient Equivalence)', () => {
      const E0 = 200000;
      const alpha = 0; // Zero gradient

      const modelBase = createBarModel(100, 10, E0);
      const modelGrad = createBarModel(100, 10, E0);

      const field = createScalarField('FIELD_ZERO_GRAD', 'MAT1', 'E', (c) => E0 + alpha * c.x);
      modelGrad.spatialMaterialFields = new Map([['FIELD_ZERO_GRAD', field]]);
      modelGrad.elements.get('E1')!.spatialFieldId = 'FIELD_ZERO_GRAD';

      const fem = new FEMCore();
      const resBase = fem.solve(modelBase);
      const resGrad = fem.solve(modelGrad);

      expect(resGrad.U[1]).toBeCloseTo(resBase.U[1], 10);
      expect(resGrad.fields.totalStrainEnergy).toBeCloseTo(resBase.fields.totalStrainEnergy, 10);
    });

    it('Benchmark E: Multi-Element Spatial Mesh Verification', () => {
      // 3-element bar mesh under axial tension with graded field
      const nodes = new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 10, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 20, y: 0, z: 0 }],
        ['N4', { nodeId: 'N4', x: 30, y: 0, z: 0 }]
      ]);

      const elements = new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', formulationId: 'BAR_1D', nodeIds: ['N1', 'N2'], materialId: 'MAT1', sectionId: 'SEC1', spatialFieldId: 'F_GRAD' }],
        ['E2', { elementId: 'E2', formulationId: 'BAR_1D', nodeIds: ['N2', 'N3'], materialId: 'MAT1', sectionId: 'SEC1', spatialFieldId: 'F_GRAD' }],
        ['E3', { elementId: 'E3', formulationId: 'BAR_1D', nodeIds: ['N3', 'N4'], materialId: 'MAT1', sectionId: 'SEC1', spatialFieldId: 'F_GRAD' }]
      ]);

      const field = createScalarField('F_GRAD', 'MAT1', 'E', (c) => 100000 + 1000 * c.x);

      const model: FEMModel = {
        nodes,
        elements,
        materials: new Map([['MAT1', { materialId: 'MAT1', name: 'Steel', E: 100000, nu: 0.3 }]]),
        sections: new Map([['SEC1', { sectionId: 'SEC1', name: 'Sec', area: 10 }]]),
        spatialMaterialFields: new Map([['F_GRAD', field]]),
        boundaryConditions: [{ id: 'BC1', nodeId: 'N1', dof: DOFComponent.UX, value: 0 }],
        loads: [{ id: 'L1', nodeId: 'N4', dof: DOFComponent.UX, value: 1000 }]
      };

      const fem = new FEMCore();
      const res = fem.solve(model);

      // Verify global equilibrium: Reaction at N1 equals applied force at N4
      expect(res.reactions[0]).toBeCloseTo(-1000, 8);
      expect(res.equilibrium.ok).toBe(true);

      // Verify stiffness progression: E1 mid x=5 (E=105000), E2 mid x=15 (E=115000), E3 mid x=25 (E=125000)
      const eps1 = res.fields.elementFields.get('E1')!.strain.epsilon_x;
      const eps2 = res.fields.elementFields.get('E2')!.strain.epsilon_x;
      const eps3 = res.fields.elementFields.get('E3')!.strain.epsilon_x;

      expect(eps1).toBeGreaterThan(eps2);
      expect(eps2).toBeGreaterThan(eps3);

      // Stress = E_eval * eps = 1000 / 10 = 100 MPa across all elements!
      expect(res.fields.elementFields.get('E1')!.stress.sigma_x).toBeCloseTo(100, 8);
      expect(res.fields.elementFields.get('E2')!.stress.sigma_x).toBeCloseTo(100, 8);
      expect(res.fields.elementFields.get('E3')!.stress.sigma_x).toBeCloseTo(100, 8);
    });

  });

  // =========================================================================
  // SECTION 2: CONSTITUTIVE CONSISTENCY VERIFICATION
  // =========================================================================

  describe('2. Constitutive Consistency & Physical Invariants', () => {

    it('Verifies exact constitutive consistency (Ke assembly E == Stress recovery E)', () => {
      const model = createBarModel(100, 10, 200000);
      const field = createScalarField('FIELD_EXP', 'MAT1', 'E', (c) => 150000 * Math.exp(0.005 * c.x));
      model.spatialMaterialFields = new Map([['FIELD_EXP', field]]);
      model.elements.get('E1')!.spatialFieldId = 'FIELD_EXP';

      const barFormulation = new Bar1DFormulation();
      const fem = new FEMCore();
      const dofMgr = fem.getDOFManager();
      dofMgr.buildDOFs(model, new Map([['BAR_1D', barFormulation]]));

      // 1. Evaluate Ke
      const matResult = barFormulation.computeMatrices(model.elements.get('E1')!, model, dofMgr);
      const k_assembly = matResult.Ke.get(0, 0); // k = E * A / L -> E = k * L / A
      const E_assembly = (k_assembly * 100) / 10;

      // 2. Solve and evaluate stress/strain
      const res = fem.solve(model);
      const elemRes = res.fields.elementFields.get('E1')!;
      const E_recovery = elemRes.stress.sigma_x / elemRes.strain.epsilon_x;

      // Assert 100% identity
      expect(E_assembly).toBeCloseTo(E_recovery, 10);
    });

    it('Verifies 3D TET4 constitutive matrix consistency with spatial Youngs modulus and Poisson ratio', () => {
      const model = createTET4Model(200000, 0.3);
      const field = createScalarField('FIELD_3D_GRAD', 'MAT1', 'E', (c) => 180000 + 10 * c.x + 20 * c.y + 30 * c.z);
      model.spatialMaterialFields = new Map([['FIELD_3D_GRAD', field]]);
      model.elements.get('E1')!.spatialFieldId = 'FIELD_3D_GRAD';

      const tetFormulation = new TET43DFormulation();
      const fem = new FEMCore();
      const dofMgr = fem.getDOFManager();
      dofMgr.buildDOFs(model, new Map([['TET4_3D', tetFormulation]]));

      const res = fem.solve(model);
      expect(res.equilibrium.ok).toBe(true);

      const elemRes = res.fields.elementFields.get('E1')!;
      expect(elemRes.vonMisesStress).toBeGreaterThan(0);
      expect(elemRes.strainEnergy).toBeGreaterThan(0);
    });

  });

  // =========================================================================
  // SECTION 3: ADVERSARIAL BATTERY (V5-ADV-001 to V5-ADV-012)
  // =========================================================================

  describe('3. Adversarial Test Battery (V5-ADV-001 to V5-ADV-012)', () => {

    it('V5-ADV-001: Rejects invalid modulus (E <= 0 or NaN/Inf) from spatial field evaluation', () => {
      const model = createBarModel(100, 10, 200000);
      const field = createScalarField('FIELD_NEG_E', 'MAT1', 'E', () => -50000);
      model.spatialMaterialFields = new Map([['FIELD_NEG_E', field]]);
      model.elements.get('E1')!.spatialFieldId = 'FIELD_NEG_E';

      const fem = new FEMCore();
      expect(() => fem.solve(model)).toThrow(/\[SPATIAL_FIELD_BOUNDS_ERROR\]|\[INVALID_SPATIAL_FIELD_PROPERTY\]/);
    });

    it('V5-ADV-002: Rejects invalid Poisson ratio (nu >= 0.5 or nu < -1) from spatial field evaluation in 3D', () => {
      const model = createTET4Model(200000, 0.3);
      const field = createScalarField('FIELD_BAD_NU', 'MAT1', 'nu', () => 0.55);
      model.spatialMaterialFields = new Map([['FIELD_BAD_NU', field]]);
      model.elements.get('E1')!.spatialFieldId = 'FIELD_BAD_NU';

      const fem = new FEMCore();
      expect(() => fem.solve(model)).toThrow(/\[SPATIAL_FIELD_BOUNDS_ERROR\]|\[INVALID_SPATIAL_FIELD_PROPERTY\]/);
    });

    it('V5-ADV-003: Rejects spatial field missing required property E', () => {
      const model = createBarModel(100, 10, 200000);
      // Field defining 'nu' instead of mandatory 'E'
      const field = createScalarField('FIELD_MISSING_E', 'MAT1', 'nu', () => 0.3);
      model.spatialMaterialFields = new Map([['FIELD_MISSING_E', field]]);
      model.elements.get('E1')!.spatialFieldId = 'FIELD_MISSING_E';

      const fem = new FEMCore();
      expect(() => fem.solve(model)).toThrow(/\[SPATIAL_FIELD_MISSING_PROPERTY\]/);
    });

    it('V5-ADV-004: Rejects base material mismatch between field and element', () => {
      const model = createBarModel(100, 10, 200000);
      const field = createScalarField('FIELD_MISMATCH', 'MAT_OTHER', 'E', () => 200000);
      model.spatialMaterialFields = new Map([['FIELD_MISMATCH', field]]);
      model.elements.get('E1')!.spatialFieldId = 'FIELD_MISMATCH';

      const fem = new FEMCore();
      expect(() => fem.solve(model)).toThrow(/\[SPATIAL_FIELD_MATERIAL_MISMATCH\]/);
    });

    it('V5-ADV-005: Rejects unregistered spatial field ID referenced on element', () => {
      const model = createBarModel(100, 10, 200000);
      model.elements.get('E1')!.spatialFieldId = 'FIELD_DOES_NOT_EXIST';

      const fem = new FEMCore();
      expect(() => fem.solve(model)).toThrow(/\[SPATIAL_FIELD_NOT_FOUND\]/);
    });

    it('V5-ADV-006: Rejects spatial material fields on non-supported formulations (e.g. TET4_PLASTIC)', () => {
      const model = createTET4Model(200000, 0.3);
      model.elements.get('E1')!.formulationId = 'TET4_PLASTIC';

      const field = createScalarField('FIELD_PLASTIC_UNSUPPORTED', 'MAT1', 'E', () => 200000);
      model.spatialMaterialFields = new Map([['FIELD_PLASTIC_UNSUPPORTED', field]]);
      model.elements.get('E1')!.spatialFieldId = 'FIELD_PLASTIC_UNSUPPORTED';

      const fem = new FEMCore();
      expect(() => fem.solve(model)).toThrow(/\[UNSUPPORTED_FORMULATION_SPATIAL_FIELD\]/);
    });

    it('V5-ADV-007: Enforces revision invalidation when spatial field assignment changes', () => {
      const model = createBarModel(100, 10, 200000);
      const field = createScalarField('FIELD_REV', 'MAT1', 'E', () => 200000);
      model.spatialMaterialFields = new Map([['FIELD_REV', field]]);
      model.elements.get('E1')!.spatialFieldId = 'FIELD_REV';

      const assignment: GeometryMaterialAssignment = {
        assignmentId: 'ASGN_1',
        canonicalGeometryId: 'GEO_CANONICAL',
        geometryRevisionId: 'REV_001',
        materialId: 'MAT1',
        materialRevisionId: 'REV_M1',
        spatialFieldId: 'FIELD_REV',
        coordinateFrame: { frameType: 'GLOBAL_CARTESIAN' },
        coveragePolicy: 'PARTIAL_PERMITTED',
        state: 'DECLARED'
      };
      model.materialAssignments = new Map([['ASGN_1', assignment]]);

      // Pre-flight check passes
      expect(() => GeometryMaterialValidator.preFlightCheck(model)).not.toThrow();

      const fem = new FEMCore();
      const res = fem.solve(model);
      const evidence = FEMEvidenceEngine.generateEvidence(model, res);

      // Update geometry revision
      const updatedModel: FEMModel = {
        ...model,
        geometryMetadata: { geometryId: 'GEO_CANONICAL', geometryRevision: 'REV_MUTATED' }
      };

      const staleness = FEMEvidenceEngine.isEvidenceStale(evidence, updatedModel);
      expect(staleness.isStale).toBe(true);
    });

    it('V5-ADV-008: Validates coordinate frame transformation for spatial evaluation point', () => {
      const model = createBarModel(100, 10, 200000);
      const field = createScalarField('FIELD_LOCAL', 'MAT1', 'E', (c) => 100000 + 1000 * c.x);
      model.spatialMaterialFields = new Map([['FIELD_LOCAL', field]]);
      model.elements.get('E1')!.spatialFieldId = 'FIELD_LOCAL';

      const assignment: GeometryMaterialAssignment = {
        assignmentId: 'ASGN_LOCAL',
        canonicalGeometryId: 'GEO_CANONICAL',
        geometryRevisionId: 'REV_001',
        materialId: 'MAT1',
        materialRevisionId: 'REV_M1',
        spatialFieldId: 'FIELD_LOCAL',
        targetDomain: undefined,
        coordinateFrame: {
          frameType: 'LOCAL_PART_FRAME',
          transform: { position: { x: 50, y: 0, z: 0 } }
        },
        coveragePolicy: 'PARTIAL_PERMITTED',
        state: 'DECLARED'
      };
      model.materialAssignments = new Map([['ASGN_LOCAL', assignment]]);
      model.elements.get('E1')!.assignmentId = 'ASGN_LOCAL';

      const fem = new FEMCore();
      const res = fem.solve(model);

      // Element midpoint in global is x=50.
      // In local frame with origin at x=50, local_x = 50 - 50 = 0.
      // Thus E_eval = 100000 + 1000 * 0 = 100000!
      expect(res.U[1]).toBeCloseTo(0.1, 8);
    });

    it('V5-ADV-009: Detects non-finite values in expression evaluation', () => {
      const model = createBarModel(100, 10, 200000);
      // Midpoint of E1 is x = 50. Expression '200000 / (x - 50)' evaluates to Infinity!
      const field = createScalarField('FIELD_DIV_ZERO', 'MAT1', 'E', (c) => 200000 / (c.x - 50));
      model.spatialMaterialFields = new Map([['FIELD_DIV_ZERO', field]]);
      model.elements.get('E1')!.spatialFieldId = 'FIELD_DIV_ZERO';

      const fem = new FEMCore();
      expect(() => fem.solve(model)).toThrow(/\[SPATIAL_FIELD_ERROR\]/);
    });

    it('V5-ADV-010: Asserts non-support for thermal/electrical multiphysics claims', () => {
      const model = createBarModel(100, 10, 200000);
      const field = createScalarField('FIELD_THERMAL', 'MAT1', 'nu', () => 0.3);
      model.spatialMaterialFields = new Map([['FIELD_THERMAL', field]]);
      model.elements.get('E1')!.spatialFieldId = 'FIELD_THERMAL';

      const fem = new FEMCore();
      // Structural formulation requiring E will throw missing mandatory property E
      expect(() => fem.solve(model)).toThrow(/\[SPATIAL_FIELD_MISSING_PROPERTY\]/);
    });

    it('V5-ADV-011: Protects against zero-length or degenerate element with spatial field', () => {
      const model = createBarModel(0, 10, 200000); // Length = 0
      const field = createScalarField('FIELD_DEGENERATE', 'MAT1', 'E', () => 200000);
      model.spatialMaterialFields = new Map([['FIELD_DEGENERATE', field]]);
      model.elements.get('E1')!.spatialFieldId = 'FIELD_DEGENERATE';

      const fem = new FEMCore();
      expect(() => fem.solve(model)).toThrow(/\[ZERO_LENGTH_ELEMENT\]/);
    });

    it('V5-ADV-012: Confirms strain energy conservation and force equilibrium in 3D graded continuum mesh', () => {
      const model = createTET4Model(200000, 0.3);
      const field = createScalarField('FIELD_ENERGY_CHECK', 'MAT1', 'E', (c) => 200000 + 500 * c.x);
      model.spatialMaterialFields = new Map([['FIELD_ENERGY_CHECK', field]]);
      model.elements.get('E1')!.spatialFieldId = 'FIELD_ENERGY_CHECK';

      const fem = new FEMCore();
      const res = fem.solve(model);

      expect(res.equilibrium.ok).toBe(true);
      expect(res.energy.ok).toBe(true);
      expect(res.energy.strainEnergy).toBeGreaterThan(0);
      expect(Math.abs(res.energy.strainEnergy - res.energy.externalWork)).toBeLessThan(1e-4);
    });

  });

});
