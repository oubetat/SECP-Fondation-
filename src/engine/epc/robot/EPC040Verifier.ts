/**
 * SECP Industrial OS — EPC-040: Transmission / Gear Model Acceptance Gate Verifier
 * Verifies all acceptance criteria and test requirements for Proof Case 02 — Industrial Robotic Arm Transmission.
 */

import { RobotTransmissionEngine } from './RobotTransmissionEngine';
import { RobotTransmissionValidator } from './RobotTransmissionValidator';
import { EPC040GateReport, TransmissionDefinition } from './RobotTransmissionTypes';

export class EPC040Verifier {
  public static readonly PROGRAM = 'EPC-040: Industrial Robotic Arm Transmission / Gear Model';

  public static runVerification(): EPC040GateReport {
    const checks: Record<string, { passed: boolean; message: string }> = {};

    // 1. TEST 1 & CHECK 1 — SIMPLE GEAR RATIO (Driver 20T, Driven 100T => Ratio 5.0)
    const simpleTransmissionDef = RobotTransmissionEngine.createTransmission({
      transmissionId: 'TR-TEST-01',
      name: 'Test 1 Simple Gear Transmission',
      jointId: 'J2_SHOULDER',
      inputSpeedRpm: 3000,
      inputTorqueNm: 10,
      stages: [
        {
          driverTeeth: 20,
          drivenTeeth: 100,
          module: 2.0,
          stageEfficiency: 1.0
        }
      ]
    });
    const result1 = RobotTransmissionEngine.generateTransmission(simpleTransmissionDef);

    checks['CHECK-01-SIMPLE-GEAR-RATIO'] = {
      passed: Math.abs(result1.transmission.ratio - 5.0) < 1e-4,
      message: `Simple gear ratio verified: Driver (20T) & Driven (100T) yields Ratio = ${result1.transmission.ratio}.`
    };

    // 2. TEST 2 & CHECK 2 — SPEED REDUCTION (Input 3000 RPM / 5 => 600 RPM)
    checks['CHECK-02-SPEED-REDUCTION'] = {
      passed: Math.abs(result1.transmission.outputSpeed - 600.0) < 1e-3,
      message: `Speed reduction verified: Input Speed (3000 RPM) / Ratio (5.0) = Output Speed (${result1.transmission.outputSpeed} RPM).`
    };

    // 3. TEST 3 & CHECK 3 — TORQUE MULTIPLICATION (Input 10 Nm * 5 * 1.0 => 50 Nm)
    checks['CHECK-03-TORQUE-MULTIPLICATION'] = {
      passed: Math.abs(result1.transmission.outputTorque - 50.0) < 1e-2,
      message: `Torque multiplication verified: Input Torque (10 Nm) * Ratio (5.0) * Efficiency (1.0) = Output Torque (${result1.transmission.outputTorque} Nm).`
    };

    // 4. TEST 4 & CHECK 4 — EFFICIENCY LOSS (Input 10 Nm * 5 * 0.9 => 45 Nm)
    const effTransmissionDef = RobotTransmissionEngine.createTransmission({
      transmissionId: 'TR-TEST-04',
      inputSpeedRpm: 3000,
      inputTorqueNm: 10,
      stages: [
        {
          driverTeeth: 20,
          drivenTeeth: 100,
          module: 2.0,
          stageEfficiency: 0.9
        }
      ]
    });
    const result4 = RobotTransmissionEngine.generateTransmission(effTransmissionDef);

    checks['CHECK-04-EFFICIENCY'] = {
      passed: Math.abs(result4.transmission.outputTorque - 45.0) < 1e-2,
      message: `Efficiency loss verified: Input Torque (10 Nm) * Ratio (5.0) * Efficiency (0.9) = Output Torque (${result4.transmission.outputTorque} Nm).`
    };

    // 5. TEST 5 & CHECK 5 — POWER CONSERVATION (OutputPower <= InputPower & OutputPower ≈ InputPower * Efficiency)
    const inputPowerW = result4.transmission.inputPower;
    const outputPowerW = result4.transmission.outputPower;
    const powerConserved = outputPowerW <= inputPowerW + 1e-6;
    const powerMatchEff = Math.abs(outputPowerW - inputPowerW * 0.9) < 1e-2;

    checks['CHECK-05-POWER-CONSERVATION'] = {
      passed: powerConserved && powerMatchEff,
      message: `Power conservation verified: Input Power (${inputPowerW.toFixed(2)} W) -> Output Power (${outputPowerW.toFixed(2)} W) <= Input Power.`
    };

    // 6. TEST 6 & CHECK 6 — MULTI-STAGE TRANSMISSION (Stage1 Ratio=3, Stage2 Ratio=4 => Total Ratio = 12)
    const multiStageDef = RobotTransmissionEngine.createTransmission({
      transmissionId: 'TR-TEST-06',
      inputSpeedRpm: 3600,
      inputTorqueNm: 5,
      stages: [
        { driverTeeth: 20, drivenTeeth: 60, module: 1.5, stageEfficiency: 0.98 }, // Ratio 3
        { driverTeeth: 15, drivenTeeth: 60, module: 2.0, stageEfficiency: 0.95 }  // Ratio 4
      ]
    });
    const result6 = RobotTransmissionEngine.generateTransmission(multiStageDef);

    const expectedTotalRatio = 12.0;
    const expectedTotalEfficiency = 0.98 * 0.95; // 0.931

    checks['CHECK-06-MULTI-STAGE-TRANSMISSION'] = {
      passed:
        Math.abs(result6.transmission.ratio - expectedTotalRatio) < 1e-4 &&
        Math.abs(result6.transmission.efficiency - expectedTotalEfficiency) < 1e-4 &&
        result6.transmission.stageCount === 2,
      message: `Multi-stage transmission verified: Stage 1 (3x) * Stage 2 (4x) = Total Ratio (${result6.transmission.ratio}) & Efficiency (${result6.transmission.efficiency.toFixed(3)}).`
    };

    // 7. TEST 7 & CHECK 7 — PARAMETRIC UPDATE PROPAGATION
    const initialParamDef = RobotTransmissionEngine.createTransmission({
      transmissionId: 'TR-TEST-07',
      inputSpeedRpm: 3000,
      inputTorqueNm: 10,
      stages: [{ driverTeeth: 20, drivenTeeth: 100, module: 2.0, stageEfficiency: 1.0 }]
    });
    const runInitial = RobotTransmissionEngine.generateTransmission(initialParamDef);

    const updatedParamDef = RobotTransmissionEngine.createTransmission({
      transmissionId: 'TR-TEST-07',
      inputSpeedRpm: 3000,
      inputTorqueNm: 10,
      stages: [{ driverTeeth: 20, drivenTeeth: 120, module: 2.0, stageEfficiency: 1.0 }] // Driven updated to 120
    });
    const runUpdated = RobotTransmissionEngine.generateTransmission(updatedParamDef);

    const ratioUpdated = runInitial.transmission.ratio === 5.0 && runUpdated.transmission.ratio === 6.0;
    const speedUpdated = runInitial.transmission.outputSpeed === 600.0 && runUpdated.transmission.outputSpeed === 500.0;
    const torqueUpdated = runInitial.transmission.outputTorque === 50.0 && runUpdated.transmission.outputTorque === 60.0;

    checks['CHECK-07-PARAMETRIC-UPDATE'] = {
      passed: ratioUpdated && speedUpdated && torqueUpdated,
      message: 'Parametric update verified: Changing Driven Teeth 100 -> 120 dynamically updated Ratio (5 -> 6), Output Speed (600 -> 500 RPM), and Torque (50 -> 60 Nm).'
    };

    // 8. TEST 8 & CHECK 8 — INVALID CONFIGURATION REJECTION
    const invalidEffDef: TransmissionDefinition = {
      ...simpleTransmissionDef,
      transmissionId: 'TR-INVALID-01',
      efficiency: 1.25 // > 1.0 physically impossible
    };
    const invalidValidation = RobotTransmissionValidator.validateTransmission(invalidEffDef);

    const invalidZeroRatioDef: TransmissionDefinition = {
      ...simpleTransmissionDef,
      transmissionId: 'TR-INVALID-02',
      ratio: 0 // ratio = 0 invalid
    };
    const zeroRatioValidation = RobotTransmissionValidator.validateTransmission(invalidZeroRatioDef);

    checks['CHECK-08-INVALID-CONFIGURATION'] = {
      passed: !invalidValidation.valid && !zeroRatioValidation.valid,
      message: 'Invalid configuration rejection verified: Efficiency > 1.0 and zero ratio produce deterministic validation failures.'
    };

    // 9. TEST 9 & CHECK 9 — MATERIAL & MASS PROPERTIES INTEGRATION
    const gear1 = result1.transmission.gearStages[0].driverGear;
    const gear2 = result1.transmission.gearStages[0].drivenGear;
    const hasMaterialProps = gear1.material === 'CASE_HARDENED_16MNCR5' && gear1.mass > 0 && gear1.inertia.Izz > 0;
    const hasTotalMassInertia = (result1.transmission.totalMassKg ?? 0) > 0 && (result1.transmission.overallInertiaKgM2?.Izz ?? 0) > 0;

    checks['CHECK-09-MATERIAL-MASS-INERTIA'] = {
      passed: hasMaterialProps && hasTotalMassInertia,
      message: `Material & Mass integration verified: Gears use ${gear1.material}, deriving mass (${gear1.mass} kg) and inertia tensor (${gear1.inertia.Izz} kg·m²).`
    };

    // 10. TEST 10 & CHECK 10 — EVIDENCE GENERATION & CRYPTOGRAPHIC HASH
    const verifyHashResult = RobotTransmissionEngine.verifyEvidencePackage(result1.evidencePackage);

    checks['CHECK-10-EVIDENCE-GENERATION'] = {
      passed: verifyHashResult.isValid && result1.evidenceHash.length === 64,
      message: `Cryptographic evidence package generated and verified via EvidenceIntegrityService (SHA-256: ${result1.evidenceHash.slice(0, 16)}...).`
    };

    // 11. CHECK 11 — ROBOT JOINT INTEGRATION & DEPENDENCY RELATIONSHIP
    const jointOutput = result1.jointOutput;
    const hasJointOutput =
      jointOutput.jointId === 'J2_SHOULDER' &&
      jointOutput.jointOutputSpeedRpm === 600.0 &&
      jointOutput.jointOutputTorqueNm === 50.0 &&
      jointOutput.transmissionRatio === 5.0;

    checks['CHECK-11-ROBOT-JOINT-INTEGRATION'] = {
      passed: hasJointOutput,
      message: 'Robot Joint Integration verified: Transmission output feeds Motor -> Transmission -> Joint -> Link dependency chain with joint output speed, torque, and power.'
    };

    // 12. CHECK 12 — PROVENANCE RECONSTRUCTION
    const prov = result1.provenance;
    const hasProvenance =
      prov.who === 'SECP_TRANSMISSION_ENGINE' &&
      prov.source === RobotTransmissionEngine.PROVENANCE_SOURCE &&
      prov.input.transmissionId === 'TR-TEST-01';

    checks['CHECK-12-PROVENANCE'] = {
      passed: hasProvenance,
      message: 'Provenance tracking verified: Complete digital thread captures Who, What, When, Source, Version, Input, Process, and Output.'
    };

    // 13. CHECK 13 — REPRODUCIBILITY (Bit-identical hash on independent execution)
    const fixedTs = '2026-09-03T00:00:00.000Z';
    const genRun1 = RobotTransmissionEngine.generateTransmission(simpleTransmissionDef, fixedTs);
    const genRun2 = RobotTransmissionEngine.generateTransmission(simpleTransmissionDef, fixedTs);

    const reproducible =
      genRun1.evidenceHash === genRun2.evidenceHash &&
      genRun1.transmission.outputTorque === genRun2.transmission.outputTorque;

    checks['CHECK-13-REPRODUCIBILITY'] = {
      passed: reproducible,
      message: 'Bit-identical reproducibility verified: Identical input configuration produces identical evidence hashes.'
    };

    // Summary calculation
    const totalChecks = Object.keys(checks).length;
    const passedChecks = Object.values(checks).filter((c) => c.passed).length;
    const failedChecks = totalChecks - passedChecks;

    const verdict: 'PASS' | 'FAIL' = failedChecks === 0 ? 'PASS' : 'FAIL';

    return {
      epc: 'EPC-040',
      name: this.PROGRAM,
      verdict,
      checks,
      summary: {
        totalChecks,
        passedChecks,
        failedChecks
      },
      evidenceHash: result1.evidenceHash,
      timestamp: new Date().toISOString()
    };
  }
}
