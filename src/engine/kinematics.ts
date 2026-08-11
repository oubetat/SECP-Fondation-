/**
 * PATCH-SECP-011 — Motion & Kinematics Engine
 * Kinematic Joint Types (Revolute, Prismatic, Cylindrical, Spherical, Fixed),
 * Actuators & Mechanisms (Slider-Crank, 4-Bar Linkage, Lead Screw),
 * Time-series solver calculating Position, Velocity, Acceleration, Torque.
 */

export type JointType = 'REVOLUTE' | 'PRISMATIC' | 'CYLINDRICAL' | 'SPHERICAL' | 'FIXED';

export interface KinematicJoint {
  id: string;
  name: string;
  type: JointType;
  parentLinkId?: string;
  childLinkId?: string;
  axis: { x: number; y: number; z: number };
  currentValue: number; // angle in deg or position in mm
  limits?: { min: number; max: number };
}

export interface MotorActuator {
  id: string;
  name: string;
  targetJointId: string;
  mode: 'CONSTANT_RPM' | 'HARMONIC_OSCILLATOR' | 'TRAPEZOIDAL_STEP';
  rpm: number;
  strokeMm?: number;
  maxTorqueNm: number;
}

export interface KinematicFramePoint {
  timeS: number;
  crankAngleDeg: number;
  pistonPositionMm: number;
  velocityMS: number;
  accelM2S: number;
  torqueNm: number;
}

export interface MechanismSimulationResult {
  mechanismName: string;
  durationS: number;
  sampleCount: number;
  timeSeries: KinematicFramePoint[];
  peakVelocityMS: number;
  peakAccelM2S: number;
  peakTorqueNm: number;
}

export class KinematicsEngine {
  /**
   * Solves Slider-Crank Mechanism Kinematics
   * Crank radius r (mm), Connecting rod length L (mm), Motor RPM
   */
  public static simulateSliderCrank(
    crankRadiusMm: number = 50,
    connectingRodMm: number = 150,
    rpm: number = 1200,
    loadForceN: number = 500,
    crankInertiaKgM2: number = 0.05
  ): MechanismSimulationResult {
    const omegaRadS = (2 * Math.PI * rpm) / 60;
    const rM = crankRadiusMm / 1000;
    const lM = connectingRodMm / 1000;
    const lambda = rM / lM;

    const sampleCount = 100;
    const durationS = (2 * Math.PI) / omegaRadS; // 1 full revolution duration
    const dt = durationS / sampleCount;

    const timeSeries: KinematicFramePoint[] = [];
    let peakVelocity = 0;
    let peakAccel = 0;
    let peakTorque = 0;

    for (let i = 0; i <= sampleCount; i++) {
      const t = i * dt;
      const thetaRad = omegaRadS * t;
      const thetaDeg = (thetaRad * 180) / Math.PI;

      // Piston Position x(t) = r * [ (1 - cos(theta)) + (1/(2*lambda)) * sin^2(theta) ]
      const posM = rM * ((1 - Math.cos(thetaRad)) + (lambda / 2) * Math.pow(Math.sin(thetaRad), 2));
      const posMm = posM * 1000;

      // Velocity v(t) = r * omega * [ sin(theta) + (lambda/2) * sin(2*theta) ]
      const velMS = rM * omegaRadS * (Math.sin(thetaRad) + (lambda / 2) * Math.sin(2 * thetaRad));

      // Acceleration a(t) = r * omega^2 * [ cos(theta) + lambda * cos(2*theta) ]
      const accelM2S = rM * Math.pow(omegaRadS, 2) * (Math.cos(thetaRad) + lambda * Math.cos(2 * thetaRad));

      // Required Motor Torque tau = F_load * r * sin(theta) + I * alpha
      const dynamicTorqueNm = Math.abs(loadForceN * rM * Math.sin(thetaRad)) + crankInertiaKgM2 * Math.abs(accelM2S / rM);

      if (Math.abs(velMS) > peakVelocity) peakVelocity = Math.abs(velMS);
      if (Math.abs(accelM2S) > peakAccel) peakAccel = Math.abs(accelM2S);
      if (dynamicTorqueNm > peakTorque) peakTorque = dynamicTorqueNm;

      timeSeries.push({
        timeS: t,
        crankAngleDeg: thetaDeg % 360,
        pistonPositionMm: posMm,
        velocityMS: velMS,
        accelM2S: accelM2S,
        torqueNm: dynamicTorqueNm
      });
    }

    return {
      mechanismName: 'Precision Slider-Crank IC Mechanism',
      durationS,
      sampleCount,
      timeSeries,
      peakVelocityMS: peakVelocity,
      peakAccelM2S: peakAccel,
      peakTorqueNm: peakTorque
    };
  }

  public static getDefaultJoints(): KinematicJoint[] {
    return [
      { id: 'j1', name: 'Crank Motor Joint', type: 'REVOLUTE', axis: { x: 0, y: 0, z: 1 }, currentValue: 45 },
      { id: 'j2', name: 'Connecting Rod Pin', type: 'REVOLUTE', axis: { x: 0, y: 0, z: 1 }, currentValue: 15 },
      { id: 'j3', name: 'Piston Wrist Pin', type: 'CYLINDRICAL', axis: { x: 1, y: 0, z: 0 }, currentValue: 85 },
      { id: 'j4', name: 'Linear Cylinder Wall', type: 'PRISMATIC', axis: { x: 1, y: 0, z: 0 }, currentValue: 120 },
      { id: 'j5', name: 'Frame Anchor Base', type: 'FIXED', axis: { x: 0, y: 0, z: 0 }, currentValue: 0 }
    ];
  }
}
