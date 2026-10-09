/**
 * SECP Industrial OS — EPC-040: Transmission & Gear Model Engine
 * Reusable transmission model supporting multi-stage gear trains, parametric updates,
 * material integration, mass properties, power conservation, robot joint integration,
 * evidence hashing, and provenance tracking.
 */

import { GEAR_MATERIALS, GearMaterialGrade } from '../../assembly/gear/GearTypes';
import { GearGenerator } from '../../assembly/gear/GearGenerator';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';
import { RobotTransmissionValidator } from './RobotTransmissionValidator';
import {
  BearingInterface,
  GearModelDefinition,
  GearSupportStatus,
  GearType,
  ShaftInterface,
  TransmissionDefinition,
  TransmissionEvidencePackage,
  TransmissionGenerationResult,
  TransmissionJointOutput,
  TransmissionProvenanceRecord,
  TransmissionStageDefinition,
  TransmissionType
} from './RobotTransmissionTypes';

export interface StageCreationOptions {
  stageId?: string;
  stageType?: GearType;
  driverTeeth: number;
  drivenTeeth: number;
  module: number;
  faceWidthMm?: number;
  pressureAngleDeg?: number;
  helixAngleDeg?: number;
  stageEfficiency?: number;
  material?: string;
  bearingModel?: string;
}

export interface TransmissionCreationOptions {
  transmissionId?: string;
  name?: string;
  type?: TransmissionType;
  jointId?: string;
  revision?: string;
  material?: string;
  inputSpeedRpm: number;
  inputTorqueNm: number;
  stages: StageCreationOptions[];
  inputShaftDiameterMm?: number;
  outputShaftDiameterMm?: number;
}

export class RobotTransmissionEngine {
  public static readonly PROVENANCE_SOURCE = 'SECP_EPC_040_TRANSMISSION_ENGINE';

  /**
   * Helper to determine gear type support status (SUPPORTED, PARTIAL, UNSUPPORTED)
   */
  public static getGearSupportStatus(gearType: GearType): GearSupportStatus {
    switch (gearType) {
      case 'SPUR':
      case 'HELICAL':
        return 'SUPPORTED';
      case 'BEVEL':
      case 'PLANETARY':
        return 'PARTIAL';
      default:
        return 'UNSUPPORTED';
    }
  }

  /**
   * Generates a parametric gear model definition using geometry, material density, and mass properties
   */
  public static createGearModel(params: {
    gearId: string;
    name: string;
    teethCount: number;
    module: number;
    faceWidthMm?: number;
    pressureAngleDeg?: number;
    helixAngleDeg?: number;
    gearType?: GearType;
    material?: string;
    revision?: string;
  }): GearModelDefinition {
    const gearType = params.gearType || 'SPUR';
    const moduleVal = params.module;
    const teeth = params.teethCount;
    const faceWidth = params.faceWidthMm || moduleVal * 10;
    const pressureAngle = params.pressureAngleDeg || 20.0;
    const helixAngle = params.helixAngleDeg || 0.0;
    const materialKey = (params.material || 'CASE_HARDENED_16MNCR5') as GearMaterialGrade;
    const revision = params.revision || 'REV-A';

    // Query material database
    const matProp = GEAR_MATERIALS[materialKey] || GEAR_MATERIALS.CASE_HARDENED_16MNCR5;
    const densityKgM3 = matProp.densityKgM3;

    // Parametric diameters (ISO 21771)
    const pitchDiameter = moduleVal * teeth;
    const outsideDiameter = pitchDiameter + 2 * moduleVal;
    const rootDiameter = Math.max(pitchDiameter - 2.5 * moduleVal, 0.1);
    const boreDiameter = Math.min(pitchDiameter * 0.3, pitchDiameter - 3 * moduleVal);

    // Derived Mass & Inertia Properties
    // Volume = pi/4 * (D_pitch^2 - D_bore^2) * faceWidth (in mm^3)
    const areaMm2 = (Math.PI / 4) * (pitchDiameter ** 2 - boreDiameter ** 2);
    const volumeMm3 = areaMm2 * faceWidth;
    const volumeM3 = volumeMm3 * 1e-9;
    const mass = volumeM3 * densityKgM3;

    // Rotational inertia around Z axis: Izz = 0.5 * m * (r_outer^2 + r_inner^2)
    const rOuterM = (pitchDiameter / 2) / 1000;
    const rInnerM = (boreDiameter / 2) / 1000;
    const faceWidthM = faceWidth / 1000;

    const Izz = 0.5 * mass * (rOuterM ** 2 + rInnerM ** 2);
    const Ixx = (1 / 12) * mass * (3 * (rOuterM ** 2 + rInnerM ** 2) + faceWidthM ** 2);
    const Iyy = Ixx;

    return {
      gearId: params.gearId,
      name: params.name,
      teethCount: teeth,
      module: moduleVal,
      pitchDiameter,
      outsideDiameter,
      rootDiameter,
      pressureAngle,
      faceWidth,
      helixAngle,
      gearType,
      material: matProp.grade,
      mass: Math.round(mass * 10000) / 10000,
      inertia: {
        Ixx: Math.round(Ixx * 1e7) / 1e7,
        Iyy: Math.round(Iyy * 1e7) / 1e7,
        Izz: Math.round(Izz * 1e7) / 1e7
      },
      revision,
      supportStatus: this.getGearSupportStatus(gearType)
    };
  }

