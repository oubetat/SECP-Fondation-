/**
 * PATCH-271: Safety Factor Method Registry
 * 
 * Manages explicit Safety Factor calculation methodologies, their applicable criteria,
 * material family compatibility, temperature ranges, mathematical models, and assumptions.
 * Prevents generic, untraceable "FoS = Strength / Stress" shortcuts.
 */

import { SafetyFactorMethod271, SafetyMethodType271 } from './SafetyTypes271';

export class SafetyFactorMethodRegistry271 {
  private static methods: Map<SafetyMethodType271, SafetyFactorMethod271> = new Map([
    [
      'YIELD_STATIC_VON_MISES',
      {
        methodId: 'YIELD_STATIC_VON_MISES',
        name: 'Yield-Based Static Safety Factor (Von Mises Distortion Energy)',
        requiredInputs: ['yieldStrengthPa', 'equivalentVonMisesStressPa'],
        applicableFailureCriteria: ['VON_MISES'],
        applicableMaterialFamilies: ['ALUMINUM', 'STEEL', 'TITANIUM', 'NICKEL', 'COPPER'],
        temperatureValidityRange: { minTempK: 50, maxTempK: 1200 },
        formulaDescription: 'FoS = S_yield / sigma_vm; Margin = (S_yield / sigma_vm) - 1',
        assumptions: [
          'Ductile isotropic material behavior',
          'Static loading condition',
          'Equi-axially uniform yield limit in tension and compression'
        ],
        verificationStatus: 'PROVEN'
      }
    ],
    [
      'YIELD_STATIC_TRESCA',
      {
        methodId: 'YIELD_STATIC_TRESCA',
        name: 'Yield-Based Static Safety Factor (Tresca Max Shear Stress)',
        requiredInputs: ['yieldStrengthPa', 'maxShearStressPa'],
        applicableFailureCriteria: ['TRESCA'],
        applicableMaterialFamilies: ['ALUMINUM', 'STEEL', 'TITANIUM', 'COPPER'],
        temperatureValidityRange: { minTempK: 50, maxTempK: 1200 },
        formulaDescription: 'FoS = (S_yield / 2) / tau_max = S_yield / (sigma1 - sigma3)',
        assumptions: [
          'Ductile material behavior',
          'Max shear stress governs yielding (conservative vs Von Mises)'
        ],
        verificationStatus: 'PROVEN'
      }
    ],
    [
      'ULTIMATE_STATIC_RANKINE',
      {
        methodId: 'ULTIMATE_STATIC_RANKINE',
        name: 'Ultimate-Based Static Safety Factor (Rankine Max Tensile / Compressive Stress)',
        requiredInputs: ['ultimateTensileStrengthPa', 'ultimateCompressiveStrengthPa', 'principalStresses'],
        applicableFailureCriteria: ['MAX_PRINCIPAL_STRESS'],
        applicableMaterialFamilies: ['CAST_IRON', 'CERAMICS', 'GLASS', 'CONCRETE'],
        temperatureValidityRange: { minTempK: 50, maxTempK: 1500 },
        formulaDescription: 'If sigma1 > 0: FoS = S_ut / sigma1; If sigma3 < 0: FoS = S_uc / |sigma3|',
        assumptions: [
          'Brittle material behavior',
          'Tensile and compressive strengths may differ significantly',
          'Zero macroscopic plastic deformation before fracture'
        ],
        verificationStatus: 'PROVEN'
      }
    ],
    [
      'FRACTURE_LEFM_MODE_I',
      {
        methodId: 'FRACTURE_LEFM_MODE_I',
        name: 'LEFM Fracture Mechanics Safety Factor (Mode I Crack)',
        requiredInputs: ['materialKIC_PaSqrtM', 'appliedKI_PaSqrtM', 'crackLengthA_m', 'yieldStrengthPa'],
        applicableFailureCriteria: ['LEFM_MODE_I'],
        applicableMaterialFamilies: ['ALUMINUM', 'STEEL', 'TITANIUM', 'CERAMICS', 'GLASS'],
        temperatureValidityRange: { minTempK: 20, maxTempK: 1000 },
        formulaDescription: 'FoS = K_IC / K_I; Fracture Margin = K_IC - K_I; Valid if r_p <= a/5',
        assumptions: [
          'Linear Elastic Fracture Mechanics holds',
          'Small-Scale Yielding (SSY) at crack tip',
          'Dominant Mode I opening tensile stress'
        ],
        verificationStatus: 'PROVEN'
      }
    ],
    [
      'FATIGUE_SAFETY_DAMAGE',
      {
        methodId: 'FATIGUE_SAFETY_DAMAGE',
        name: 'Fatigue Damage & Stress Amplitude Safety Factor',
        requiredInputs: ['fatigueLimitPa', 'stressAmplitudePa', 'accumulatedDamageD'],
        applicableFailureCriteria: ['FATIGUE_FAILURE', 'SN_CURVE'],
        applicableMaterialFamilies: ['ALUMINUM', 'STEEL', 'TITANIUM'],
        temperatureValidityRange: { minTempK: 100, maxTempK: 900 },
        formulaDescription: 'Stress Amplitude FoS = S_e / sigma_a; Cumulative Damage FoS = 1 / D_total',
        assumptions: [
          'Palmgren-Miner linear damage accumulation',
          'High cycle fatigue (HCF) domain'
        ],
        verificationStatus: 'PROVEN'
      }
    ],
    [
      'BUCKLING_EULER_LOAD',
      {
        methodId: 'BUCKLING_EULER_LOAD',
        name: 'Euler Critical Buckling Load Factor',
        requiredInputs: ['criticalBucklingLoadPcr', 'appliedCompressiveLoadP'],
        applicableFailureCriteria: ['BUCKLING_FAILURE'],
        applicableMaterialFamilies: ['ALUMINUM', 'STEEL', 'TITANIUM', 'COMPOSITES'],
        temperatureValidityRange: { minTempK: 50, maxTempK: 1000 },
        formulaDescription: 'Buckling Load Factor BLF = P_cr / P_applied; Margin = BLF - 1',
        assumptions: [
          'Elastic column/shell instability',
          'Perfectly centered axial compression'
        ],
        verificationStatus: 'PROVEN'
      }
    ],
    [
      'SHEAR_ALLOWABLE_SAFETY',
      {
        methodId: 'SHEAR_ALLOWABLE_SAFETY',
        name: 'Shear Allowable Safety Factor',
        requiredInputs: ['allowableShearStrengthPa', 'appliedShearStressPa'],
        applicableFailureCriteria: ['SHEAR_FAILURE', 'TRESCA', 'VON_MISES'],
        applicableMaterialFamilies: ['ALUMINUM', 'STEEL', 'TITANIUM'],
        temperatureValidityRange: { minTempK: 50, maxTempK: 1000 },
        formulaDescription: 'FoS = S_sy / tau_applied where S_sy = 0.577 * S_y for Von Mises',
        assumptions: ['Pure shear stress condition'],
        verificationStatus: 'PROVEN'
      }
    ],
    [
      'THERMAL_DEGRADATION_SAFETY',
      {
        methodId: 'THERMAL_DEGRADATION_SAFETY',
        name: 'Thermal Stress & Temperature-Dependent Degradation Safety Factor',
        requiredInputs: ['tempDependentStrengthPa', 'totalThermalPlusMechanicalStressPa'],
        applicableFailureCriteria: ['THERMAL_FAILURE', 'VON_MISES'],
        applicableMaterialFamilies: ['ALUMINUM', 'STEEL', 'TITANIUM', 'NICKEL'],
        temperatureValidityRange: { minTempK: 50, maxTempK: 1500 },
        formulaDescription: 'FoS = S_yield(T) / (sigma_mechanical + E(T)*alpha(T)*deltaT)',
        assumptions: [
          'Combined thermomechanical stress',
          'Temperature-dependent material property curve'
        ],
        verificationStatus: 'PROVEN'
      }
    ],
    [
      'SERVICEABILITY_DISPLACEMENT',
      {
        methodId: 'SERVICEABILITY_DISPLACEMENT',
        name: 'Serviceability Displacement Limit Factor',
        requiredInputs: ['allowableDisplacementM', 'actualDisplacementM'],
        applicableFailureCriteria: ['SERVICEABILITY_LIMIT'],
        applicableMaterialFamilies: ['ALL'],
        temperatureValidityRange: { minTempK: 0, maxTempK: 2000 },
        formulaDescription: 'FoS_disp = delta_allow / delta_actual; Displacement Margin = delta_allow - delta_actual',
        assumptions: ['Deflection/stiffness constraint without structural yielding'],
        verificationStatus: 'PROVEN'
      }
    ]
  ]);

  public static getMethod(methodId: SafetyMethodType271): SafetyFactorMethod271 | undefined {
    return this.methods.get(methodId);
  }

  public static getAllMethods(): SafetyFactorMethod271[] {
    return Array.from(this.methods.values());
  }
}
