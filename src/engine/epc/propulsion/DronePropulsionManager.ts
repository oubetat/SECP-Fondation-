/**
 * SECP Industrial OS — EPC-023: Industrial Drone Propulsion Manager
 * Manages the propulsion architecture for the Industrial Drone (4-motor Quadcopter),
 * executing real physics calculations for Motor, Propeller, Thrust, Torque, Power,
 * 3D Thrust Vectors, Propulsion Moments, Operating Point Sweeps, and limit validations.
 *
 * STRICT NO-GO RULE: Does not construct a Drone-specific propulsion physics engine.
 * Reuses SECP core PropulsionPhysicsCalculator, PropulsionUnitConverter,
 * DroneMassPropertiesManager, and ProductConfigurationManager.
 */

import {
  Motor,
  Propeller,
  MotorController,
  PropulsionEnvironment,
  PropulsionOperatingPoint,
  SinglePropulsionUnitResult,
  PropulsionSystemResult,
  RotationDirection,
  OperatingPointSweepResults,
  AnalyticalPropulsionValidationReport
} from '../../physics/propulsion/PropulsionPhysicsTypes';
import { PropulsionPhysicsCalculator } from '../../physics/propulsion/PropulsionPhysicsCalculator';
import { PropulsionUnitConverter } from '../../physics/propulsion/PropulsionUnitConverter';
import { Vector3D, Transform3D } from '../../physics/mass/MassPropertiesTypes';
import { DroneMassPropertiesManager } from '../mass/DroneMassPropertiesManager';
import { ProductConfigurationManager } from '../ProductConfigurationManager';

export interface SinglePropulsionUnitConfig {
  unitId: string;
  unitName: string;
  motor: Motor;
  propeller: Propeller;
  position: Vector3D; // Local or Assembly frame position relative to drone center (m)
  transform: Transform3D; // 3D transform/rotation of motor thrust axis
  rotationDirection: RotationDirection; // CW or CCW
  operatingPoint: PropulsionOperatingPoint;
}

export class DronePropulsionManager {
  public readonly systemId = 'EPC023-DRONE-PROPULSION';
  public readonly name = 'Industrial Drone 4-Motor Propulsion System';
  private revision = 'REV-A.1';
  private configurationId = 'CONF-QUAD-INDUSTRIAL-001';

  private massManager: DroneMassPropertiesManager;
  private configManager: ProductConfigurationManager;

  private environment: PropulsionEnvironment = {
    airDensity: 1.225, // kg/m³
    temperatureC: 15, // °C
    pressurePa: 101325, // Pa
    altitudeM: 0 // m
  };

  private units: Map<string, SinglePropulsionUnitConfig> = new Map();
  private calculationCount = 0;
  private lastResult: PropulsionSystemResult | null = null;

  constructor(
    massManager?: DroneMassPropertiesManager,
    configManager?: ProductConfigurationManager
  ) {
    this.massManager = massManager || new DroneMassPropertiesManager();
    this.configManager = configManager || new ProductConfigurationManager();
    this.initializeStandardQuadcopterConfiguration();
  }