  /**
   * Constructs a multi-stage transmission definition from options
   */
  public static createTransmission(
    options: TransmissionCreationOptions
  ): TransmissionDefinition {
    const transmissionId = options.transmissionId || 'TR-ROB-001';
    const name = options.name || 'Robotic Joint Transmission System';
    const revision = options.revision || 'REV-A';
    const jointId = options.jointId || 'J2_SHOULDER';
    const material = options.material || 'CASE_HARDENED_16MNCR5';

    let currentSpeedRpm = options.inputSpeedRpm;
    let currentTorqueNm = options.inputTorqueNm;
    let totalRatio = 1.0;
    let totalEfficiency = 1.0;
    let overallDirection = 1;

    const gearStages: TransmissionStageDefinition[] = [];
    let totalMass = 0;
    let totalIzz = 0;

    options.stages.forEach((stageOpt, idx) => {
      const stageIdx = idx + 1;
      const stageId = stageOpt.stageId || `STAGE-${stageIdx}`;
      const stageType = stageOpt.stageType || 'SPUR';
      const driverTeeth = stageOpt.driverTeeth;
      const drivenTeeth = stageOpt.drivenTeeth;
      const moduleVal = stageOpt.module;
      const stageEff = stageOpt.stageEfficiency ?? 0.98;

      const stageRatio = drivenTeeth / driverTeeth;
      const stageDirection = stageType === 'SPUR' || stageType === 'HELICAL' ? -1 : 1;

      // Create Driver & Driven Gears
      const driverGear = this.createGearModel({
        gearId: `${transmissionId}-STG${stageIdx}-DRIVER`,
        name: `Stage ${stageIdx} Driver Gear (${driverTeeth}T, m=${moduleVal})`,
        teethCount: driverTeeth,
        module: moduleVal,
        faceWidthMm: stageOpt.faceWidthMm,
        pressureAngleDeg: stageOpt.pressureAngleDeg,
        helixAngleDeg: stageOpt.helixAngleDeg,
        gearType: stageType,
        material: stageOpt.material || material,
        revision
      });

      const drivenGear = this.createGearModel({
        gearId: `${transmissionId}-STG${stageIdx}-DRIVEN`,
        name: `Stage ${stageIdx} Driven Gear (${drivenTeeth}T, m=${moduleVal})`,
        teethCount: drivenTeeth,
        module: moduleVal,
        faceWidthMm: stageOpt.faceWidthMm,
        pressureAngleDeg: stageOpt.pressureAngleDeg,
        helixAngleDeg: stageOpt.helixAngleDeg,
        gearType: stageType,
        material: stageOpt.material || material,
        revision
      });

      const stageInputSpeed = currentSpeedRpm;
      const stageOutputSpeed = stageInputSpeed / stageRatio;

      const stageInputTorque = currentTorqueNm;
      const stageOutputTorque = stageInputTorque * stageRatio * stageEff;

      // Power = Torque (Nm) * w (rad/s)
      const wIn = (stageInputSpeed * 2 * Math.PI) / 60;
      const wOut = (stageOutputSpeed * 2 * Math.PI) / 60;

      const stageInputPower = stageInputTorque * wIn;
      const stageOutputPower = stageOutputTorque * wOut;

      const bearingInterface: BearingInterface = {
        bearingId: `BRG-STG${stageIdx}`,
        modelNumber: stageOpt.bearingModel || 'SKF-6004-2RSH',
        boreDiameterMm: driverGear.pitchDiameter * 0.3,
        outerDiameterMm: driverGear.pitchDiameter * 0.5,
        loadCapacityN: 12500
      };

      gearStages.push({
        stageId,
        stageIndex: stageIdx,
        stageType,
        driverGear,
        drivenGear,
        bearingInterface,
        stageRatio,
        stageEfficiency: stageEff,
        inputSpeed: stageInputSpeed,
        outputSpeed: stageOutputSpeed,
        inputTorque: stageInputTorque,
        outputTorque: stageOutputTorque,
        inputPower: stageInputPower,
        outputPower: stageOutputPower,
        direction: stageDirection
      });

      // Accumulate
      totalRatio *= stageRatio;
      totalEfficiency *= stageEff;
      overallDirection *= stageDirection;

      currentSpeedRpm = stageOutputSpeed;
      currentTorqueNm = stageOutputTorque;

      totalMass += driverGear.mass + drivenGear.mass;
      totalIzz += driverGear.inertia.Izz + drivenGear.inertia.Izz;
    });

    const inputShaftDiameter = options.inputShaftDiameterMm || 20;
    const outputShaftDiameter = options.outputShaftDiameterMm || 30;

    const inputShaft: ShaftInterface = {
      shaftId: `${transmissionId}-SHF-IN`,
      diameterMm: inputShaftDiameter,
      lengthMm: 80,
      speedRpm: options.inputSpeedRpm,
      torqueNm: options.inputTorqueNm,
      material
    };

    const outputShaft: ShaftInterface = {
      shaftId: `${transmissionId}-SHF-OUT`,
      diameterMm: outputShaftDiameter,
      lengthMm: 100,
      speedRpm: currentSpeedRpm,
      torqueNm: currentTorqueNm,
      material
    };

    const wInTotal = (options.inputSpeedRpm * 2 * Math.PI) / 60;
    const wOutTotal = (currentSpeedRpm * 2 * Math.PI) / 60;

    const inputPower = options.inputTorqueNm * wInTotal;
    const outputPower = currentTorqueNm * wOutTotal;

    const primaryType = options.type || (options.stages.length > 1 ? 'MULTI_STAGE' : options.stages[0]?.stageType || 'SPUR');

    return {
      transmissionId,
      name,
      type: primaryType as TransmissionType,
      jointId,
      inputShaft,
      outputShaft,
      inputSpeed: options.inputSpeedRpm,
      outputSpeed: currentSpeedRpm,
      inputTorque: options.inputTorqueNm,
      outputTorque: currentTorqueNm,
      ratio: totalRatio,
      efficiency: totalEfficiency,
      power: inputPower,
      inputPower,
      outputPower,
      direction: overallDirection,
      stageCount: options.stages.length,
      gearStages,
      material,
      revision,
      totalMassKg: Math.round(totalMass * 10000) / 10000,
      overallInertiaKgM2: {
        Ixx: Math.round((totalIzz * 0.5) * 1e7) / 1e7,
        Iyy: Math.round((totalIzz * 0.5) * 1e7) / 1e7,
        Izz: Math.round(totalIzz * 1e7) / 1e7
      }
    };
  }

