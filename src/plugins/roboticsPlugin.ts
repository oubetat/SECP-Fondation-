import { SecpPluginWorkbench } from '../sdk/secpPluginSdk';

export const RoboticsPlugin: SecpPluginWorkbench = {
  manifest: {
    id: 'secp-plugin-robotics',
    name: 'Robotics & Articulated Kinematics Workbench',
    version: '1.5.0',
    author: 'SECP Mechatronics & Control Lab',
    category: 'robotics',
    description: '6-DOF Industrial Robotic Arm Inverse Kinematics, Joint Torques ($T = J^T F$), Motor Current & Payload Capacity.',
    enabled: true,
    iconName: 'Cpu',
  },
  defaultParameters: {
    payloadMassKg: 12,
    link1LengthMm: 450,
    link2LengthMm: 520,
    targetReachRadiusMm: 750,
    jointMaxAccelDegS2: 120,
  },
  tools: [
    {
      id: 'joint-torque',
      name: 'Dynamic Joint Torque & Motor Sizing',
      description: 'Calculates maximum shoulder and elbow motor holding torque under acceleration and gravity.',
      compute: (inputs) => {
        const payloadKg = inputs.payloadMassKg || 12;
        const l1M = (inputs.link1LengthMm || 450) / 1000;
        const l2M = (inputs.link2LengthMm || 520) / 1000;
        const accelRadS2 = ((inputs.jointMaxAccelDegS2 || 120) * Math.PI) / 180;

        const g = 9.81;
        const totalReachM = l1M + l2M;
        const gravityTorqueNm = payloadKg * g * totalReachM;

        // Inertial dynamic torque estimate
        const payloadInertia = payloadKg * Math.pow(totalReachM, 2);
        const dynamicTorqueNm = payloadInertia * accelRadS2;
        const totalShoulderTorqueNm = gravityTorqueNm + dynamicTorqueNm;

        // Required motor current (assuming motor constant Kt = 0.85 Nm/A)
        const kt = 0.85;
        const motorCurrentAmp = totalShoulderTorqueNm / kt;

        return {
          gravityTorqueNm: parseFloat(gravityTorqueNm.toFixed(1)),
          totalShoulderTorqueNm: parseFloat(totalShoulderTorqueNm.toFixed(1)),
          motorCurrentAmp: parseFloat(motorCurrentAmp.toFixed(1)),
          servoRating: totalShoulderTorqueNm > 200 ? 'HEAVY_INDUSTRIAL_SERVO' : 'COMPACT_SERVO',
        };
      },
    },
  ],
};
