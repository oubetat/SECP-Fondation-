/**
 * SECP Industrial OS — EPC-036: Industrial Robotic Arm System Requirements
 * Transforms Mission & Product Definition into 25 Formal, Verifiable,
 * Multidisciplinary System Engineering Requirements for a 6-DOF Industrial Manipulator.
 */

import { SystemRequirement } from '../system/SystemRequirementTypes';
import { SystemRequirementManager } from '../system/SystemRequirementManager';

export interface RobotInputConfig {
  readonly caseId?: string;
  readonly missionId?: string;
  readonly payloadMassKg?: number;
  readonly link1LengthMm?: number;
  readonly link2LengthMm?: number;
  readonly targetReachRadiusMm?: number;
  readonly jointMaxAccelDegS2?: number;
  readonly repeatabilityMm?: number;
}

export class IndustrialRobotSystemRequirements {
  public static readonly DOMAIN = 'INDUSTRIAL_ROBOTICS';
  public static readonly CASE_ID = 'EPC-CASE-002';

  /**
   * Synthesizes a complete set of System Requirements derived from configuration inputs.
   */
  public static synthesizeFromConfig(
    config?: RobotInputConfig
  ): readonly SystemRequirement[] {
    const caseId = config?.caseId || this.CASE_ID;
    const missionId = config?.missionId || 'MISSION-ROBOT-PICK-PLACE';
    const payloadKg = config?.payloadMassKg ?? 12;
    const l1Mm = config?.link1LengthMm ?? 450;
    const l2Mm = config?.link2LengthMm ?? 520;
    const reachMm = config?.targetReachRadiusMm ?? 750;
    const accelDeg = config?.jointMaxAccelDegS2 ?? 120;
    const repeatMm = config?.repeatabilityMm ?? 0.05;

    const createdAt = new Date().toISOString();
    const revision = '1.0';

    // Calculation for shoulder dynamic torque based on link lengths and payload
    const l1M = l1Mm / 1000;
    const l2M = l2Mm / 1000;
    const totalReachM = l1M + l2M;
    const accelRad = (accelDeg * Math.PI) / 180;
    const g = 9.81;
    const gravityTorque = payloadKg * g * totalReachM;
    const dynamicTorque = payloadKg * Math.pow(totalReachM, 2) * accelRad;
    const requiredTorque = parseFloat((gravityTorque + dynamicTorque).toFixed(1));

    const requirements: SystemRequirement[] = [
      // 1. ROBOT-REQ-001: Operational Reach Radius
      {
        requirementId: 'ROBOT-REQ-001',
        caseId,
        domain: this.DOMAIN,
        category: 'PERFORMANCE',
        title: 'Operational Reach Radius',
        description: 'The articulated manipulator arm shall achieve a dynamic reach radius matching or exceeding the work cell target reach specification.',
        type: 'PERFORMANCE',
        parameter: 'radius',
        value: reachMm,
        targetValue: reachMm,
        minimumValue: reachMm,
        unit: 'mm',
        tolerance: { type: 'BOUNDS', lowerBound: reachMm },
        acceptanceCriteria: `reachRadius >= ${reachMm} mm across full joint rotational workspace`,
        priority: 'HIGH',
        verificationMethod: 'SIMULATION',
        validationMethod: 'FIELD_TEST',
        source: 'MISSION_DEFINITION',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 2. ROBOT-REQ-002: Maximum Payload mass capacity - CRITICAL
      {
        requirementId: 'ROBOT-REQ-002',
        caseId,
        domain: this.DOMAIN,
        category: 'PAYLOAD',
        title: 'Manipulator Maximum Payload Capacity',
        description: 'The mechatronic wrist interface shall support and lift the specified mass without motor thermal degradation or structural deflection.',
        type: 'PHYSICAL',
        parameter: 'payload_mass',
        value: payloadKg,
        targetValue: payloadKg,
        minimumValue: payloadKg * 0.8,
        maximumValue: payloadKg * 1.5,
        unit: 'kg',
        tolerance: {
          type: 'BOUNDS',
          lowerBound: payloadKg * 0.8,
          upperBound: payloadKg * 1.5
        },
        acceptanceCriteria: `payloadMass >= ${payloadKg} kg under full dynamic acceleration profile`,
        priority: 'CRITICAL',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'PHYSICAL_TEST',
        source: 'MISSION_DEFINITION',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 3. ROBOT-REQ-003: Positional Repeatability - CRITICAL
      {
        requirementId: 'ROBOT-REQ-003',
        caseId,
        domain: this.DOMAIN,
        category: 'PERFORMANCE',
        title: 'End-Effector Positional Repeatability',
        description: 'The manipulator wrist center shall return to the taught trajectory coordinates within sub-millimeter tolerances under full payload.',
        type: 'PERFORMANCE',
        parameter: 'machiningTolerance',
        value: repeatMm,
        targetValue: repeatMm,
        maximumValue: repeatMm * 2,
        unit: 'mm',
        tolerance: { type: 'BOUNDS', upperBound: repeatMm * 2 },
        acceptanceCriteria: `repeatabilityRadius <= ${repeatMm} mm over 10000 continuous pick-and-place cycles per ISO 9283`,
        priority: 'CRITICAL',
        verificationMethod: 'MEASUREMENT',
        validationMethod: 'PHYSICAL_TEST',
        source: 'STANDARDS',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 4. ROBOT-REQ-004: Joint Sizing Dynamic Torque - CRITICAL
      {
        requirementId: 'ROBOT-REQ-004',
        caseId,
        domain: this.DOMAIN,
        category: 'CONTROL',
        title: 'Joint Torque Sizing Allocation',
        description: 'Shoulder actuator and gearbox combination must supply sufficient dynamic holding torque to support the link weights and payload acceleration.',
        type: 'CONTROL',
        parameter: 'torque',
        value: requiredTorque,
        targetValue: requiredTorque,
        minimumValue: requiredTorque * 0.9,
        maximumValue: requiredTorque * 1.3,
        unit: 'Nm',
        tolerance: {
          type: 'BOUNDS',
          lowerBound: requiredTorque * 0.9,
          upperBound: requiredTorque * 1.3
        },
        acceptanceCriteria: `shoulderServoTorqueRating >= ${requiredTorque} Nm with positive static torque margin`,
        priority: 'CRITICAL',
        verificationMethod: 'SIMULATION',
        validationMethod: 'SIMULATION_CORRELATION',
        source: 'DESIGN_TARGET',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 5. ROBOT-REQ-005: Joint Max Acceleration
      {
        requirementId: 'ROBOT-REQ-005',
        caseId,
        domain: this.DOMAIN,
        category: 'CONTROL',
        title: 'Maximum Joint Angular Acceleration',
        description: 'The drive servo system shall actuate major joint axes at the specified angular acceleration profile to meet duty cycle throughput.',
        type: 'CONTROL',
        parameter: 'bandwidth', // bandwidth/frequency mapping to deg/s
        value: accelDeg,
        targetValue: accelDeg,
        minimumValue: accelDeg * 0.8,
        unit: 'deg/s',
        tolerance: { type: 'BOUNDS', lowerBound: accelDeg * 0.8 },
        acceptanceCriteria: `jointAcceleration >= ${accelDeg} deg/s^2 under rated payload`,
        priority: 'HIGH',
        verificationMethod: 'SIMULATION',
        validationMethod: 'PHYSICAL_TEST',
        source: 'DESIGN_TARGET',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 6. ROBOT-REQ-006: Structural Link 1 Length
      {
        requirementId: 'ROBOT-REQ-006',
        caseId,
        domain: this.DOMAIN,
        category: 'STRUCTURAL',
        title: 'Primary Structural Link 1 Length',
        description: 'The physical casting length of Link 1 mechatronic structural assembly shall conform to kinematics model dimensions.',
        type: 'STRUCTURAL',
        parameter: 'length',
        value: l1Mm,
        targetValue: l1Mm,
        minimumValue: l1Mm - 0.5,
        maximumValue: l1Mm + 0.5,
        unit: 'mm',
        tolerance: { type: 'BOUNDS', lowerBound: l1Mm - 0.5, upperBound: l1Mm + 0.5 },
        acceptanceCriteria: `link1Length == ${l1Mm} mm within assembly tolerances`,
        priority: 'HIGH',
        verificationMethod: 'INSPECTION',
        validationMethod: 'INSPECTION',
        source: 'DESIGN_TARGET',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 7. ROBOT-REQ-007: Structural Link 2 Length
      {
        requirementId: 'ROBOT-REQ-007',
        caseId,
        domain: this.DOMAIN,
        category: 'STRUCTURAL',
        title: 'Primary Structural Link 2 Length',
        description: 'The physical casting length of Link 2 mechatronic structural assembly shall conform to kinematics model dimensions.',
        type: 'STRUCTURAL',
        parameter: 'length',
        value: l2Mm,
        targetValue: l2Mm,
        minimumValue: l2Mm - 0.5,
        maximumValue: l2Mm + 0.5,
        unit: 'mm',
        tolerance: { type: 'BOUNDS', lowerBound: l2Mm - 0.5, upperBound: l2Mm + 0.5 },
        acceptanceCriteria: `link2Length == ${l2Mm} mm within assembly tolerances`,
        priority: 'HIGH',
        verificationMethod: 'INSPECTION',
        validationMethod: 'INSPECTION',
        source: 'DESIGN_TARGET',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 8. ROBOT-REQ-008: Wrist Interface Flange (Qualitative)
      {
        requirementId: 'ROBOT-REQ-008',
        caseId,
        domain: this.DOMAIN,
        category: 'PAYLOAD',
        title: 'End-Effector Wrist Interface Flange',
        description: 'The tool mounting interface flange of major axis 6 shall conform to ISO 9409-1 standard specifications for robotic attachments.',
        type: 'INTERFACE',
        acceptanceCriteria: 'Mechanical interface matches standard ISO 9409-1 layout with pitch circle diameter and bolt patterns confirmed by CMM inspection.',
        priority: 'HIGH',
        verificationMethod: 'INSPECTION',
        validationMethod: 'INSPECTION',
        source: 'STANDARDS',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 9. ROBOT-REQ-009: Joint Angular Velocity
      {
        requirementId: 'ROBOT-REQ-009',
        caseId,
        domain: this.DOMAIN,
        category: 'PERFORMANCE',
        title: 'Maximum Joint Angular Velocity',
        description: 'The major axis drive servo assemblies shall rotate at rated speed targets under standard thermal profiles.',
        type: 'PERFORMANCE',
        parameter: 'bandwidth',
        value: 150,
        targetValue: 150,
        minimumValue: 120,
        unit: 'deg/s',
        tolerance: { type: 'BOUNDS', lowerBound: 120 },
        acceptanceCriteria: 'sustainedJointAngularVelocity >= 120 deg/s under nominal operating cycle',
        priority: 'MEDIUM',
        verificationMethod: 'SIMULATION',
        validationMethod: 'PHYSICAL_TEST',
        source: 'DESIGN_TARGET',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 10. ROBOT-REQ-010: Structural Ultimate Factor of Safety - CRITICAL
      {
        requirementId: 'ROBOT-REQ-010',
        caseId,
        domain: this.DOMAIN,
        category: 'STRUCTURAL',
        title: 'Structural Load Safety Factor',
        description: 'Primary structural link castings and mounting joints shall withstand extreme inertia and collision load vectors without permanent yield.',
        type: 'STRUCTURAL',
        parameter: 'limitLoadFactor',
        value: 2.5,
        targetValue: 2.5,
        minimumValue: 2.0,
        unit: 'count',
        tolerance: { type: 'BOUNDS', lowerBound: 2.0 },
        acceptanceCriteria: 'minimumFactorOfSafety >= 2.0 under high speed reverse collision transient load cases evaluated via FEA',
        priority: 'CRITICAL',
        verificationMethod: 'SIMULATION',
        validationMethod: 'PHYSICAL_TEST',
        source: 'STANDARDS',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 11. ROBOT-REQ-011: Static deflection under load
      {
        requirementId: 'ROBOT-REQ-011',
        caseId,
        domain: this.DOMAIN,
        category: 'STRUCTURAL',
        title: 'Wrist Deflection Under Static Load',
        description: 'Static vertical deflection of the manipulator wrist under extreme horizontal outreach and full payload shall be minimized.',
        type: 'STRUCTURAL',
        parameter: 'deflection',
        value: 0.2,
        targetValue: 0.2,
        maximumValue: 0.5,
        unit: 'mm',
        tolerance: { type: 'BOUNDS', upperBound: 0.5 },
        acceptanceCriteria: `staticDeflection <= 0.5 mm under ${payloadKg} kg payload at full extensions`,
        priority: 'HIGH',
        verificationMethod: 'SIMULATION',
        validationMethod: 'PHYSICAL_TEST',
        source: 'DESIGN_TARGET',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 12. ROBOT-REQ-012: Operating ambient temperature range
      {
        requirementId: 'ROBOT-REQ-012',
        caseId,
        domain: this.DOMAIN,
        category: 'ENVIRONMENT',
        title: 'Industrial Ambient Operating Temperature',
        description: 'The mechatronic arm and controller electronics cabinet shall maintain continuous duty cycles across harsh industrial environment profiles.',
        type: 'ENVIRONMENTAL',
        parameter: 'ambientTemperature',
        minimumValue: 0,
        maximumValue: 50,
        targetValue: 25,
        unit: '°C',
        tolerance: { type: 'BOUNDS', lowerBound: 0, upperBound: 50 },
        acceptanceCriteria: 'manipulator maintains duty cycle across 0 °C to 50 °C thermal climatic test with zero motor stalls',
        priority: 'HIGH',
        verificationMethod: 'TEST',
        validationMethod: 'PHYSICAL_TEST',
        source: 'MISSION_DEFINITION',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 13. ROBOT-REQ-013: Enclosure Ingress Protection (IP65)
      {
        requirementId: 'ROBOT-REQ-013',
        caseId,
        domain: this.DOMAIN,
        category: 'ENVIRONMENT',
        title: 'Arm Enclosure Ingress Protection IP65',
        description: 'Joint actuator enclosures, seals, and wire harnesses must prevent oil, dust, and water spray ingress in high-spray factory floor environments.',
        type: 'ENVIRONMENTAL',
        acceptanceCriteria: 'manipulator arm passes IEC 60529 IP65 water spray and dust chamber exposure test protocols',
        priority: 'HIGH',
        verificationMethod: 'INSPECTION',
        validationMethod: 'PHYSICAL_TEST',
        source: 'STANDARDS',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 14. ROBOT-REQ-014: Motor Current Draw
      {
        requirementId: 'ROBOT-REQ-014',
        caseId,
        domain: this.DOMAIN,
        category: 'POWER',
        title: 'Maximum Servo Motor Phase Current',
        description: 'Peak phase current drawn by major shoulder axis drive motor during transient high accelerations shall not exceed driver ratings.',
        type: 'POWER',
        parameter: 'current',
        value: 15,
        targetValue: 15,
        maximumValue: 22,
        unit: 'A',
        tolerance: { type: 'BOUNDS', upperBound: 22 },
        acceptanceCriteria: 'peakAxisCurrentDraw <= 22 A under full payload high acceleration transient profile',
        priority: 'HIGH',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'PHYSICAL_TEST',
        source: 'DESIGN_TARGET',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 15. ROBOT-REQ-015: DC Voltage Supply Bus
      {
        requirementId: 'ROBOT-REQ-015',
        caseId,
        domain: this.DOMAIN,
        category: 'POWER',
        title: 'Regulated DC Power Bus Voltage',
        description: 'The arm power harness shall supply stabilized power bus voltage to the joint drive electronics to maintain position loop tuning.',
        type: 'POWER',
        parameter: 'voltage',
        value: 48,
        targetValue: 48,
        minimumValue: 44,
        maximumValue: 52,
        unit: 'V',
        tolerance: { type: 'BOUNDS', lowerBound: 44, upperBound: 52 },
        acceptanceCriteria: 'stabilizedDCVoltage == 48 V with +/-4 V noise ripple under extreme load changes',
        priority: 'MEDIUM',
        verificationMethod: 'MEASUREMENT',
        validationMethod: 'PHYSICAL_TEST',
        source: 'CUSTOMER_REQUIREMENT',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 16. ROBOT-REQ-016: Servo Controller Loop Frequency
      {
        requirementId: 'ROBOT-REQ-016',
        caseId,
        domain: this.DOMAIN,
        category: 'CONTROL',
        title: 'Internal Position Loop Refresh Frequency',
        description: 'The real-time motion controller shall execute the closed loop position and velocity trajectory algorithms at the rated rate.',
        type: 'CONTROL',
        parameter: 'frequency',
        value: 1000,
        targetValue: 1000,
        minimumValue: 800,
        unit: 'Hz',
        tolerance: { type: 'BOUNDS', lowerBound: 800 },
        acceptanceCriteria: 'positionLoopUpdateFrequency >= 800 Hz under deterministic real-time scheduler constraints',
        priority: 'HIGH',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'SIMULATION_CORRELATION',
        source: 'DESIGN_TARGET',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 17. ROBOT-REQ-017: Backlash limits
      {
        requirementId: 'ROBOT-REQ-017',
        caseId,
        domain: this.DOMAIN,
        category: 'PERFORMANCE',
        title: 'Gearbox Mechanical Backlash Limit',
        description: 'Rotational backlash clearance in primary joint planetary and strain wave gear assemblies shall remain below threshold to prevent position oscillations.',
        type: 'PERFORMANCE',
        parameter: 'angle', // mapping backlash angle to arcmin / degrees (ratio of degree is allowed)
        value: 1,
        targetValue: 1,
        maximumValue: 2,
        unit: 'ratio',
        tolerance: { type: 'BOUNDS', upperBound: 2 },
        acceptanceCriteria: 'jointAssemblyGearBacklash <= 2 arcmin measured statically at full load',
        priority: 'HIGH',
        verificationMethod: 'MEASUREMENT',
        validationMethod: 'PHYSICAL_TEST',
        source: 'DESIGN_TARGET',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 18. ROBOT-REQ-018: Emergency Stop Braking response
      {
        requirementId: 'ROBOT-REQ-018',
        caseId,
        domain: this.DOMAIN,
        category: 'SAFETY',
        title: 'Emergency Stop Braking Response Delay',
        description: 'The mechatronic brake solenoid shall engage and lock major axes upon emergency power cutoff within rated delay parameters to prevent cell breaches.',
        type: 'FUNCTIONAL',
        parameter: 'time',
        value: 150,
        targetValue: 150,
        maximumValue: 250,
        unit: 'ms',
        tolerance: { type: 'BOUNDS', upperBound: 250 },
        acceptanceCriteria: 'estopBrakeTriggerDelay <= 250 ms from safety relay activation under full payload velocity',
        priority: 'CRITICAL',
        verificationMethod: 'TEST',
        validationMethod: 'PHYSICAL_TEST',
        source: 'REGULATORY_REFERENCE',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 19. ROBOT-REQ-019: Joint Position Sensor Resolution
      {
        requirementId: 'ROBOT-REQ-019',
        caseId,
        domain: this.DOMAIN,
        category: 'CONTROL',
        title: 'Absolute Joint Encoder Sensor Resolution',
        description: 'Optical joint encoders installed on major axis shafts shall provide absolute angle feedback resolution.',
        type: 'CONTROL',
        parameter: 'ratio',
        value: 19,
        targetValue: 19,
        minimumValue: 17,
        unit: 'ratio',
        tolerance: { type: 'BOUNDS', lowerBound: 17 },
        acceptanceCriteria: 'encoderAbsoluteResolution >= 17 bit offering fine path feedback over 360 degrees',
        priority: 'HIGH',
        verificationMethod: 'INSPECTION',
        validationMethod: 'INSPECTION',
        source: 'DESIGN_TARGET',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 20. ROBOT-REQ-020: Industrial Network communication latency
      {
        requirementId: 'ROBOT-REQ-020',
        caseId,
        domain: this.DOMAIN,
        category: 'INTEROPERABILITY',
        title: 'Industrial Bus Network Latency and Packet Loss',
        description: 'EtherCAT or Profinet communication links from cell controller to mechatronic drive boards shall maintain microsecond cycles.',
        type: 'INTERFACE',
        acceptanceCriteria: 'networkLatency <= 125 microseconds and packetLoss <= 0.01% under full mechatronic node strain',
        priority: 'HIGH',
        verificationMethod: 'TEST',
        validationMethod: 'FIELD_TEST',
        source: 'STANDARDS',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 21. ROBOT-REQ-021: Electromagnetic Compatibility (EMC) (Qualitative)
      {
        requirementId: 'ROBOT-REQ-021',
        caseId,
        domain: this.DOMAIN,
        category: 'INTEROPERABILITY',
        title: 'Electromagnetic Immunity IEC 61000 Compliance',
        description: 'System wiring, shieldings, and internal mechatronic control filters shall resist factory floor motor electromagnetic induction.',
        type: 'ENVIRONMENTAL',
        acceptanceCriteria: 'manipulator retains stable signal-to-noise ratio above 40dB under simulated IEC 61000 spark induction tests',
        priority: 'MEDIUM',
        verificationMethod: 'TEST',
        validationMethod: 'INDEPENDENT_VALIDATION',
        source: 'STANDARDS',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 22. ROBOT-REQ-022: MTBF Reliability
      {
        requirementId: 'ROBOT-REQ-022',
        caseId,
        domain: this.DOMAIN,
        category: 'MAINTAINABILITY',
        title: 'Manipulator Mean Time Between Failures MTBF',
        description: 'Estimated and calculated MTBF of joint drives, wiring harnesses, and control mechatronics shall satisfy industrial durability requirements.',
        type: 'PERFORMANCE',
        parameter: 'time',
        value: 80000,
        targetValue: 80000,
        minimumValue: 60000,
        unit: 'h',
        tolerance: { type: 'BOUNDS', lowerBound: 60000 },
        acceptanceCriteria: 'derivedMTBFCalculations >= 60000 hours per MIL-HDBK-217F model specifications',
        priority: 'MEDIUM',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'EXPERIMENTAL_DATA',
        source: 'STANDARDS',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 23. ROBOT-REQ-023: Motor Joint Heat Dissipation
      {
        requirementId: 'ROBOT-REQ-023',
        caseId,
        domain: this.DOMAIN,
        category: 'THERMAL',
        title: 'Motor Drive Junction Thermal Ceiling',
        description: 'Internal heat sinks and natural convection cavities in major axes shall prevent drive motor temperature saturation at continuous peak payload.',
        type: 'THERMAL',
        parameter: 'temperature',
        value: 95,
        targetValue: 95,
        maximumValue: 120,
        unit: '°C',
        tolerance: { type: 'BOUNDS', upperBound: 120 },
        acceptanceCriteria: 'axisMotorJunctionTemp <= 120 °C under sustained 24-hour continuous pick-and-place dynamic duty cycles at maximum ambient',
        priority: 'HIGH',
        verificationMethod: 'SIMULATION',
        validationMethod: 'PHYSICAL_TEST',
        source: 'DESIGN_TARGET',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 24. ROBOT-REQ-024: Acoustic Noise signature
      {
        requirementId: 'ROBOT-REQ-024',
        caseId,
        domain: this.DOMAIN,
        category: 'PERFORMANCE',
        title: 'Maximum Acoustic Sound Emission level',
        description: 'Acoustic emissions emitted by mechatronic arm gearboxes and brake actuation during rapid movements shall stay below safety guidelines.',
        type: 'PERFORMANCE',
        parameter: 'stress', // dBA or dB stress equivalents mapped
        value: 65,
        targetValue: 65,
        maximumValue: 72,
        unit: 'dB',
        tolerance: { type: 'BOUNDS', upperBound: 72 },
        acceptanceCriteria: 'A-weighted sound pressure level <= 72 dB(A) measured at 1 m stand-off distance during rapid path movements',
        priority: 'LOW',
        verificationMethod: 'CALCULATION',
        validationMethod: 'EXPERIMENT',
        source: 'STANDARDS',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      },

      // 25. ROBOT-REQ-025: Total System mass
      {
        requirementId: 'ROBOT-REQ-025',
        caseId,
        domain: this.DOMAIN,
        category: 'MASS',
        title: 'Manipulator Total Dynamic Airframe Structural Mass',
        description: 'Combined structural weight of mechatronic link castings, arm joints, and wrist motors shall conform to base structural limits.',
        type: 'PHYSICAL',
        parameter: 'mass',
        value: 85,
        targetValue: 85,
        maximumValue: 110,
        unit: 'kg',
        tolerance: { type: 'BOUNDS', upperBound: 110 },
        acceptanceCriteria: 'measuredAssemblyTotalWeight <= 110 kg excluding controller enclosure cabinet',
        priority: 'HIGH',
        verificationMethod: 'MEASUREMENT',
        validationMethod: 'PHYSICAL_TEST',
        source: 'DESIGN_TARGET',
        status: 'DEFINED',
        derivedFromMissionId: missionId,
        verificationStatus: 'NOT_RUN',
        validationStatus: 'NOT_RUN',
        readinessStatus: 'READY_FOR_VERIFICATION',
        revision,
        createdAt,
        updatedAt: createdAt
      }
    ];

    return requirements;
  }

  /**
   * Instantiates a fully populated SystemRequirementManager for the Industrial Robotic Arm.
   */
  public static createManager(config?: RobotInputConfig): SystemRequirementManager {
    const reqs = this.synthesizeFromConfig(config);
    return new SystemRequirementManager(reqs);
  }
}
