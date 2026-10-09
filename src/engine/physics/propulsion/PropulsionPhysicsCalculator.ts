/**
 * SECP Core Physics Engine — Propulsion Physics Calculator
 * General, domain-neutral physics solver for electrical motor models,
 * aerodynamic propeller thrust & torque models, electromechanical coupling,
 * efficiency, limit enforcement, and analytical verification.
 */

import {
  Motor,
  Propeller,
  PropulsionOperatingPoint,
  PropulsionEnvironment,
  ThrustResult,
  TorqueResult,
  PowerResult,
  EfficiencyResult,
  SweepPointResult,
  OperatingPointSweepResults,
  AnalyticalPropulsionValidationReport
} from './PropulsionPhysicsTypes';
import { PropulsionUnitConverter } from './PropulsionUnitConverter';

export class PropulsionPhysicsCalculator {

  /**
   * Calculates Electrical Power P_elec = V * I (Watts).
   */
  public static computeElectricalPower(voltage: number, current: number): number {
    if (voltage < 0 || current < 0) {
      throw new Error('NONPHYSICAL_INPUT: Voltage and Current must be non-negative');
    }
    return voltage * current;
  }

  /**
   * Calculates Motor Electromechanical Torque tau = Kt * I (N·m).
   */
  public static computeMotorElectromechanicalTorque(Kt: number | 'UNKNOWN', current: number): number {
    if (Kt === 'UNKNOWN' || typeof Kt !== 'number') {
      return 0; // Unknown or uncalculated Kt
    }
    if (current < 0) {
      throw new Error('NONPHYSICAL_INPUT: Motor current must be non-negative');
    }
    return Kt * current;
  }

  /**
   * Calculates Propeller Aerodynamic Thrust T = Ct * rho * n^2 * D^4 (N).
   * where n = rps = RPM / 60, D = diameter in meters, rho = air density in kg/m³.
   */
  public static computePropellerThrust(
    Ct: number,
    airDensity: number,
    rpm: number,
    diameterM: number
  ): ThrustResult {
    // Nonphysical validation checks
    if (airDensity <= 0) {
      return {
        thrustN: 0,
        thrustKgf: 0,
        Ct,
        airDensity,
        rotationalSpeedRps: rpm / 60,
        diameter: diameterM,
        formulaUsed: 'T = Ct * rho * n^2 * D^4',
        isValid: false,
        validationMessage: 'NONPHYSICAL_ENVIRONMENT: Air density must be strictly positive (> 0)'
      };
    }
    if (rpm < 0 || isNaN(rpm) || !isFinite(rpm)) {
      return {
        thrustN: 0,
        thrustKgf: 0,
        Ct,
        airDensity,
        rotationalSpeedRps: 0,
        diameter: diameterM,
        formulaUsed: 'T = Ct * rho * n^2 * D^4',
        isValid: false,
        validationMessage: 'NONPHYSICAL_SPEED: RPM must be a finite non-negative number'
      };
    }
    if (diameterM <= 0 || isNaN(diameterM) || !isFinite(diameterM)) {
      return {
        thrustN: 0,
        thrustKgf: 0,
        Ct,
        airDensity,
        rotationalSpeedRps: rpm / 60,
        diameter: diameterM,
        formulaUsed: 'T = Ct * rho * n^2 * D^4',
        isValid: false,
        validationMessage: 'NONPHYSICAL_GEOMETRY: Propeller diameter must be positive'
      };
    }

    const n = PropulsionUnitConverter.rpmToRps(rpm);
    const thrustN = Ct * airDensity * Math.pow(n, 2) * Math.pow(diameterM, 4);
    const thrustKgf = PropulsionUnitConverter.newtonToKgf(thrustN);

    return {
      thrustN,
      thrustKgf,
      Ct,
      airDensity,
      rotationalSpeedRps: n,
      diameter: diameterM,
      formulaUsed: 'T = Ct * rho * n^2 * D^4',
      isValid: thrustN >= 0 && isFinite(thrustN)
    };
  }

