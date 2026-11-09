/**
 * PATCH-224 — Gear Assembly & Shaft Bridge
 * Bridges Gear Engineering Objects with the SECP Assembly Constraint Solver,
 * Shaft journals (DIN 6885-1 keyway matching), and multi-stage Kinematic Gear Trains.
 */

import { GearDefinition, GearPairDefinition, GearAssemblyInstance } from './GearTypes';
import { GearGenerator } from './GearGenerator';
import { AssemblyComponent, AssemblyConstraint } from '../AssemblyConstraintTypes';

export interface MountGearOnShaftOptions {
  gear: GearDefinition;
  shaftComponentId: string;
  shaftJournalDiameterMm: number;
  shaftJournalLengthMm: number;
  axialPositionZMm: number;
}

export class GearAssemblyBridge {
  /**
   * Instantiate a Gear as a valid Assembly Component
   */
  public static createGearAssemblyComponent(gear: GearDefinition, instanceIndex: number = 1): GearAssemblyInstance {
    const instanceId = `COMP-${gear.gearId}-${instanceIndex}`;
    const partDef = GearGenerator.toAssemblyPartDefinition(gear);

    const assemblyComponent = new AssemblyComponent({
      id: instanceId,
      instanceId,
      partId: gear.gearId,
      name: `${gear.name} (#${instanceIndex})`,
      grounded: false,
      suppressed: false
    });

    return {
      instanceId,
      gearId: gear.gearId,
      partNumber: partDef.manufacturingMetadata.partNumber,
      assemblyComponent,
      gearDefinition: gear,
      currentRotationDeg: 0,
      angularVelocityRpm: 1450,
      status: 'FREE'
    };
  }

  /**
   * Create Assembly Constraints to mount a Gear onto a Shaft Journal
   */
  public static createShaftMountConstraints(options: MountGearOnShaftOptions): {
    concentricConstraint: AssemblyConstraint;
    axialMateConstraint: AssemblyConstraint;
    isBoreFitValid: boolean;
    fitDiagnostic?: string;
  } {
    const { gear, shaftComponentId, shaftJournalDiameterMm, axialPositionZMm } = options;
    const gearComponentId = `COMP-${gear.gearId}-1`;

    const boreDia = gear.bore.diameterMm;
    const diametralDiff = boreDia - shaftJournalDiameterMm;
    const isBoreFitValid = Math.abs(diametralDiff) <= 0.05; // Standard transition/locating fit tolerance

    let fitDiagnostic: string | undefined;
    if (!isBoreFitValid) {
      fitDiagnostic = `Bore/Journal Incompatibility: Gear bore Ø${boreDia}mm does not match Shaft Journal Ø${shaftJournalDiameterMm}mm (Delta: ${diametralDiff.toFixed(3)}mm).`;
    }

    const concentricConstraint = new AssemblyConstraint({
      id: `CST-CONC-${gear.gearId}-${shaftComponentId}`,
      constraintId: `CST-CONC-${gear.gearId}-${shaftComponentId}`,
      assemblyId: 'MAIN_ASSEMBLY',
      componentA: gearComponentId,
      componentB: shaftComponentId,
      geometryRefA: {
        componentId: gearComponentId,
        topologyType: 'CYLINDER',
        topologyIndex: 0,
        geometricSignature: 'BORE_CYLINDER'
      },
      geometryRefB: {
        componentId: shaftComponentId,
        topologyType: 'CYLINDER',
        topologyIndex: 0,
        geometricSignature: 'JOURNAL_CYLINDER'
      },
      type: 'CONCENTRIC',
      status: isBoreFitValid ? 'SATISFIED' : 'FAILED',
      parameters: {
        alignment: 'ALIGNED',
        offset: 0
      },
      revision: 1
    });

    const axialMateConstraint = new AssemblyConstraint({
      id: `CST-MATE-${gear.gearId}-${shaftComponentId}`,
      constraintId: `CST-MATE-${gear.gearId}-${shaftComponentId}`,
      assemblyId: 'MAIN_ASSEMBLY',
      componentA: gearComponentId,
      componentB: shaftComponentId,
      geometryRefA: {
        componentId: gearComponentId,
        topologyType: 'FACE',
        topologyIndex: 0,
        geometricSignature: 'GEAR_HUB_BACK_FACE'
      },
      geometryRefB: {
        componentId: shaftComponentId,
        topologyType: 'FACE',
        topologyIndex: 0,
        geometricSignature: 'SHAFT_SHOULDER_FACE'
      },
      type: 'MATE',
      status: 'SATISFIED',
      parameters: {
        offset: axialPositionZMm,
        mateType: 'COINCIDENT'
      },
      revision: 1
    });

    return {
      concentricConstraint,
      axialMateConstraint,
      isBoreFitValid,
      fitDiagnostic
    };
  }

  /**
   * Create Kinematic Gear Mate Constraint between two meshing gear instances
   */
  public static createGearMateConstraint(
    instanceA: GearAssemblyInstance,
    instanceB: GearAssemblyInstance,
    pairDef: GearPairDefinition
  ): AssemblyConstraint {
    return new AssemblyConstraint({
      id: `CST-GEAR-MATE-${pairDef.pairId}`,
      constraintId: `CST-GEAR-MATE-${pairDef.pairId}`,
      assemblyId: 'MAIN_ASSEMBLY',
      componentA: instanceA.instanceId,
      componentB: instanceB.instanceId,
      geometryRefA: {
        componentId: instanceA.instanceId,
        topologyType: 'CYLINDER',
        topologyIndex: 0,
        geometricSignature: 'PITCH_CYLINDER'
      },
      geometryRefB: {
        componentId: instanceB.instanceId,
        topologyType: 'CYLINDER',
        topologyIndex: 0,
        geometricSignature: 'PITCH_CYLINDER'
      },
      type: 'GEAR_MATE',
      status: pairDef.hasInterference ? 'FAILED' : 'SATISFIED',
      parameters: {
        ratio: pairDef.gearRatio,
        pitchDiameterA: instanceA.gearDefinition.pitchDiameterMm,
        pitchDiameterB: instanceB.gearDefinition.pitchDiameterMm,
        reverseDirection: pairDef.wheelRotationDirection === 'CCW'
      },
      revision: 1
    });
  }

  /**
   * Cascade multi-stage gear train speeds: [Pinion1, Wheel1], [Pinion2, Wheel2]...
   */
  public static solveGearTrain(stages: { pinionTeeth: number; wheelTeeth: number }[], inputRpm: number): {
    stageRatios: number[];
    totalReductionRatio: number;
    outputRpm: number;
    outputTorqueMultiplier: number;
  } {
    const stageRatios = stages.map(s => s.wheelTeeth / s.pinionTeeth);
    const totalReductionRatio = stageRatios.reduce((acc, r) => acc * r, 1);
    const outputRpm = inputRpm / totalReductionRatio;
    const efficiency = Math.pow(0.985, stages.length);
    const outputTorqueMultiplier = totalReductionRatio * efficiency;

    return {
      stageRatios,
      totalReductionRatio: Math.round(totalReductionRatio * 1000) / 1000,
      outputRpm: Math.round(outputRpm * 10) / 10,
      outputTorqueMultiplier: Math.round(outputTorqueMultiplier * 100) / 100
    };
  }
}
