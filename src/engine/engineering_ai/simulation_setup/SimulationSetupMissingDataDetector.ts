/**
 * SECP Industrial OS - PATCH-310 Missing Data Detector & Assumption Registry
 * Detects missing, ambiguous, or conflicting simulation data (materials, loads, BCs)
 * according to the strict NO GUESSING RULE and manages assumption proposals.
 */

import {
  EngineeringSimulationCase,
  SimulationAssumption,
} from './AISimulationSetupTypes310';

export interface MissingDataCheckResult {
  hasMissingData: boolean;
  missingFields: string[];
  ambiguousFields: string[];
  proposedAssumptions: SimulationAssumption[];
}

export class SimulationSetupMissingDataDetector {
  /**
   * Scans a simulation case for missing material properties, load directions, or boundary conditions.
   */
  public analyzeSimulationCase(simCase: EngineeringSimulationCase): MissingDataCheckResult {
    const missingFields: string[] = [];
    const ambiguousFields: string[] = [];
    const proposedAssumptions: SimulationAssumption[] = [];
    const timestamp = Date.now();

    // 1. Material Properties Verification
    if (!simCase.materialName || simCase.materialName === 'UNKNOWN') {
      missingFields.push('Material Definition (Material property is required)');
    }

    // 2. Boundary Condition Support Check
    if (simCase.boundaryConditions.length === 0) {
      missingFields.push('Boundary Conditions (Fixed/Pinned support location required to prevent rigid body motion)');
      proposedAssumptions.push({
        assumptionId: `ASM-BC-${timestamp}-1`,
        description: 'Fixed support applied at mounting face',
        source: 'AI_PROPOSAL',
        parameterName: 'BoundaryCondition_Face0',
        proposedValue: 'FIXED_SUPPORT',
        unit: 'N/A',
        isApproved: false,
        timestamp,
      });
    }

    // 3. Load Magnitude & Vector Check
    if (simCase.loads.length === 0) {
      missingFields.push('Applied Loads (Force / Pressure load magnitude and direction required)');
    } else {
      for (const load of simCase.loads) {
        if (!load.directionVector || (load.directionVector[0] === 0 && load.directionVector[1] === 0 && load.directionVector[2] === 0)) {
          ambiguousFields.push(`Load ${load.name} direction vector is zero or ambiguous`);
        }
        if (load.unit === 'mm' || load.unit === 'kg') {
          missingFields.push(`Unit Mismatch for load ${load.name}: expected Force unit (N or kN), got ${load.unit}`);
        }
      }
    }

    // 4. Geometry Reference Validity Check
    for (const bc of simCase.boundaryConditions) {
      if (!bc.targetEntity.isValid) {
        missingFields.push(`Invalid CAD geometry reference on Boundary Condition ${bc.name}`);
      }
    }
    for (const load of simCase.loads) {
      if (!load.targetEntity.isValid) {
        missingFields.push(`Invalid CAD geometry reference on Applied Load ${load.name}`);
      }
    }

    return {
      hasMissingData: missingFields.length > 0 || ambiguousFields.length > 0,
      missingFields,
      ambiguousFields,
      proposedAssumptions,
    };
  }
}