  /**
   * Calculates Propeller Aerodynamic Torque Q = Cq * rho * n^2 * D^5 (N·m).
   */
  public static computePropellerTorque(
    Cq: number,
    airDensity: number,
    rpm: number,
    diameterM: number,
    Kt: number | 'UNKNOWN' = 'UNKNOWN',
    current: number = 0
  ): TorqueResult {
    if (airDensity <= 0 || rpm < 0 || diameterM <= 0 || isNaN(rpm) || isNaN(airDensity)) {
      return {
        torqueNm: 0,
        Cq,
        airDensity,
        rotationalSpeedRps: rpm / 60,
        diameter: diameterM,
        motorElectromechanicalTorqueNm: 0,
        formulaUsed: 'Q = Cq * rho * n^2 * D^5',
        isValid: false
      };
    }

    const n = PropulsionUnitConverter.rpmToRps(rpm);
    const torqueNm = Cq * airDensity * Math.pow(n, 2) * Math.pow(diameterM, 5);
    const motorTorque = this.computeMotorElectromechanicalTorque(Kt, current);

    return {
      torqueNm,
      Cq,
      airDensity,
      rotationalSpeedRps: n,
      diameter: diameterM,
      motorElectromechanicalTorqueNm: motorTorque,
      formulaUsed: 'Q = Cq * rho * n^2 * D^5',
      isValid: torqueNm >= 0 && isFinite(torqueNm)
    };
  }

  /**
   * Calculates Mechanical Power P_mech = Q * omega (Watts).
   */
  public static computeMechanicalPower(torqueNm: number, rpm: number): number {
    const omega = PropulsionUnitConverter.rpmToRadPerSec(rpm);
    return torqueNm * omega;
  }

  /**
   * Calculates Thrust Power P_thrust = T * V_climb (Watts).
   */
  public static computeThrustPower(thrustN: number, vClimbMps: number = 0): number {
    return thrustN * vClimbMps;
  }

  /**
   * Computes power results for an operating point.
   */
  public static computePowerResult(
    voltage: number,
    current: number,
    torqueNm: number,
    rpm: number,
    thrustN: number,
    vClimbMps: number = 0
  ): PowerResult {
    const electricalPowerW = this.computeElectricalPower(voltage, current);
    const mechanicalPowerW = this.computeMechanicalPower(torqueNm, rpm);
    const thrustPowerW = this.computeThrustPower(thrustN, vClimbMps);

    const isValid = electricalPowerW >= 0 && mechanicalPowerW >= 0 && isFinite(electricalPowerW) && isFinite(mechanicalPowerW);

    return {
      electricalPowerW,
      mechanicalPowerW,
      thrustPowerW,
      formulaUsed: 'P_elec = V*I, P_mech = Q*omega, P_thrust = T*V_climb',
      isValid
    };
  }

  /**
   * Calculates propulsion efficiency eta = P_mech / P_elec.
   * Enforces 0 < eta <= 1 physical consistency requirement.
   */
  public static computeEfficiency(mechanicalPowerW: number, electricalPowerW: number): EfficiencyResult {
    if (electricalPowerW <= 0 || isNaN(electricalPowerW) || !isFinite(electricalPowerW)) {
      return {
        motorElectricalEfficiency: 0,
        overallPropulsionEfficiency: 0,
        isValid: false,
        nonphysicalError: 'ZERO_OR_INVALID_ELECTRICAL_POWER'
      };
    }

    const eta = mechanicalPowerW / electricalPowerW;

    if (eta > 1.0) {
      return {
        motorElectricalEfficiency: eta,
        overallPropulsionEfficiency: eta,
        isValid: false,
        nonphysicalError: `NONPHYSICAL_EFFICIENCY: Calculated efficiency eta = ${(eta * 100).toFixed(2)}% exceeds 100% (violates Conservation of Energy)`
      };
    }

    if (eta < 0) {
      return {
        motorElectricalEfficiency: eta,
        overallPropulsionEfficiency: eta,
        isValid: false,
        nonphysicalError: `NONPHYSICAL_EFFICIENCY: Calculated efficiency eta = ${eta} is negative`
      };
    }

    return {
      motorElectricalEfficiency: eta,
      overallPropulsionEfficiency: eta,
      isValid: true
    };
  }

