/**
 * SECP Industrial OS — EPC-019: Parametric Airframe Manager
 * Manages Airframe Lifecycle, Parameter Mutations, Regeneration, Revision Diffs, and Multi-Variant Baselines.
 */

import {
  AirframeRevisionDiff,
  ParametricAirframeConfig,
  ParametricAirframeModel
} from './ParametricAirframeTypes';
import { ParametricAirframeGenerator } from './ParametricAirframeGenerator';
import { ParametricAirframeParameters } from './ParametricAirframeParameters';

export class ParametricAirframeManager {
  private currentModel: ParametricAirframeModel;
  private readonly revisionHistory: ParametricAirframeModel[] = [];
  private currentConfig: ParametricAirframeConfig;

  constructor(initialConfig?: Partial<ParametricAirframeConfig>) {
    this.currentConfig = {
      ...ParametricAirframeParameters.DEFAULT_CONFIG,
      ...initialConfig
    };
    this.currentModel = ParametricAirframeGenerator.generateModel(this.currentConfig, {
      revision: '1.0'
    });
    this.revisionHistory.push(this.currentModel);
  }

  /**
   * Returns current active model.
   */
  public getModel(): ParametricAirframeModel {
    return this.currentModel;
  }

  /**
   * Returns full revision history.
   */
  public getRevisionHistory(): readonly ParametricAirframeModel[] {
    return [...this.revisionHistory];
  }

  /**
   * Updates a single parameter, triggers parametric regeneration, and returns the revision diff.
   */
  public updateParameter(parameterName: string, value: any, author = 'SECP-PARAMETRIC-AGENT'): AirframeRevisionDiff {
    const configKeyMap: Record<string, keyof ParametricAirframeConfig> = {
      BodyLength: 'bodyLength',
      BodyWidth: 'bodyWidth',
      BodyHeight: 'bodyHeight',
      BodyPlateThickness: 'bodyPlateThickness',
      ArmCount: 'armCount',
      ArmLength: 'armLength',
      ArmWidth: 'armWidth',
      ArmThickness: 'armThickness',
      ArmOffsetZ: 'armOffsetZ',
      MotorMountDiameter: 'motorMountDiameter',
      MotorMountThickness: 'motorMountThickness',
      MotorMountOffset: 'motorMountOffset',
      PayloadMountLength: 'payloadMountLength',
      PayloadMountWidth: 'payloadMountWidth',
      PayloadMountHeight: 'payloadMountHeight',
      PayloadClearance: 'payloadClearance',
      BatteryMountLength: 'batteryMountLength',
      BatteryMountWidth: 'batteryMountWidth',
      BatteryMountHeight: 'batteryMountHeight',
      BatteryClearance: 'batteryClearance',
      LandingGearMountPosition: 'landingGearMountSpacing',
      StructuralClearance: 'structuralClearance',
      FastenerDiameter: 'fastenerDiameter',
      MaterialReference: 'bodyMaterialId'
    };

    const cfgKey = configKeyMap[parameterName] || (parameterName as keyof ParametricAirframeConfig);
    const newConfig: ParametricAirframeConfig = {
      ...this.currentConfig,
      [cfgKey]: value
    };

    return this.applyConfigChanges(newConfig, author);
  }

  /**
   * Applies multiple parameter modifications simultaneously and computes multidisciplinary impact diff.
   */
  public applyConfigChanges(
    newConfigInput: Partial<ParametricAirframeConfig>,
    author = 'SECP-PARAMETRIC-AGENT'
  ): AirframeRevisionDiff {
    const previousModel = this.currentModel;
    const prevRev = previousModel.revision;
    const revNumber = parseFloat(prevRev) + 0.1;
    const newRev = revNumber.toFixed(1);

    const mergedConfig: ParametricAirframeConfig = {
      ...this.currentConfig,
      ...newConfigInput
    };

    // Regenerate new geometry, mass properties, and topology
    const newModel = ParametricAirframeGenerator.generateModel(mergedConfig, {
      revision: newRev,
      author,
      existingModel: previousModel
    });

    // Detect changed parameters
    const changedParameters: Array<{ parameterName: string; oldValue: any; newValue: any; unit: string }> = [];
    for (const [key, param] of Object.entries(newModel.parameters)) {
      const oldParam = previousModel.parameters[key];
      if (oldParam && oldParam.value !== param.value) {
        changedParameters.push({
          parameterName: key,
          oldValue: oldParam.value,
          newValue: param.value,
          unit: param.unit
        });
      }
    }

    // Compute deltas
    const deltaMassKg = Number((newModel.massProperties.totalMassKg - previousModel.massProperties.totalMassKg).toFixed(4));
    const deltaCG = {
      x: Number((newModel.massProperties.centerOfGravity.x - previousModel.massProperties.centerOfGravity.x).toFixed(6)),
      y: Number((newModel.massProperties.centerOfGravity.y - previousModel.massProperties.centerOfGravity.y).toFixed(6)),
      z: Number((newModel.massProperties.centerOfGravity.z - previousModel.massProperties.centerOfGravity.z).toFixed(6))
    };
    const deltaInertia = {
      deltaIxx: Number((newModel.massProperties.inertiaTensor.Ixx - previousModel.massProperties.inertiaTensor.Ixx).toFixed(6)),
      deltaIyy: Number((newModel.massProperties.inertiaTensor.Iyy - previousModel.massProperties.inertiaTensor.Iyy).toFixed(6)),
      deltaIzz: Number((newModel.massProperties.inertiaTensor.Izz - previousModel.massProperties.inertiaTensor.Izz).toFixed(6))
    };

    const diff: AirframeRevisionDiff = {
      previousRevision: prevRev,
      newRevision: newRev,
      timestamp: new Date().toISOString(),
      changedParameters,
      deltaMassKg,
      deltaCG,
      deltaInertia,
      regeneratedFeatures: newModel.features.map(f => f.name),
      impactReport: {
        structuralImpact: `Airframe structural re-meshing required for ${changedParameters.map(p => p.parameterName).join(', ')}.`,
        propulsionImpact: deltaMassKg !== 0 ? `Total airframe mass changed by ${deltaMassKg > 0 ? '+' : ''}${deltaMassKg} kg.` : 'Propulsion clearance preserved.',
        massBudgetImpact: `Updated Airframe mass: ${newModel.massProperties.totalMassKg.toFixed(3)} kg.`
      }
    };

    this.currentConfig = mergedConfig;
    this.currentModel = newModel;
    this.revisionHistory.push(newModel);

    return diff;
  }
}
