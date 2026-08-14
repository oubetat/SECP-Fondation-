/**
 * SECP-056 Production Process Intelligence & Machine Planning Engine
 */

import { ProcessType, Vector3D } from './ManufacturingTypes';
import {
  ProductionManufacturingFeature,
  ManufacturingMachineCapability,
  ManufacturingToolCandidate,
  ManufacturingSetupPlan
} from './ProductionManufacturingTypes';

export class ProductionProcessPlanningEngine {

  /**
   * Standard Machine Library Candidates
   */
  public static getStandardMachineLibrary(): ManufacturingMachineCapability[] {
    return [
      {
        machineId: 'mch-haas-vf2-3ax',
        name: 'Haas VF-2 Vertical Machining Center',
        axisCount: 3,
        maxWorkpieceDimensionsMm: { x: 762, y: 406, z: 508 },
        spindleMaxRpm: 10000,
        positionalAccuracyMm: 0.005,
        supportedProcesses: [ProcessType.MILLING_3AXIS, ProcessType.DRILLING]
      },
      {
        machineId: 'mch-dmg-dmu50-5ax',
        name: 'DMG MORI DMU 50 5-Axis CNC',
        axisCount: 5,
        maxWorkpieceDimensionsMm: { x: 650, y: 520, z: 475 },
        spindleMaxRpm: 20000,
        positionalAccuracyMm: 0.002,
        supportedProcesses: [ProcessType.MILLING_3AXIS, ProcessType.MILLING_5AXIS, ProcessType.DRILLING]
      }
    ];
  }

  /**
   * Select Optimal Tool Candidate for Feature
   */
  public static selectToolCandidate(feat: ProductionManufacturingFeature): ManufacturingToolCandidate {
    const req = feat.toolRequirements;
    const diameter = req.minToolDiameterMm || 10;
    const reach = req.minToolReachMm || 20;

    return {
      toolId: `tool-${req.toolType.toLowerCase()}-${diameter}mm`,
      name: `${diameter}mm Solid Carbide ${req.toolType}`,
      toolType: req.toolType,
      diameterMm: diameter,
      reachMm: reach,
      fluteCount: req.flutesRequired || 4,
      material: 'CARBIDE'
    };
  }

  /**
   * Generate Multi-Axis Setup Plan
   */
  public static generateSetupPlan(features: ProductionManufacturingFeature[]): ManufacturingSetupPlan {
    const accessVectors: Vector3D[] = [];

    for (const f of features) {
      const vec = f.accessibility.primaryAccessVector;
      const exists = accessVectors.some(v => v.x === vec.x && v.y === vec.y && v.z === vec.z);
      if (!exists) accessVectors.push(vec);
    }

    const has5AxisOnly = features.some(f => !f.accessibility.isAccessible3Axis);
    const fixtureType = has5AxisOnly ? '5AXIS_TRUNNION' : accessVectors.length > 2 ? '5AXIS_TRUNNION' : 'VISE';

    return {
      setupCount: accessVectors.length,
      orientations: accessVectors,
      primaryFixtureType: fixtureType
    };
  }

  /**
   * Evaluate Process Accessibility (3-Axis vs 5-Axis Milling) (056-C)
   */
  public static evaluateProcessAccessibility(
    features: ProductionManufacturingFeature[],
    preferredProcess: ProcessType = ProcessType.MILLING_3AXIS
  ): {
    is3AxisFeasible: boolean;
    is5AxisFeasible: boolean;
    constrainedFeaturesCount: number;
    recommendedProcess: ProcessType;
  } {
    const constrainedFeatures = features.filter(f => !f.accessibility.isAccessible3Axis);
    const constrainedFeaturesCount = constrainedFeatures.length;

    const is3AxisFeasible = constrainedFeaturesCount === 0;
    const is5AxisFeasible = features.every(f => f.accessibility.isAccessible5Axis);

    let recommendedProcess = preferredProcess;

    if (!is3AxisFeasible && is5AxisFeasible) {
      recommendedProcess = ProcessType.MILLING_5AXIS;
    } else if (is3AxisFeasible) {
      recommendedProcess = ProcessType.MILLING_3AXIS;
    }

    return {
      is3AxisFeasible,
      is5AxisFeasible,
      constrainedFeaturesCount,
      recommendedProcess
    };
  }
}
