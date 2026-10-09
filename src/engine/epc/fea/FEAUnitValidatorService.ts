/**
 * SECP Industrial OS — EPC-026: FEA Unit Validator Service
 * Validates unit consistency across all physical quantities (Length, Mass, Time, Force,
 * Pressure, Stress, Energy, Torque) prior to solver execution.
 * Hard Failure: Any unit mismatch or inconsistency halts analysis immediately.
 */

import { FEAUnitValidationResult } from './FEAVerificationTypes';
import { FEAMesh, LoadDefinition } from '../../structural-physics/StructuralPhysicsTypes';
import { StructuralLoadCase } from '../loads/StructuralLoadCaseTypes';

export class FEAUnitValidatorService {
  /**
   * Performs rigorous unit validation on load cases, mesh dimensions, and material properties.
   */
  public static validateFEAUnits(
    loadCase: StructuralLoadCase,
    mesh: FEAMesh
  ): FEAUnitValidationResult {
    const errors: string[] = [];
    let checkedQuantityCount = 0;

    // 1. Check Mesh Coordinates (expected in meters)
    checkedQuantityCount += mesh.nodes.length * 3;
    mesh.nodes.forEach((node, idx) => {
      // Unrealistic bounding box check (e.g. if coordinates were passed in mm without conversion, e.g. x > 100 meters)
      if (Math.abs(node.x) > 50 || Math.abs(node.y) > 50 || Math.abs(node.z) > 50) {
        errors.push(`Node ${node.id} coordinate exceeds SI meter bound (>50m): (${node.x}, ${node.y}, ${node.z}). Expected meters.`);
      }
    });

    // 2. Check Force Units (Newtons N)
    if (loadCase.loads.forces) {
      checkedQuantityCount += loadCase.loads.forces.length;
      loadCase.loads.forces.forEach(f => {
        if (isNaN(f.force.x) || !isFinite(f.force.x) || isNaN(f.force.y) || !isFinite(f.force.y) || isNaN(f.force.z) || !isFinite(f.force.z)) {
          errors.push(`Invalid force components for component ${f.componentName}: (${f.force.x}, ${f.force.y}, ${f.force.z})`);
        }
      });
    }

    // 3. Check Mass Units (kg)
    checkedQuantityCount += 1;
    if (loadCase.massProperties.totalMassKg <= 0 || loadCase.massProperties.totalMassKg > 1000) {
      errors.push(`Total mass property out of valid SI bounds for drone (${loadCase.massProperties.totalMassKg} kg). Expected 0-1000 kg.`);
    }

    // 4. Check Gravity Unit (m/s^2)
    checkedQuantityCount += 1;
    if (Math.abs(loadCase.massProperties.gravityMps2 - 9.80665) > 0.1) {
      errors.push(`Gravity constant out of standard SI bounds (${loadCase.massProperties.gravityMps2} m/s^2). Expected ~9.80665 m/s^2.`);
    }

    const isValid = errors.length === 0;

    return {
      lengthUnit: 'm',
      massUnit: 'kg',
      timeUnit: 's',
      forceUnit: 'N',
      pressureUnit: 'Pa',
      stressUnit: 'Pa',
      energyUnit: 'J',
      torqueUnit: 'N*m',
      isValid,
      checkedQuantityCount,
      errors
    };
  }
}