  /**
   * Validates motor and propeller operational limits.
   */
  public static validateLimits(
    motor: Motor,
    propeller: Propeller,
    operatingPoint: PropulsionOperatingPoint,
    thrustN: number,
    electricalPowerW: number
  ): {
    isVoltageValid: boolean;
    isCurrentValid: boolean;
    isRpmValid: boolean;
    isPowerValid: boolean;
    isTipSpeedValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    const isVoltageValid = operatingPoint.voltage >= motor.voltageRange.min && operatingPoint.voltage <= motor.voltageRange.max;
    if (!isVoltageValid) {
      warnings.push(`Voltage ${operatingPoint.voltage}V outside motor range [${motor.voltageRange.min}V, ${motor.voltageRange.max}V]`);
    }

    const isCurrentValid = operatingPoint.current <= motor.currentLimit;
    if (!isCurrentValid) {
      warnings.push(`Current ${operatingPoint.current}A exceeds motor continuous limit ${motor.currentLimit}A`);
    }

    const isRpmValid = operatingPoint.rpm >= propeller.operatingRange.minRpm && operatingPoint.rpm <= propeller.operatingRange.maxRpm;
    if (!isRpmValid) {
      warnings.push(`RPM ${operatingPoint.rpm} outside propeller range [${propeller.operatingRange.minRpm}, ${propeller.operatingRange.maxRpm}]`);
    }

    const isPowerValid = electricalPowerW <= motor.powerLimit;
    if (!isPowerValid) {
      warnings.push(`Electrical power ${electricalPowerW.toFixed(1)}W exceeds motor power limit ${motor.powerLimit}W`);
    }

    const tipSpeedMps = PropulsionUnitConverter.computeTipSpeedMps(operatingPoint.rpm, propeller.diameter);
    const isTipSpeedValid = tipSpeedMps <= propeller.operatingRange.maxTipSpeedMps;
    if (!isTipSpeedValid) {
      warnings.push(`Propeller tip speed ${tipSpeedMps.toFixed(1)} m/s exceeds max limit ${propeller.operatingRange.maxTipSpeedMps} m/s`);
    }

    return {
      isVoltageValid,
      isCurrentValid,
      isRpmValid,
      isPowerValid,
      isTipSpeedValid,
      warnings
    };
  }