  /**
   * Generates a complete transmission evaluation result with validation, joint integration, provenance, and evidence package.
   */
  public static generateTransmission(
    transmission: TransmissionDefinition,
    overrideTimestamp?: string
  ): TransmissionGenerationResult {
    const timestamp = overrideTimestamp ?? new Date().toISOString();

    // 1. Validate Transmission
    const validation = RobotTransmissionValidator.validateTransmission(transmission);

    // 2. Generate Joint Output Interface (consumable by DOF, Kinematics, Dynamics, Joint Loads)
    const jointOutput: TransmissionJointOutput = {
      jointId: transmission.jointId || 'J_UNSPECIFIED',
      jointOutputSpeedRpm: transmission.outputSpeed,
      jointOutputTorqueNm: transmission.outputTorque,
      jointOutputPowerW: transmission.outputPower,
      transmissionRatio: transmission.ratio,
      transmissionEfficiency: transmission.efficiency,
      direction: transmission.direction
    };

    // 3. Construct Provenance
    const provenance: TransmissionProvenanceRecord = {
      who: 'SECP_TRANSMISSION_ENGINE',
      what: 'MECHANICAL_TRANSMISSION_EVALUATION',
      when: timestamp,
      source: this.PROVENANCE_SOURCE,
      version: transmission.revision,
      input: {
        transmissionId: transmission.transmissionId,
        inputSpeedRpm: transmission.inputSpeed,
        inputTorqueNm: transmission.inputTorque,
        stageCount: transmission.stageCount,
        stages: transmission.gearStages.map((s) => ({
          stageId: s.stageId,
          driverTeeth: s.driverGear.teethCount,
          drivenTeeth: s.drivenGear.teethCount,
          module: s.driverGear.module,
          stageRatio: s.stageRatio,
          stageEfficiency: s.stageEfficiency
        }))
      },
      process: 'ISO_21771_POWER_TORQUE_SPEED_PROPAGATION',
      output: {
        totalRatio: transmission.ratio,
        totalEfficiency: transmission.efficiency,
        outputSpeedRpm: transmission.outputSpeed,
        outputTorqueNm: transmission.outputTorque,
        outputPowerW: transmission.outputPower
      }
    };

    // 4. Test Verification Checks
    const ratioCheck = Math.abs(transmission.ratio - transmission.gearStages.reduce((acc, s) => acc * s.stageRatio, 1.0)) < 1e-4;
    const expectedOutputSpeed = transmission.inputSpeed / transmission.ratio;
    const speedCheck = Math.abs(transmission.outputSpeed - expectedOutputSpeed) < 1e-3;
    const expectedOutputTorque = transmission.inputTorque * transmission.ratio * transmission.efficiency;
    const torqueCheck = Math.abs(transmission.outputTorque - expectedOutputTorque) < 1e-2;
    const powerConservationCheck = transmission.outputPower <= transmission.inputPower + 1e-6;

    const verdict: 'PASS' | 'FAIL' = validation.valid ? 'PASS' : 'FAIL';

    // 5. Construct Evidence Package
    const baseEvidencePackage = {
      transmissionId: transmission.transmissionId,
      jointId: transmission.jointId,
      revision: transmission.revision,
      gearParameters: {
        stageCount: transmission.stageCount,
        gearStages: transmission.gearStages.map((s) => ({
          stageId: s.stageId,
          driverTeeth: s.driverGear.teethCount,
          drivenTeeth: s.drivenGear.teethCount,
          module: s.driverGear.module,
          stageRatio: s.stageRatio,
          stageEfficiency: s.stageEfficiency
        }))
      },
      material: transmission.material,
      inputSpeed: transmission.inputSpeed,
      inputTorque: transmission.inputTorque,
      inputPower: transmission.inputPower,
      gearRatio: transmission.ratio,
      efficiency: transmission.efficiency,
      outputSpeed: transmission.outputSpeed,
      outputTorque: transmission.outputTorque,
      outputPower: transmission.outputPower,
      validationResults: { ...validation, timestamp },
      testResults: {
        ratioCheck,
        speedCheck,
        torqueCheck,
        powerConservationCheck
      },
      provenance,
      timestamp,
      evidenceHash: '',
      verdict
    };

    const evidenceHash = EvidenceIntegrityService.computeHash({
      ...baseEvidencePackage,
      evidenceHash: ''
    });

    const fullEvidencePackage: TransmissionEvidencePackage = {
      ...baseEvidencePackage,
      evidenceHash
    };

    return {
      transmission,
      jointOutput,
      validation: { ...validation, timestamp },
      provenance,
      evidencePackage: fullEvidencePackage,
      evidenceHash,
      verdict
    };
  }

  /**
   * Verifies the cryptographic signature and integrity of a TransmissionEvidencePackage
   */
  public static verifyEvidencePackage(pkg: TransmissionEvidencePackage): {
    isValid: boolean;
    computedHash: string;
    expectedHash: string;
  } {
    const payloadToVerify = {
      ...pkg,
      evidenceHash: ''
    };
    const computedHash = EvidenceIntegrityService.computeHash(payloadToVerify);
    return {
      isValid: computedHash === pkg.evidenceHash,
      computedHash,
      expectedHash: pkg.evidenceHash
    };
  }
}