  /**
   * Initializes standard Industrial Drone 4-motor propulsion configuration.
   * Unit 1: Front-Right (+X, +Y, +Z), CW
   * Unit 2: Rear-Right (-X, +Y, +Z), CCW
   * Unit 3: Rear-Left (-X, -Y, +Z), CW
   * Unit 4: Front-Left (+X, -Y, +Z), CCW
   */
  public initializeStandardQuadcopterConfiguration(): void {
    const defaultMotor: Motor = {
      motorId: 'MTR-BLDC-501',
      manufacturerReference: 'T-MOTOR-INDUSTRIAL',
      model: 'MN501-S-360KV',
      revision: 'REV-B',
      mass: 0.180, // kg (180 grams)
      dimensions: { diameter: 0.0585, length: 0.0385, dx: 0.0585, dy: 0.0585, dz: 0.0385 },
      Kv: 360,
      Kt: 0.0265, // N·m / A (Kt = 60 / (2 * PI * Kv) = 0.0265)
      resistance: 0.042, // Ohms
      noLoadCurrent: 1.2, // A
      voltageRange: { min: 18.0, max: 50.4 }, // V (6S - 12S LiPo)
      currentLimit: 45.0, // A
      powerLimit: 1200.0, // W
      efficiencyModel: 'FIRST_ORDER_RESISTIVE_COPPER_IRON_LOSS',
      thermalLimits: { maxOperatingTempC: 100 },
      units: { mass: 'kg', voltage: 'V', current: 'A', torque: 'N·m', speed: 'RPM', power: 'W' },
      provenance: {
        source: 'INDUSTRIAL_BENCHMARK_SPEC_MN501S',
        version: '1.0.0',
        computedAt: new Date().toISOString()
      }
    };

    const defaultPropellerCW: Propeller = {
      propellerId: 'PROP-CF-1861-CW',
      revision: 'REV-A',
      diameter: 0.4572, // 18 inches = 0.4572 m
      pitch: 0.1549, // 6.1 inches = 0.1549 m
      bladeCount: 2,
      airfoilReference: 'NACA-4412-MODIFIED',
      rotationDirection: 'CW',
      mass: 0.035, // kg (35 grams)
      material: 'CARBON_FIBER_COMPOSITE',
      geometryReference: {
        artifactId: 'CAD-PROP-1861-CW',
        artifactHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        revision: 'REV-A',
        source: 'ONSHAPE_STEP_MODEL_PROP1861'
      },
      operatingRange: { minRpm: 1000, maxRpm: 8500, maxTipSpeedMps: 220 },
      Ct: 0.095, // Non-dimensional thrust coefficient
      Cq: 0.0032, // Non-dimensional torque coefficient
      units: { mass: 'kg', length: 'm', speed: 'RPM', force: 'N', torque: 'N·m' },
      provenance: {
        source: 'WIND_TUNNEL_MEASURED_PROP1861',
        version: '1.0.0',
        computedAt: new Date().toISOString()
      }
    };

    const defaultPropellerCCW: Propeller = {
      ...defaultPropellerCW,
      propellerId: 'PROP-CF-1861-CCW',
      rotationDirection: 'CCW',
      geometryReference: {
        ...defaultPropellerCW.geometryReference,
        artifactId: 'CAD-PROP-1861-CCW'
      }
    };

    const defaultOperatingPoint: PropulsionOperatingPoint = {
      voltage: 24.0, // V
      current: 23.5, // A
      rpm: 5800, // RPM
      vClimbMps: 0.0,
      environment: this.environment
    };

    // Standard 3D Identity Transform (Z-axis points upwards)
    const identityTransform: Transform3D = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 }
    };

    // Define 4 Propulsion Units
    const unitConfigs: SinglePropulsionUnitConfig[] = [
      {
        unitId: 'PROPULSION-UNIT-1',
        unitName: 'Front-Right Motor/Propeller Assembly',
        motor: { ...defaultMotor, motorId: 'MTR-BLDC-501-U1' },
        propeller: { ...defaultPropellerCW },
        position: { x: 0.25, y: 0.25, z: 0.05 },
        transform: { ...identityTransform, position: { x: 0.25, y: 0.25, z: 0.05 } },
        rotationDirection: 'CW',
        operatingPoint: { ...defaultOperatingPoint }
      },
      {
        unitId: 'PROPULSION-UNIT-2',
        unitName: 'Rear-Right Motor/Propeller Assembly',
        motor: { ...defaultMotor, motorId: 'MTR-BLDC-501-U2' },
        propeller: { ...defaultPropellerCCW },
        position: { x: -0.25, y: 0.25, z: 0.05 },
        transform: { ...identityTransform, position: { x: -0.25, y: 0.25, z: 0.05 } },
        rotationDirection: 'CCW',
        operatingPoint: { ...defaultOperatingPoint }
      },
      {
        unitId: 'PROPULSION-UNIT-3',
        unitName: 'Rear-Left Motor/Propeller Assembly',
        motor: { ...defaultMotor, motorId: 'MTR-BLDC-501-U3' },
        propeller: { ...defaultPropellerCW },
        position: { x: -0.25, y: -0.25, z: 0.05 },
        transform: { ...identityTransform, position: { x: -0.25, y: -0.25, z: 0.05 } },
        rotationDirection: 'CW',
        operatingPoint: { ...defaultOperatingPoint }
      },
      {
        unitId: 'PROPULSION-UNIT-4',
        unitName: 'Front-Left Motor/Propeller Assembly',
        motor: { ...defaultMotor, motorId: 'MTR-BLDC-501-U4' },
        propeller: { ...defaultPropellerCCW },
        position: { x: 0.25, y: -0.25, z: 0.05 },
        transform: { ...identityTransform, position: { x: 0.25, y: -0.25, z: 0.05 } },
        rotationDirection: 'CCW',
        operatingPoint: { ...defaultOperatingPoint }
      }
    ];

    this.units.clear();
    unitConfigs.forEach(u => this.units.set(u.unitId, u));
  }

  /**
   * Sets the global air density / ambient environment.
   */
  public setEnvironment(environment: PropulsionEnvironment): void {
    this.environment = environment;
    this.revision = `REV-ENV-${Date.now().toString(36)}`;
    // Update all units operating point environment
    this.units.forEach(unit => {
      unit.operatingPoint.environment = environment;
    });
  }

  /**
   * Updates operating point (RPM, Voltage, Current) for a specific unit or all units.
   */
  public setOperatingPoint(
    rpm: number,
    voltage: number,
    current: number,
    unitId?: string
  ): void {
    this.revision = `REV-OP-${Date.now().toString(36)}`;
    if (unitId && this.units.has(unitId)) {
      const u = this.units.get(unitId)!;
      u.operatingPoint.rpm = rpm;
      u.operatingPoint.voltage = voltage;
      u.operatingPoint.current = current;
    } else {
      this.units.forEach(u => {
        u.operatingPoint.rpm = rpm;
        u.operatingPoint.voltage = voltage;
        u.operatingPoint.current = current;
      });
    }
  }

  /**
   * Updates propeller diameter (m) parametrically to test input changes.
   */
  public updatePropellerDiameter(newDiameterM: number): void {
    if (newDiameterM <= 0) {
      throw new Error('INVALID_GEOMETRY: Propeller diameter must be strictly positive');
    }
    this.revision = `REV-PROP-DIAM-${Date.now().toString(36)}`;
    this.units.forEach(u => {
      u.propeller.diameter = newDiameterM;
    });
  }

  /**
   * Calculates the full 3D propulsion system physics results.
   */
  public computePropulsionSystemResults(): PropulsionSystemResult {
    this.calculationCount++;

    // Get Drone CG from Mass Manager (EPC-022)
    const massProps = this.massManager.evaluateCompleteAssemblyMassProperties();
    const droneCG = massProps.centerOfMass || { x: 0, y: 0, z: 0 };

    const unitResults: SinglePropulsionUnitResult[] = [];
    const validationMessages: string[] = [];

    let totalThrustScalar = 0;
    let totalElecPowerW = 0;
    let totalMechPowerW = 0;
    let totalThrustPowerW = 0;

    let totalThrustVectorGlobal: Vector3D = { x: 0, y: 0, z: 0 };
    let totalPropulsionMomentGlobal: Vector3D = { x: 0, y: 0, z: 0 };

    this.units.forEach((unitConfig) => {
      const { motor, propeller, position, transform, rotationDirection, operatingPoint } = unitConfig;

      // 1. Calculate Thrust, Torque, Power, Efficiency using Physics Calculator
      const thrustRes = PropulsionPhysicsCalculator.computePropellerThrust(
        propeller.Ct,
        operatingPoint.environment.airDensity,
        operatingPoint.rpm,
        propeller.diameter
      );

      const torqueRes = PropulsionPhysicsCalculator.computePropellerTorque(
        propeller.Cq,
        operatingPoint.environment.airDensity,
        operatingPoint.rpm,
        propeller.diameter,
        motor.Kt,
        operatingPoint.current
      );

      const powerRes = PropulsionPhysicsCalculator.computePowerResult(
        operatingPoint.voltage,
        operatingPoint.current,
        torqueRes.torqueNm,
        operatingPoint.rpm,
        thrustRes.thrustN,
        operatingPoint.vClimbMps || 0
      );

      const effRes = PropulsionPhysicsCalculator.computeEfficiency(
        powerRes.mechanicalPowerW,
        powerRes.electricalPowerW
      );

      const limitStatus = PropulsionPhysicsCalculator.validateLimits(
        motor,
        propeller,
        operatingPoint,
        thrustRes.thrustN,
        powerRes.electricalPowerW
      );

      if (!effRes.isValid && effRes.nonphysicalError) {
        validationMessages.push(`[${unitConfig.unitId}] ${effRes.nonphysicalError}`);
      }
      if (!thrustRes.isValid && thrustRes.validationMessage) {
        validationMessages.push(`[${unitConfig.unitId}] ${thrustRes.validationMessage}`);
      }
      if (limitStatus.warnings.length > 0) {
        validationMessages.push(...limitStatus.warnings.map(w => `[${unitConfig.unitId}] ${w}`));
      }

      // 2. 3D Thrust Vector Calculation in Assembly Frame
      // Motor points upwards (+Z in local frame). Transform rotates [0, 0, thrustN] to Assembly Global frame.
      const rx = transform.rotation.x;
      const ry = transform.rotation.y;
      const rz = transform.rotation.z;

      // Rotate local thrust vector [0, 0, T]
      const thrustVectorGlobal: Vector3D = {
        x: thrustRes.thrustN * (Math.sin(ry) * Math.cos(rz) + Math.cos(ry) * Math.sin(rx) * Math.sin(rz)),
        y: thrustRes.thrustN * (Math.sin(ry) * Math.sin(rz) - Math.cos(ry) * Math.sin(rx) * Math.cos(rz)),
        z: thrustRes.thrustN * (Math.cos(ry) * Math.cos(rx))
      };

      // 3. Reaction Torque Vector in Assembly Frame
      // CW propeller creates CCW reaction torque on drone body (+Z).
      // CCW propeller creates CW reaction torque on drone body (-Z).
      const reactionSign = rotationDirection === 'CW' ? +1 : -1;
      const reactionTorqueMag = torqueRes.torqueNm * reactionSign;
      const reactionTorqueVectorGlobal: Vector3D = {
        x: 0,
        y: 0,
        z: reactionTorqueMag
      };

      // 4. Position Moment Vector r x F relative to CG
      const rRel: Vector3D = {
        x: position.x - droneCG.x,
        y: position.y - droneCG.y,
        z: position.z - droneCG.z
      };

      // Cross Product r x F
      const positionMomentGlobal: Vector3D = {
        x: rRel.y * thrustVectorGlobal.z - rRel.z * thrustVectorGlobal.y,
        y: rRel.z * thrustVectorGlobal.x - rRel.x * thrustVectorGlobal.z,
        z: rRel.x * thrustVectorGlobal.y - rRel.y * thrustVectorGlobal.x
      };

      // Total Moment Contribution = r x F + reaction torque
      const totalMomentContributionGlobal: Vector3D = {
        x: positionMomentGlobal.x + reactionTorqueVectorGlobal.x,
        y: positionMomentGlobal.y + reactionTorqueVectorGlobal.y,
        z: positionMomentGlobal.z + reactionTorqueVectorGlobal.z
      };

      // Accumulate Totals
      totalThrustScalar += thrustRes.thrustN;
      totalElecPowerW += powerRes.electricalPowerW;
      totalMechPowerW += powerRes.mechanicalPowerW;
      totalThrustPowerW += powerRes.thrustPowerW;

      totalThrustVectorGlobal.x += thrustVectorGlobal.x;
      totalThrustVectorGlobal.y += thrustVectorGlobal.y;
      totalThrustVectorGlobal.z += thrustVectorGlobal.z;

      totalPropulsionMomentGlobal.x += totalMomentContributionGlobal.x;
      totalPropulsionMomentGlobal.y += totalMomentContributionGlobal.y;
      totalPropulsionMomentGlobal.z += totalMomentContributionGlobal.z;

      unitResults.push({
        unitId: unitConfig.unitId,
        position,
        transform,
        rotationDirection,
        operatingPoint: { ...operatingPoint },
        thrust: thrustRes,
        torque: torqueRes,
        power: powerRes,
        efficiency: effRes,
        thrustVectorGlobal,
        reactionTorqueVectorGlobal,
        positionMomentGlobal,
        totalMomentContributionGlobal,
        limitStatus
      });
    });

    const systemEfficiency = totalElecPowerW > 0 ? totalMechPowerW / totalElecPowerW : 0;
    const isValid = validationMessages.length === 0 && totalThrustScalar > 0;

    const inputHash = `PROP-IN-${this.revision}-${totalThrustScalar.toFixed(3)}`;
    const outputHash = `PROP-OUT-${totalThrustScalar.toFixed(4)}-${totalElecPowerW.toFixed(2)}`;

    const result: PropulsionSystemResult = {
      propulsionSystemId: this.systemId,
      revision: this.revision,
      configurationId: this.configurationId,
      unitCount: this.units.size,
      unitsResults: unitResults,
      totalThrustN: totalThrustScalar,
      totalThrustVectorGlobal,
      totalPropulsionMomentGlobal,
      totalElectricalPowerW: totalElecPowerW,
      totalMechanicalPowerW: totalMechPowerW,
      totalThrustPowerW: totalThrustPowerW,
      systemEfficiency,
      referenceFrame: 'ASSEMBLY',
      units: {
        force: 'N',
        torque: 'N·m',
        power: 'W',
        speed: 'RPM',
        voltage: 'V',
        current: 'A',
        density: 'kg/m³'
      },
      modelVersion: 'SECP-PHYSICS-PROPULSION-v2.1',
      calculationMethod: 'ANALYTICAL_BLADE_ELEMENT_MOTOR_ELECTROMECHANICAL_ROLLUP',
      provenance: {
        inputHash,
        outputHash,
        calculationMethod: 'SECP_CORE_PROPULSION_PHYSICS_SOLVER',
        modelVersion: '2.1.0',
        computedAt: new Date().toISOString()
      },
      evidenceReference: `EVIDENCE-${this.systemId}-${this.revision}`,
      isValid,
      validationMessages
    };

    this.lastResult = result;
    return result;
  }

  /**
   * Executes RPM Sweep on Unit 1 to generate curves.
   */
  public generatePerformanceCurves(fixedVoltage: number = 24.0): OperatingPointSweepResults {
    const unit1 = this.units.get('PROPULSION-UNIT-1')!;
    return PropulsionPhysicsCalculator.executeRpmSweep(
      unit1.motor,
      unit1.propeller,
      this.environment,
      1000,
      8000,
      8,
      fixedVoltage
    );
  }

  /**
   * Validates SECP Propulsion Solver against Analytical Reference Fixtures.
   */
  public runAnalyticalValidationFixtures(): AnalyticalPropulsionValidationReport {
    // Reference case: Ct=0.115, Cq=0.0125, rho=1.225 kg/m^3, rpm=6000 (n=100 rps), D=0.4572 m
    // Expected Thrust T = 0.115 * 1.225 * 100^2 * 0.4572^4 = 61.5478 N
    // Expected Torque Q = 0.0125 * 1.225 * 100^2 * 0.4572^5 = 3.0645 N*m
    const Ct = 0.115;
    const Cq = 0.0125;
    const rho = 1.225;
    const rpm = 6000;
    const D = 0.4572;
    const expectedT = Ct * rho * Math.pow(rpm / 60, 2) * Math.pow(D, 4);
    const expectedQ = Cq * rho * Math.pow(rpm / 60, 2) * Math.pow(D, 5);

    return PropulsionPhysicsCalculator.validateAnalyticalFixture(
      'PROPULSION-ANALYTICAL-REF-CASE-01',
      Ct,
      Cq,
      rho,
      rpm,
      D,
      expectedT,
      expectedQ,
      1e-4
    );
  }

  /**
   * Returns current propulsion units configurations.
   */
  public getUnits(): Map<string, SinglePropulsionUnitConfig> {
    return this.units;
  }

  /**
   * Returns calculation count.
   */
  public getCalculationCount(): number {
    return this.calculationCount;
  }

  /**
   * Gets integrated total drone mass from EPC-022 Mass Properties.
   */
  public getIntegratedTotalDroneMassKg(): number {
    const massProps = this.massManager.evaluateCompleteAssemblyMassProperties();
    return massProps.mass;
  }
}