  /**
   * Executes an Operating Point Sweep across a specified RPM range.
   */
  public static executeRpmSweep(
    motor: Motor,
    propeller: Propeller,
    environment: PropulsionEnvironment,
    rpmStart: number,
    rpmEnd: number,
    steps: number,
    fixedVoltage: number
  ): OperatingPointSweepResults {
    const points: SweepPointResult[] = [];
    const stepSize = steps > 1 ? (rpmEnd - rpmStart) / (steps - 1) : 0;

    let maxThrustN = 0;
    let maxPowerW = 0;
    let peakEfficiency = 0;

    for (let i = 0; i < steps; i++) {
      const rpm = rpmStart + i * stepSize;
      // Estimate current from voltage, Kv, resistance, or proportional electrical draw
      const idealRpm = fixedVoltage * motor.Kv;
      const backEmf = rpm / motor.Kv;
      const current = Math.max(motor.noLoadCurrent, (fixedVoltage - backEmf) / motor.resistance);

      const thrustRes = this.computePropellerThrust(propeller.Ct, environment.airDensity, rpm, propeller.diameter);
      const torqueRes = this.computePropellerTorque(propeller.Cq, environment.airDensity, rpm, propeller.diameter, motor.Kt, current);
      const elecPower = this.computeElectricalPower(fixedVoltage, current);
      const mechPower = this.computeMechanicalPower(torqueRes.torqueNm, rpm);
      const effRes = this.computeEfficiency(mechPower, elecPower);
      const tipSpeed = PropulsionUnitConverter.computeTipSpeedMps(rpm, propeller.diameter);

      const isValid = thrustRes.isValid && torqueRes.isValid && effRes.isValid && current <= motor.currentLimit;

      if (thrustRes.thrustN > maxThrustN) maxThrustN = thrustRes.thrustN;
      if (elecPower > maxPowerW) maxPowerW = elecPower;
      if (effRes.isValid && effRes.overallPropulsionEfficiency > peakEfficiency) {
        peakEfficiency = effRes.overallPropulsionEfficiency;
      }

      points.push({
        rpm,
        voltage: fixedVoltage,
        current,
        thrustN: thrustRes.thrustN,
        torqueNm: torqueRes.torqueNm,
        electricalPowerW: elecPower,
        mechanicalPowerW: mechPower,
        efficiency: effRes.overallPropulsionEfficiency,
        tipSpeedMps: tipSpeed,
        isValid
      });
    }

    const provenanceHash = `SWEEP-HASH-${Math.abs(rpmStart ^ rpmEnd ^ Math.round(fixedVoltage * 1000)).toString(16)}`;

    return {
      sweepId: `SWEEP-RPM-${rpmStart}-${rpmEnd}`,
      environment,
      points,
      maxThrustN,
      maxPowerW,
      peakEfficiency,
      provenanceHash
    };
  }

  /**
   * Executes Analytical Validation against an exact reference case.
   * Compares SECP calculated values against known analytical solutions.
   */
  public static validateAnalyticalFixture(
    fixtureName: string,
    Ct: number,
    Cq: number,
    rho: number,
    rpm: number,
    diameterM: number,
    expectedThrustN: number,
    expectedTorqueNm: number,
    tolerance: number = 1e-4
  ): AnalyticalPropulsionValidationReport {
    const thrustRes = this.computePropellerThrust(Ct, rho, rpm, diameterM);
    const torqueRes = this.computePropellerTorque(Cq, rho, rpm, diameterM);
    const secpMechPowerW = this.computeMechanicalPower(torqueRes.torqueNm, rpm);

    const expectedOmega = PropulsionUnitConverter.rpmToRadPerSec(rpm);
    const expectedMechPowerW = expectedTorqueNm * expectedOmega;

    const thrustErrorAbs = Math.abs(thrustRes.thrustN - expectedThrustN);
    const thrustErrorRel = expectedThrustN !== 0 ? thrustErrorAbs / expectedThrustN : thrustErrorAbs;

    const torqueErrorAbs = Math.abs(torqueRes.torqueNm - expectedTorqueNm);
    const torqueErrorRel = expectedTorqueNm !== 0 ? torqueErrorAbs / expectedTorqueNm : torqueErrorAbs;

    const powerErrorAbs = Math.abs(secpMechPowerW - expectedMechPowerW);
    const powerErrorRel = expectedMechPowerW !== 0 ? powerErrorAbs / expectedMechPowerW : powerErrorAbs;

    const passed = thrustErrorRel <= tolerance && torqueErrorRel <= tolerance && powerErrorRel <= tolerance;

    return {
      fixtureName,
      expectedThrustN,
      secpThrustN: thrustRes.thrustN,
      thrustErrorAbs,
      thrustErrorRel,
      expectedTorqueNm,
      secpTorqueNm: torqueRes.torqueNm,
      torqueErrorAbs,
      torqueErrorRel,
      expectedMechanicalPowerW: expectedMechPowerW,
      secpMechanicalPowerW: secpMechPowerW,
      powerErrorAbs,
      powerErrorRel,
      tolerance,
      passed
    };
  }
}
