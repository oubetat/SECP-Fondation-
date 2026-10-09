/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Boundary Condition Applicability Matrix
 */

import {
  BoundaryConditionType,
  BoundaryFieldType,
  PhysicsDomain,
  BoundaryDiagnosticCode
} from './BoundaryConditionTypes';

export interface ApplicabilityResult {
  readonly applicable: boolean;
  readonly diagnostics: readonly string[];
  readonly code?: BoundaryDiagnosticCode;
}

export class BoundaryConditionApplicability {
  public static checkApplicability(
    conditionType: BoundaryConditionType,
    fieldType: BoundaryFieldType,
    physicsDomain: PhysicsDomain
  ): ApplicabilityResult {
    const diagnostics: string[] = [];

    // Map valid condition types per field
    const allowedTypesForField: Record<BoundaryFieldType, BoundaryConditionType[]> = {
      [BoundaryFieldType.VELOCITY]: [
        BoundaryConditionType.FIXED_VELOCITY,
        BoundaryConditionType.NO_SLIP_WALL,
        BoundaryConditionType.SLIP_WALL,
        BoundaryConditionType.SYMMETRY,
        BoundaryConditionType.VELOCITY_INLET,
        BoundaryConditionType.MASS_FLOW_INLET,
        BoundaryConditionType.PERIODIC_PAIR
      ],
      [BoundaryFieldType.PRESSURE]: [
        BoundaryConditionType.FIXED_PRESSURE,
        BoundaryConditionType.PRESSURE_OUTLET,
        BoundaryConditionType.PRESSURE_INLET,
        BoundaryConditionType.ZERO_GRADIENT_OUTLET,
        BoundaryConditionType.PERIODIC_PAIR
      ],
      [BoundaryFieldType.TEMPERATURE]: [
        BoundaryConditionType.FIXED_TEMPERATURE,
        BoundaryConditionType.ADIABATIC_WALL,
        BoundaryConditionType.FIXED_HEAT_FLUX,
        BoundaryConditionType.CONVECTIVE_HEAT_TRANSFER,
        BoundaryConditionType.MIXED_ROBIN,
        BoundaryConditionType.PERIODIC_PAIR
      ],
      [BoundaryFieldType.INTERNAL_ENERGY]: [
        BoundaryConditionType.ENERGY_CONSTRAINT,
        BoundaryConditionType.FIXED_TEMPERATURE,
        BoundaryConditionType.ADIABATIC_WALL,
        BoundaryConditionType.FIXED_HEAT_FLUX,
        BoundaryConditionType.PERIODIC_PAIR
      ],
      [BoundaryFieldType.TOTAL_ENERGY]: [
        BoundaryConditionType.ENERGY_CONSTRAINT,
        BoundaryConditionType.FIXED_TEMPERATURE,
        BoundaryConditionType.ADIABATIC_WALL,
        BoundaryConditionType.FIXED_HEAT_FLUX,
        BoundaryConditionType.PERIODIC_PAIR
      ],
      [BoundaryFieldType.MASS_FLOW]: [
        BoundaryConditionType.MASS_FLOW_INLET,
        BoundaryConditionType.MASS_FLOW_OUTLET,
        BoundaryConditionType.PERIODIC_PAIR
      ],
      [BoundaryFieldType.HEAT_FLUX]: [
        BoundaryConditionType.FIXED_HEAT_FLUX,
        BoundaryConditionType.ADIABATIC_WALL,
        BoundaryConditionType.CONVECTIVE_HEAT_TRANSFER
      ]
    };

    const allowed = allowedTypesForField[fieldType];
    if (!allowed || !allowed.includes(conditionType)) {
      diagnostics.push(`Condition '${conditionType}' is not applicable to field '${fieldType}' in domain '${physicsDomain}'.`);
      return {
        applicable: false,
        diagnostics: Object.freeze(diagnostics),
        code: BoundaryDiagnosticCode.INVALID_BOUNDARY_CONDITION
      };
    }

    return { applicable: true, diagnostics: Object.freeze(diagnostics) };
  }
}
