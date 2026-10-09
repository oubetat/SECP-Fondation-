import { describe, expect, it } from 'vitest';
import { RobotTransmissionEngine } from '../robot/RobotTransmissionEngine';
import { RobotTransmissionValidator } from '../robot/RobotTransmissionValidator';
import { EPC040Verifier } from '../robot/EPC040Verifier';
import { TransmissionDefinition } from '../robot/RobotTransmissionTypes';

describe('EPC-040 — Transmission & Gear Model Verification Suite', () => {
  it('1. Simple Gear Ratio — Driver 20T, Driven 100T yields Ratio = 5', () => {
    const trDef = RobotTransmissionEngine.createTransmission({
      inputSpeedRpm: 3000,
      inputTorqueNm: 10,
      stages: [{ driverTeeth: 20, drivenTeeth: 100, module: 2.0 }]
    });

    const result = RobotTransmissionEngine.generateTransmission(trDef);
    expect(result.transmission.ratio).toBe(5.0);
    expect(result.transmission.gearStages[0].stageRatio).toBe(5.0);
  });

  it('2. Speed Reduction — Input 3000 RPM / Ratio 5 yields Output Speed = 600 RPM', () => {
    const trDef = RobotTransmissionEngine.createTransmission({
      inputSpeedRpm: 3000,
      inputTorqueNm: 10,
      stages: [{ driverTeeth: 20, drivenTeeth: 100, module: 2.0 }]
    });

    const result = RobotTransmissionEngine.generateTransmission(trDef);
    expect(result.transmission.outputSpeed).toBe(600.0);
  });

  it('3. Torque Multiplication — Input 10 Nm * Ratio 5 * Eff 1.0 yields Output Torque = 50 Nm', () => {
    const trDef = RobotTransmissionEngine.createTransmission({
      inputSpeedRpm: 3000,
      inputTorqueNm: 10,
      stages: [{ driverTeeth: 20, drivenTeeth: 100, module: 2.0, stageEfficiency: 1.0 }]
    });

    const result = RobotTransmissionEngine.generateTransmission(trDef);
    expect(result.transmission.outputTorque).toBe(50.0);
  });

  it('4. Efficiency — Input 10 Nm * Ratio 5 * Eff 0.9 yields Output Torque = 45 Nm', () => {
    const trDef = RobotTransmissionEngine.createTransmission({
      inputSpeedRpm: 3000,
      inputTorqueNm: 10,
      stages: [{ driverTeeth: 20, drivenTeeth: 100, module: 2.0, stageEfficiency: 0.9 }]
    });

    const result = RobotTransmissionEngine.generateTransmission(trDef);
    expect(result.transmission.outputTorque).toBe(45.0);
  });

  it('5. Power Conservation — OutputPower <= InputPower and OutputPower ≈ InputPower * Efficiency', () => {
    const trDef = RobotTransmissionEngine.createTransmission({
      inputSpeedRpm: 3000,
      inputTorqueNm: 10,
      stages: [{ driverTeeth: 20, drivenTeeth: 100, module: 2.0, stageEfficiency: 0.92 }]
    });

    const result = RobotTransmissionEngine.generateTransmission(trDef);
    expect(result.transmission.outputPower).toBeLessThanOrEqual(result.transmission.inputPower);
    expect(result.transmission.outputPower).toBeCloseTo(result.transmission.inputPower * 0.92, 1);
  });

  it('6. Multi-stage Transmission — Stage 1 (3x) * Stage 2 (4x) yields Total Ratio = 12', () => {
    const trDef = RobotTransmissionEngine.createTransmission({
      inputSpeedRpm: 3600,
      inputTorqueNm: 5,
      stages: [
        { driverTeeth: 20, drivenTeeth: 60, module: 1.5, stageEfficiency: 0.98 },
        { driverTeeth: 15, drivenTeeth: 60, module: 2.0, stageEfficiency: 0.95 }
      ]
    });

    const result = RobotTransmissionEngine.generateTransmission(trDef);
    expect(result.transmission.stageCount).toBe(2);
    expect(result.transmission.ratio).toBe(12.0);
    expect(result.transmission.efficiency).toBeCloseTo(0.98 * 0.95, 4);
    expect(result.transmission.outputSpeed).toBe(300.0);
    expect(result.transmission.outputTorque).toBeCloseTo(5 * 12 * (0.98 * 0.95), 2);
  });

  it('7. Parametric Update — Changing driven teeth recalculates ratio, speed, torque, and power', () => {
    const initialDef = RobotTransmissionEngine.createTransmission({
      inputSpeedRpm: 3000,
      inputTorqueNm: 10,
      stages: [{ driverTeeth: 20, drivenTeeth: 100, module: 2.0 }]
    });
    const result1 = RobotTransmissionEngine.generateTransmission(initialDef);

    const updatedDef = RobotTransmissionEngine.createTransmission({
      inputSpeedRpm: 3000,
      inputTorqueNm: 10,
      stages: [{ driverTeeth: 20, drivenTeeth: 120, module: 2.0 }] // Driven updated to 120
    });
    const result2 = RobotTransmissionEngine.generateTransmission(updatedDef);

    expect(result1.transmission.ratio).toBe(5.0);
    expect(result2.transmission.ratio).toBe(6.0);

    expect(result1.transmission.outputSpeed).toBe(600.0);
    expect(result2.transmission.outputSpeed).toBe(500.0);

    expect(result1.transmission.outputTorque).toBe(49.0); // with default 0.98 eff
    expect(result2.transmission.outputTorque).toBe(58.8);
  });

  it('8. Invalid Configuration — Fails validation for invalid physical parameters', () => {
    const trDef = RobotTransmissionEngine.createTransmission({
      inputSpeedRpm: 3000,
      inputTorqueNm: 10,
      stages: [{ driverTeeth: 20, drivenTeeth: 100, module: 2.0 }]
    });

    const invalidEff: TransmissionDefinition = {
      ...trDef,
      efficiency: 1.5 // > 1.0 invalid
    };

    const valReport = RobotTransmissionValidator.validateTransmission(invalidEff);
    expect(valReport.valid).toBe(false);
    expect(valReport.issues.some((i) => i.field === 'efficiency')).toBe(true);
  });

  it('9. Material & Mass Integration — Gears retrieve material properties and derive mass/inertia', () => {
    const trDef = RobotTransmissionEngine.createTransmission({
      material: 'CASE_HARDENED_16MNCR5',
      inputSpeedRpm: 1500,
      inputTorqueNm: 20,
      stages: [{ driverTeeth: 20, drivenTeeth: 80, module: 2.5 }]
    });

    const result = RobotTransmissionEngine.generateTransmission(trDef);
    const driver = result.transmission.gearStages[0].driverGear;

    expect(driver.material).toBe('CASE_HARDENED_16MNCR5');
    expect(driver.mass).toBeGreaterThan(0);
    expect(driver.inertia.Izz).toBeGreaterThan(0);
    expect(result.transmission.totalMassKg).toBeGreaterThan(0);
  });

  it('10. Evidence Generation & Verification — Signed SHA-256 evidence package', () => {
    const trDef = RobotTransmissionEngine.createTransmission({
      inputSpeedRpm: 2000,
      inputTorqueNm: 15,
      stages: [{ driverTeeth: 25, drivenTeeth: 75, module: 2.0 }]
    });

    const result = RobotTransmissionEngine.generateTransmission(trDef);
    expect(result.evidenceHash).toBeDefined();
    expect(result.evidenceHash.length).toBe(64);

    const verifyResult = RobotTransmissionEngine.verifyEvidencePackage(result.evidencePackage);
    expect(verifyResult.isValid).toBe(true);
  });

  it('11. Reproducibility — Bit-identical evidence hash across independent executions', () => {
    const trDef = RobotTransmissionEngine.createTransmission({
      inputSpeedRpm: 2000,
      inputTorqueNm: 15,
      stages: [{ driverTeeth: 25, drivenTeeth: 75, module: 2.0 }]
    });

    const fixedTs = '2026-09-03T00:00:00.000Z';
    const run1 = RobotTransmissionEngine.generateTransmission(trDef, fixedTs);
    const run2 = RobotTransmissionEngine.generateTransmission(trDef, fixedTs);

    expect(run1.evidenceHash).toBe(run2.evidenceHash);
    expect(run1.transmission.outputTorque).toBe(run2.transmission.outputTorque);
  });

  it('12. Full EPC-040 Acceptance Gate Verification', () => {
    const gateReport = EPC040Verifier.runVerification();
    expect(gateReport.epc).toBe('EPC-040');
    expect(gateReport.verdict).toBe('PASS');
    expect(gateReport.summary.failedChecks).toBe(0);
    expect(gateReport.summary.passedChecks).toBeGreaterThanOrEqual(13);
  });
});
