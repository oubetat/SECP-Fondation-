/**
 * PATCH-270: Failure Model Registry
 * 
 * Manages the canonical registry of supported failure models, categories,
 * required inputs, material applicability rules, validity bounds, and limitations.
 */

import { FailureModelDefinition270, FailureCategory270, FailureCriterionType270 } from './FailureTypes270';

export class FailureModelRegistry270 {
  private static registry: Map<string, FailureModelDefinition270> = new Map();
  private static initialized = false;

  public static initialize(): void {
    if (this.initialized) return;

    // 1. Von Mises Model
    this.registerModel({
      modelId: 'MODEL-VON-MISES-01',
      name: 'Von Mises Distortional Energy Yield Criterion',
      category: 'YIELD_FAILURE',
      requiredInputs: ['sigma_xx', 'sigma_yy', 'sigma_zz', 'tau_xy', 'tau_yz', 'tau_xz', 'yieldStrengthPa'],
      applicableMaterialFamilies: ['ALUMINUM', 'STEEL', 'TITANIUM', 'INCONEL', 'COPPER', 'DUCTILE_METALS'],
      applicableLoading: ['STATIC', 'QUASI_STATIC', 'MULTIAXIAL'],
      validityRange: {
        minTempK: 20,
        maxTempK: 1200,
        notes: 'Applicable to isotropic ductile materials undergoing plastic yielding without significant hydrostatic pressure dependence.'
      },
      parameters: { formulation: 'OCTAHERDRAL_SHEAR_ENERGY' },
      limitations: [
        'Not applicable to brittle materials (e.g. cast iron, glass, unreinforced ceramics).',
        'Assumes equal yield strength in tension and compression.',
        'Does not predict fracture or crack propagation.'
      ],
      verificationStatus: 'PROVEN'
    });

    // 2. Tresca Model
    this.registerModel({
      modelId: 'MODEL-TRESCA-01',
      name: 'Tresca Maximum Shear Stress Yield Criterion',
      category: 'YIELD_FAILURE',
      requiredInputs: ['sigma_xx', 'sigma_yy', 'sigma_zz', 'tau_xy', 'tau_yz', 'tau_xz', 'yieldStrengthPa'],
      applicableMaterialFamilies: ['ALUMINUM', 'STEEL', 'TITANIUM', 'INCONEL', 'DUCTILE_METALS'],
      applicableLoading: ['STATIC', 'QUASI_STATIC', 'MULTIAXIAL'],
      validityRange: {
        minTempK: 20,
        maxTempK: 1200,
        notes: 'Conservative yield boundary for isotropic ductile metals.'
      },
      parameters: { formulation: 'MAXIMUM_SHEAR_STRESS' },
      limitations: [
        'Slightly conservative compared to Von Mises (up to 15.5% difference in pure shear).',
        'Not applicable to brittle non-metals or pressure-dependent materials.'
      ],
      verificationStatus: 'PROVEN'
    });

    // 3. Maximum Principal Stress Model (Rankine)
    this.registerModel({
      modelId: 'MODEL-MAX-PRINCIPAL-01',
      name: 'Maximum Principal Stress Criterion (Rankine)',
      category: 'BRITTLE_FAILURE',
      requiredInputs: ['sigma_xx', 'sigma_yy', 'sigma_zz', 'tau_xy', 'tau_yz', 'tau_xz', 'ultimateTensileStrengthPa', 'ultimateCompressiveStrengthPa'],
      applicableMaterialFamilies: ['CAST_IRON', 'CONCRETE', 'CERAMICS', 'BRITTLE_METALS', 'GLASS'],
      applicableLoading: ['STATIC', 'TENSILE_DOMINATED'],
      validityRange: {
        minTempK: 50,
        maxTempK: 1000,
        notes: 'Applicable to brittle materials where fracture occurs when maximum tensile stress reaches ultimate strength.'
      },
      parameters: { formulation: 'MAXIMUM_NORMAL_STRESS' },
      limitations: [
        'STRICTLY FORBIDDEN as a general yield solver for ductile metals.',
        'Does not account for shear yield or hydrostatic stress suppression.'
      ],
      verificationStatus: 'PROVEN'
    });

    // 4. Mohr-Coulomb Model
    this.registerModel({
      modelId: 'MODEL-MOHR-COULOMB-01',
      name: 'Mohr-Coulomb Friction-Cohesion Criterion',
      category: 'BRITTLE_FAILURE',
      requiredInputs: ['sigma_xx', 'sigma_yy', 'sigma_zz', 'tau_xy', 'tau_yz', 'tau_xz', 'ultimateTensileStrengthPa', 'ultimateCompressiveStrengthPa'],
      applicableMaterialFamilies: ['CAST_IRON', 'CONCRETE', 'SOILS', 'ROCKS', 'BRITTLE_POLYMERS'],
      applicableLoading: ['STATIC', 'COMPRESSIVE_DOMINATED', 'FRACTURE'],
      validityRange: {
        minTempK: 100,
        maxTempK: 800,
        notes: 'Applicable to brittle materials with unequal tensile and compressive strengths.'
      },
      parameters: { formulation: 'SHEAR_COHESION_FRICTION' },
      limitations: [
        'MUST NOT be automatically applied to standard ductile metals.',
        'Requires reliable compressive and tensile strength inputs.'
      ],
      verificationStatus: 'PROVEN'
    });

    // 5. Drucker-Prager Architecture Model
    this.registerModel({
      modelId: 'MODEL-DRUCKER-PRAGER-01',
      name: 'Drucker-Prager Pressure-Dependent Yield Architecture',
      category: 'PLASTIC_FAILURE',
      requiredInputs: ['sigma_xx', 'sigma_yy', 'sigma_zz', 'tau_xy', 'tau_yz', 'tau_xz', 'yieldStrengthPa', 'frictionAngleRad'],
      applicableMaterialFamilies: ['GEOMATERIALS', 'FOAMS', 'POLYMERS', 'POWDER_METALS'],
      applicableLoading: ['MULTIAXIAL_PRESSURE'],
      validityRange: {
        minTempK: 100,
        maxTempK: 600,
        notes: 'Smooth approximation to Mohr-Coulomb for pressure-sensitive plastic flow.'
      },
      parameters: { formulation: 'HYDROSTATIC_INVARIANT_DEPENDENT' },
      limitations: [
        'Requires independent triaxial or shear-friction calibration parameter.'
      ],
      verificationStatus: 'PROVEN'
    });

    // 6. LEFM Mode I Fracture Mechanics Model
    this.registerModel({
      modelId: 'MODEL-LEFM-MODE1-01',
      name: 'Linear Elastic Fracture Mechanics Mode I Opening Model',
      category: 'FRACTURE',
      requiredInputs: ['crackLengthA_m', 'appliedFarFieldStressPa', 'materialKIC_PaSqrtM', 'materialYieldStrengthPa'],
      applicableMaterialFamilies: ['ALUMINUM', 'STEEL', 'TITANIUM', 'CERAMICS', 'GLASS', 'ALL_ENGINEERING_STRUCTURAL'],
      applicableLoading: ['STATIC_TENSILE', 'CRACK_OPENING'],
      validityRange: {
        minTempK: 20,
        maxTempK: 800,
        notes: 'Valid ONLY when small-scale yielding (SSY) condition r_p <= a / 5 is satisfied.'
      },
      parameters: { formulation: 'STRESS_INTENSITY_FACTOR_KI' },
      limitations: [
        'Invalid under large-scale plasticity (requires EPFM / J-Integral).',
        'Cannot be applied without an explicit, non-zero crack size input.'
      ],
      verificationStatus: 'PROVEN'
    });

    this.initialized = true;
  }

  public static registerModel(def: FailureModelDefinition270): void {
    this.registry.set(def.modelId, def);
  }

  public static getModel(modelId: string): FailureModelDefinition270 | undefined {
    this.initialize();
    return this.registry.get(modelId);
  }

  public static getAllModels(): FailureModelDefinition270[] {
    this.initialize();
    return Array.from(this.registry.values());
  }

  public static getModelByCriterion(criterion: FailureCriterionType270): FailureModelDefinition270 | undefined {
    this.initialize();
    switch (criterion) {
      case 'VON_MISES':
        return this.getModel('MODEL-VON-MISES-01');
      case 'TRESCA':
        return this.getModel('MODEL-TRESCA-01');
      case 'MAX_PRINCIPAL_STRESS':
        return this.getModel('MODEL-MAX-PRINCIPAL-01');
      case 'MOHR_COULOMB':
        return this.getModel('MODEL-MOHR-COULOMB-01');
      case 'DRUCKER_PRAGER':
        return this.getModel('MODEL-DRUCKER-PRAGER-01');
      case 'LEFM_MODE_I':
      case 'LEFM_MIXED_MODE':
        return this.getModel('MODEL-LEFM-MODE1-01');
      default:
        return undefined;
    }
  }
}
