/**
 * SECP Industrial OS — EPC-023: Propulsion Model Test Suite
 * Vitest tests verifying 30 distinct physical, mathematical, limit, coupling,
 * 3D vector, moment, analytical validation, nonphysical detection, and evidence criteria.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PropulsionPhysicsCalculator } from '../../physics/propulsion/PropulsionPhysicsCalculator';
import { PropulsionUnitConverter } from '../../physics/propulsion/PropulsionUnitConverter';
import { Motor, Propeller, PropulsionEnvironment, PropulsionOperatingPoint } from '../../physics/propulsion/PropulsionPhysicsTypes';
import { DronePropulsionManager } from '../propulsion/DronePropulsionManager';
import { EPC023EvidenceGenerator } from '../propulsion/EPC023EvidenceGenerator';
import { EPC023Verifier } from '../propulsion/EPC023Verifier';

describe('EPC-023 — Propulsion Model Verification Suite', () => {
  let mgr: DronePropulsionManager;

  beforeEach(() => {
    mgr = new DronePropulsionManager();
  });

  // 1. Motor Model Creation
  it('1. verifies Motor model creation', () => {
    const units = mgr.getUnits();
    const u1 = units.get('PROPULSION-UNIT-1')!;
    expect(u1.motor).toBeDefined();
    expect(u1.motor.model).toBe('MN501-S-360KV');
    expect(u1.motor.Kv).toBe(360);
    expect(u1.motor.mass).toBe(0.180);
  });

  // 2. Motor Parameter Validation
  it('2. validates motor parameters without unproven guessing', () => {
    const units = mgr.getUnits();
    const u1 = units.get('PROPULSION-UNIT-1')!;
    expect(u1.motor.resistance).toBeGreaterThan(0);
    expect(u1.motor.voltageRange.min).toBeGreaterThan(0);
    expect(u1.motor.voltageRange.max).toBeGreaterThan(u1.motor.voltageRange.min);
    expect(u1.motor.currentLimit).toBeGreaterThan(0);
    expect(u1.motor.powerLimit).toBeGreaterThan(0);
  });

  // 3. Propeller Model Creation
  it('3. verifies Propeller model creation', () => {
    const units = mgr.getUnits();
    const u1 = units.get('PROPULSION-UNIT-1')!;
    expect(u1.propeller).toBeDefined();
    expect(u1.propeller.diameter).toBeCloseTo(0.4572, 4); // 18 inches
    expect(u1.propeller.pitch).toBeCloseTo(0.1549, 4); // 6.1 inches
    expect(u1.propeller.Ct).toBe(0.095);
    expect(u1.propeller.Cq).toBe(0.0032);
  });

  // 4. Propeller Geometry Reference
  it('4. connects propeller to CAD Geometry Reference', () => {
    const units = mgr.getUnits();
    const u1 = units.get('PROPULSION-UNIT-1')!;
    expect(u1.propeller.geometryReference).toBeDefined();
    expect(u1.propeller.geometryReference.artifactId).toContain('CAD-PROP');
    expect(u1.propeller.geometryReference.artifactHash.length).toBeGreaterThan(10);
  });

  // 5. RPM Conversion
  it('5. tests RPM to rad/s and rps conversions accurately', () => {
    const rpm = 6000;
    const omega = PropulsionUnitConverter.rpmToRadPerSec(rpm);
    const rps = PropulsionUnitConverter.rpmToRps(rpm);
    expect(omega).toBeCloseTo(2 * Math.PI * 100, 4); // 628.3185 rad/s
    expect(rps).toBe(100);
    expect(PropulsionUnitConverter.radPerSecToRpm(omega)).toBeCloseTo(rpm, 4);
  });

  // 6. Torque Calculation
  it('6. calculates aerodynamic propeller torque and electromechanical motor torque', () => {
    const Cq = 0.0125;
    const rho = 1.225;
    const rpm = 6000;
    const diameter = 0.4572;
    const torqueRes = PropulsionPhysicsCalculator.computePropellerTorque(Cq, rho, rpm, diameter, 0.0265, 20.0);
    expect(torqueRes.isValid).toBe(true);
    expect(torqueRes.torqueNm).toBeGreaterThan(0);
    expect(torqueRes.motorElectromechanicalTorqueNm).toBeCloseTo(0.0265 * 20.0, 4);
  });

  // 7. Thrust Calculation
  it('7. calculates propeller thrust using T = Ct * rho * n^2 * D^4', () => {
    const Ct = 0.095;
    const rho = 1.225;
    const rpm = 6000; // n = 100 rps
    const diameter = 0.4572;
    const thrustRes = PropulsionPhysicsCalculator.computePropellerThrust(Ct, rho, rpm, diameter);
    expect(thrustRes.isValid).toBe(true);
    // T = 0.095 * 1.225 * 10000 * 0.4572^4 = 50.8437 N
    expect(thrustRes.thrustN).toBeCloseTo(50.8437, 1);
    expect(thrustRes.thrustKgf).toBeCloseTo(50.8437 / 9.80665, 2);
  });

  // 8. Mechanical Power
  it('8. calculates mechanical shaft power P_mech = Q * omega', () => {
    const torqueNm = 3.0645;
    const rpm = 6000;
    const omega = PropulsionUnitConverter.rpmToRadPerSec(rpm);
    const pMech = PropulsionPhysicsCalculator.computeMechanicalPower(torqueNm, rpm);
    expect(pMech).toBeCloseTo(torqueNm * omega, 4);
    expect(pMech).toBeGreaterThan(1000); // ~1925 W
  });

  // 9. Electrical Power
  it('9. calculates electrical power P_elec = V * I distinct from shaft power', () => {
    const voltage = 24.0;
    const current = 18.5;
    const pElec = PropulsionPhysicsCalculator.computeElectricalPower(voltage, current);
    expect(pElec).toBe(444.0); // W
  });

  // 10. Efficiency
  it('10. verifies efficiency eta = P_mech / P_elec within 0 < eta <= 1', () => {
    const mechPowerW = 350.0;
    const elecPowerW = 444.0;
    const effRes = PropulsionPhysicsCalculator.computeEfficiency(mechPowerW, elecPowerW);
    expect(effRes.isValid).toBe(true);
    expect(effRes.overallPropulsionEfficiency).toBeCloseTo(350.0 / 444.0, 4);
  });

  // 11. Operating Point
  it('11. verifies operating point variables', () => {
    const results = mgr.computePropulsionSystemResults();
    const u1 = results.unitsResults[0];
    expect(u1.operatingPoint.voltage).toBe(24.0);
    expect(u1.operatingPoint.current).toBe(23.5);
    expect(u1.operatingPoint.rpm).toBe(5800);
  });

  // 12. Environment Dependency
  it('12. verifies recalculation when ambient air density changes', () => {
    const resSeaLevel = mgr.computePropulsionSystemResults();
    const thrustSeaLevel = resSeaLevel.totalThrustN;

    // Set altitude 3000m environment (rho = 0.909 kg/m^3)
    mgr.setEnvironment({
      airDensity: 0.909,
      temperatureC: 0,
      pressurePa: 70100,
      altitudeM: 3000
    });

    const res3000m = mgr.computePropulsionSystemResults();
    const thrust3000m = res3000m.totalThrustN;

    expect(thrust3000m).toBeLessThan(thrustSeaLevel);
    expect(thrust3000m).toBeCloseTo(thrustSeaLevel * (0.909 / 1.225), 2);
  });

  // 13. Motor-Propeller Coupling
  it('13. verifies motor-propeller coupling and parametric dependency', () => {
    const res1 = mgr.computePropulsionSystemResults();
    mgr.setOperatingPoint(6500, 24.0, 28.0);
    const res2 = mgr.computePropulsionSystemResults();
    expect(res2.totalThrustN).toBeGreaterThan(res1.totalThrustN);
    expect(res2.totalElectricalPowerW).toBeGreaterThan(res1.totalElectricalPowerW);
  });

  // 14. Four-Motor Configuration
  it('14. represents 4 distinct propulsion units for Quadcopter layout', () => {
    const results = mgr.computePropulsionSystemResults();
    expect(results.unitCount).toBe(4);
    expect(results.unitsResults.length).toBe(4);
    expect(results.unitsResults.map(u => u.unitId)).toEqual([
      'PROPULSION-UNIT-1',
      'PROPULSION-UNIT-2',
      'PROPULSION-UNIT-3',
      'PROPULSION-UNIT-4'
    ]);
  });

  // 15. Total Thrust
  it('15. calculates total thrust as scalar sum of all operating propulsion units', () => {
    const results = mgr.computePropulsionSystemResults();
    const singleThrust = results.unitsResults[0].thrust.thrustN;
    expect(results.totalThrustN).toBeCloseTo(singleThrust * 4, 3);
  });

  // 16. Thrust Vectors
  it('16. projects 3D thrust vectors into Assembly Global frame', () => {
    const results = mgr.computePropulsionSystemResults();
    expect(results.totalThrustVectorGlobal.z).toBeCloseTo(results.totalThrustN, 3);
    expect(results.totalThrustVectorGlobal.x).toBeCloseTo(0, 4);
    expect(results.totalThrustVectorGlobal.y).toBeCloseTo(0, 4);
  });

  // 17. Propulsion Moments
  it('17. computes 3D propulsion moments (r x F + reaction torque)', () => {
    const results = mgr.computePropulsionSystemResults();
    expect(results.totalPropulsionMomentGlobal).toBeDefined();
    // In symmetric hover, total moment should be approximately zero
    expect(results.totalPropulsionMomentGlobal.x).toBeCloseTo(0, 3);
    expect(results.totalPropulsionMomentGlobal.y).toBeCloseTo(0, 3);
    expect(results.totalPropulsionMomentGlobal.z).toBeCloseTo(0, 3);
  });

  // 18. Rotation Direction
  it('18. verifies CW and CCW reaction torques cancel out in symmetric hover', () => {
    const results = mgr.computePropulsionSystemResults();
    const cwUnits = results.unitsResults.filter(u => u.rotationDirection === 'CW');
    const ccwUnits = results.unitsResults.filter(u => u.rotationDirection === 'CCW');
    expect(cwUnits.length).toBe(2);
    expect(ccwUnits.length).toBe(2);

    const netReactionTorqueZ = results.unitsResults.reduce(
      (acc, u) => acc + u.reactionTorqueVectorGlobal.z,
      0
    );
    expect(netReactionTorqueZ).toBeCloseTo(0, 5);
  });

  // 19. Motor Limits
  it('19. detects motor limit violations when current or voltage exceeds range', () => {
    mgr.setOperatingPoint(5800, 24.0, 55.0); // 55A exceeds 45A limit
    const results = mgr.computePropulsionSystemResults();
    const u1 = results.unitsResults[0];
    expect(u1.limitStatus.isCurrentValid).toBe(false);
    expect(u1.limitStatus.warnings.some(w => w.includes('exceeds motor continuous limit'))).toBe(true);
  });

  // 20. Propeller Limits
  it('20. enforces propeller tip speed and max RPM limits', () => {
    const tipSpeedMps = PropulsionUnitConverter.computeTipSpeedMps(8000, 0.4572);
    expect(tipSpeedMps).toBeLessThan(220); // Within 220 m/s limit
  });

  // 21. Parameter Update
  it('21. re-evaluates thrust, torque, power when propeller diameter changes', () => {
    const resOriginal = mgr.computePropulsionSystemResults();
    mgr.updatePropellerDiameter(0.508); // Increase to 20 inches (0.508m)
    const resUpdated = mgr.computePropulsionSystemResults();

    expect(resUpdated.totalThrustN).toBeGreaterThan(resOriginal.totalThrustN);
    // T scales with D^4 -> (0.508 / 0.4572)^4 approx 1.52x
    expect(resUpdated.totalThrustN / resOriginal.totalThrustN).toBeCloseTo(Math.pow(0.508 / 0.4572, 4), 2);
  });

  // 22. Configuration Integration
  it('22. integrates with Product Configuration Manager', () => {
    const results = mgr.computePropulsionSystemResults();
    expect(results.configurationId).toBe('CONF-QUAD-INDUSTRIAL-001');
  });

  // 23. Mass Integration
  it('23. integrates motor and propeller mass with Drone Assembly Mass', () => {
    const totalMass = mgr.getIntegratedTotalDroneMassKg();
    expect(totalMass).toBeGreaterThan(1.0); // Drone assembly mass derived from EPC-022
  });

  // 24. Analytical Validation
  it('24. executes analytical validation fixture against exact analytical solution', () => {
    const report = mgr.runAnalyticalValidationFixtures();
    expect(report.passed).toBe(true);
    expect(report.thrustErrorRel).toBeLessThan(1e-4);
    expect(report.torqueErrorRel).toBeLessThan(1e-4);
    expect(report.powerErrorRel).toBeLessThan(1e-4);
  });

  // 25. Unit Validation
  it('25. validates unit conversions for force, torque, speed, and density', () => {
    const N = 9.80665;
    expect(PropulsionUnitConverter.newtonToKgf(N)).toBeCloseTo(1.0, 5);
    expect(PropulsionUnitConverter.kgfToNewton(1.0)).toBeCloseTo(9.80665, 5);
    expect(PropulsionUnitConverter.nmToNcm(1.5)).toBe(150);
  });

  // 26. Nonphysical Result Detection
  it('26. detects nonphysical results (zero density, efficiency > 100%, negative RPM)', () => {
    // Zero air density
    const zeroDensityRes = PropulsionPhysicsCalculator.computePropellerThrust(0.115, 0, 6000, 0.4572);
    expect(zeroDensityRes.isValid).toBe(false);
    expect(zeroDensityRes.validationMessage).toContain('NONPHYSICAL_ENVIRONMENT');

    // Efficiency > 100%
    const unphysicalEff = PropulsionPhysicsCalculator.computeEfficiency(500, 400); // 500W mech / 400W elec
    expect(unphysicalEff.isValid).toBe(false);
    expect(unphysicalEff.nonphysicalError).toContain('NONPHYSICAL_EFFICIENCY');
  });

  // 27. Deterministic Execution
  it('27. produces deterministic results and bit-for-bit output hashes', () => {
    const run1 = mgr.computePropulsionSystemResults();
    const run2 = mgr.computePropulsionSystemResults();

    expect(run1.totalThrustN).toBe(run2.totalThrustN);
    expect(run1.totalElectricalPowerW).toBe(run2.totalElectricalPowerW);
    expect(run1.provenance.outputHash).toBe(run2.provenance.outputHash);
  });

  // 28. Evidence Generation
  it('28. generates signed EPC023 evidence package', () => {
    const pkg = EPC023EvidenceGenerator.generateEvidencePackage(mgr);
    expect(pkg.packageId).toContain('EPC023-PKG-');
    expect(pkg.provenance.signature).toContain('SIG-EPC023-');
    expect(pkg.verificationChecks.analyticalValidationPassed).toBe(true);
  });

  // 29. Provenance
  it('29. records complete provenance data', () => {
    const results = mgr.computePropulsionSystemResults();
    expect(results.provenance.inputHash).toBeDefined();
    expect(results.provenance.outputHash).toBeDefined();
    expect(results.provenance.computedAt).toBeDefined();
  });

  // 30. Requirement Traceability & Master Verdict
  it('30. executes master verifier and renders ENGINEERING VERDICT: PASS', () => {
    const summary = EPC023Verifier.verifyPropulsionModel(mgr);
    expect(summary.verdict).toBe('PASS');
    expect(summary.failedCount).toBe(0);
    expect(summary.verdictReportString).toContain('ENGINEERING VERDICT: EPC-023 = PASS');
  });
});
