/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-258 — Master 5-Axis Kinematics Engine
 * Orchestrates Machine Architectures, Analytical Multi-Branch IK/FK,
 * Singularity Avoidance, Dynamic Feeds, and Standard Industrial Benchmarks.
 */

import { Vector3D } from '../../cadKernel';
import { 
  FiveAxisBenchmarkConfig, 
  FiveAxisMachineDefinition, 
  MachineArchitectureType, 
  MachineIndependent5AxisPath, 
  SurfaceOrientationControl 
} from './FiveAxisTypes';
import { FiveAxisKinematicChain } from './FiveAxisKinematicChain';
import { FiveAxisMathUtils } from './FiveAxisMathUtils';
import { ForwardKinematicsSolver } from './ForwardKinematicsSolver';
import { InverseKinematicsSolver } from './InverseKinematicsSolver';
import { ToolOrientationSolver } from './ToolOrientationSolver';
import { FiveAxisMotionPlanner, TrajectoryInputNode } from './FiveAxisMotionPlanner';
import { KinematicValidator, TrajectoryValidationSummary } from './KinematicValidator';
import { FiveAxisKinematicsEvidenceGenerator } from './FiveAxisKinematicsEvidence';

export class FiveAxisKinematicsEngine {
  /**
   * Returns standard catalog of industrial 5-axis machines
   */
  public static getIndustrialMachineCatalog(): Record<string, FiveAxisMachineDefinition> {
    const machines: Record<string, FiveAxisMachineDefinition> = {
      'DMG_MORI_DMU50_BC': {
        machineId: 'DMG_MORI_DMU50_BC',
        name: 'DMG MORI DMU 50 (Table-Table BC)',
        manufacturer: 'DMG MORI',
        architecture: 'TABLE_TABLE',
        topology: 'TABLE_TABLE_BC',
        kinematicChain: FiveAxisKinematicChain.buildKinematicChain('TABLE_TABLE', 'TABLE_TABLE_BC', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 250 }),
        linearLimits: {
          X: { min: -325, max: 325, maxVelocity: 42000, maxAcceleration: 6000 },
          Y: { min: -260, max: 260, maxVelocity: 42000, maxAcceleration: 6000 },
          Z: { min: -400, max: 150, maxVelocity: 42000, maxAcceleration: 6000 }
        },
        rotaryLimits: {
          primary: {
            axis: 'B',
            limits: { min: -110, max: 110, maxVelocity: 18000, maxAcceleration: 2500 },
            pivotCenterMm: { x: 0, y: 0, z: 0 },
            axisVector: { x: 0, y: 1, z: 0 },
            isContinuous: false
          },
          secondary: {
            axis: 'C',
            limits: { min: -9999, max: 9999, maxVelocity: 36000, maxAcceleration: 3500 },
            pivotCenterMm: { x: 0, y: 0, z: 0 },
            axisVector: { x: 0, y: 0, z: 1 },
            isContinuous: true
          }
        },
        gaugePivotOffsetMm: { x: 0, y: 0, z: 250 },
        tableCenterMm: { x: 0, y: 0, z: 0 },
        maxSpindleRpm: 20000,
        rapidFeedMmMin: 42000,
        singularityConeAngleDeg: 1.5,
        controllerType: 'SIEMENS_840D',
        workOffsetId: 'G54'
      },

      'HERMLE_C42U_AC': {
        machineId: 'HERMLE_C42U_AC',
        name: 'Hermle C 42 U MT (Table-Table AC Trunnion)',
        manufacturer: 'Hermle AG',
        architecture: 'TABLE_TABLE',
        topology: 'TABLE_TABLE_AC',
        kinematicChain: FiveAxisKinematicChain.buildKinematicChain('TABLE_TABLE', 'TABLE_TABLE_AC', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 280 }),
        linearLimits: {
          X: { min: -400, max: 400, maxVelocity: 45000, maxAcceleration: 6000 },
          Y: { min: -400, max: 400, maxVelocity: 45000, maxAcceleration: 6000 },
          Z: { min: -550, max: 100, maxVelocity: 45000, maxAcceleration: 6000 }
        },
        rotaryLimits: {
          primary: {
            axis: 'A',
            limits: { min: -115, max: 115, maxVelocity: 15000, maxAcceleration: 2200 },
            pivotCenterMm: { x: 0, y: 0, z: 0 },
            axisVector: { x: 1, y: 0, z: 0 },
            isContinuous: false
          },
          secondary: {
            axis: 'C',
            limits: { min: -9999, max: 9999, maxVelocity: 48000, maxAcceleration: 4000 },
            pivotCenterMm: { x: 0, y: 0, z: 0 },
            axisVector: { x: 0, y: 0, z: 1 },
            isContinuous: true
          }
        },
        gaugePivotOffsetMm: { x: 0, y: 0, z: 280 },
        tableCenterMm: { x: 0, y: 0, z: 0 },
        maxSpindleRpm: 24000,
        rapidFeedMmMin: 45000,
        singularityConeAngleDeg: 1.2,
        controllerType: 'HEIDENHAIN_TNC640',
        workOffsetId: 'G54'
      },

      'FIDIA_GTF_HEAD_HEAD_AB': {
        machineId: 'FIDIA_GTF_HEAD_HEAD_AB',
        name: 'FIDIA GTF3514 Gantry (Head-Head AB Swivel)',
        manufacturer: 'FIDIA S.p.A.',
        architecture: 'HEAD_HEAD',
        topology: 'HEAD_HEAD_AB',
        kinematicChain: FiveAxisKinematicChain.buildKinematicChain('HEAD_HEAD', 'HEAD_HEAD_AB', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 350 }),
        linearLimits: {
          X: { min: -1500, max: 1500, maxVelocity: 50000, maxAcceleration: 4000 },
          Y: { min: -1000, max: 1000, maxVelocity: 50000, maxAcceleration: 4000 },
          Z: { min: -800, max: 200, maxVelocity: 50000, maxAcceleration: 4000 }
        },
        rotaryLimits: {
          primary: {
            axis: 'A',
            limits: { min: -105, max: 105, maxVelocity: 12000, maxAcceleration: 1500 },
            pivotCenterMm: { x: 0, y: 0, z: 350 },
            axisVector: { x: 1, y: 0, z: 0 },
            isContinuous: false
          },
          secondary: {
            axis: 'B',
            limits: { min: -180, max: 180, maxVelocity: 15000, maxAcceleration: 1800 },
            pivotCenterMm: { x: 0, y: 0, z: 0 },
            axisVector: { x: 0, y: 1, z: 0 },
            isContinuous: false
          }
        },
        gaugePivotOffsetMm: { x: 0, y: 0, z: 350 },
        tableCenterMm: { x: 0, y: 0, z: 0 },
        maxSpindleRpm: 24000,
        rapidFeedMmMin: 50000,
        singularityConeAngleDeg: 2.0,
        controllerType: 'SIEMENS_840D',
        workOffsetId: 'G54'
      },

      'GROB_G350_HEAD_TABLE_BC': {
        machineId: 'GROB_G350_HEAD_TABLE_BC',
        name: 'GROB G350 Universal (Head-Table BC)',
        manufacturer: 'GROB-WERKE',
        architecture: 'HEAD_TABLE',
        topology: 'HEAD_TABLE_BC',
        kinematicChain: FiveAxisKinematicChain.buildKinematicChain('HEAD_TABLE', 'HEAD_TABLE_BC', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 260 }),
        linearLimits: {
          X: { min: -350, max: 350, maxVelocity: 60000, maxAcceleration: 7000 },
          Y: { min: -350, max: 350, maxVelocity: 60000, maxAcceleration: 7000 },
          Z: { min: -450, max: 150, maxVelocity: 60000, maxAcceleration: 7000 }
        },
        rotaryLimits: {
          primary: {
            axis: 'B',
            limits: { min: -120, max: 120, maxVelocity: 15000, maxAcceleration: 2500 },
            pivotCenterMm: { x: 0, y: 0, z: 260 },
            axisVector: { x: 0, y: 1, z: 0 },
            isContinuous: false
          },
          secondary: {
            axis: 'C',
            limits: { min: -9999, max: 9999, maxVelocity: 60000, maxAcceleration: 5000 },
            pivotCenterMm: { x: 0, y: 0, z: 0 },
            axisVector: { x: 0, y: 0, z: 1 },
            isContinuous: true
          }
        },
        gaugePivotOffsetMm: { x: 0, y: 0, z: 260 },
        tableCenterMm: { x: 0, y: 0, z: 0 },
        maxSpindleRpm: 18000,
        rapidFeedMmMin: 60000,
        singularityConeAngleDeg: 1.0,
        controllerType: 'HEIDENHAIN_TNC640',
        workOffsetId: 'G54'
      }
    };

    return machines;
  }

  /**
   * Generates benchmark trajectory nodes for standard reference benchmarks
   */
  public static generateBenchmarkNodes(config: FiveAxisBenchmarkConfig): TrajectoryInputNode[] {
    const nodes: TrajectoryInputNode[] = [];

    if (config.id === 'BENCHMARK_A') {
      // ----------------------------------------------------
      // BENCHMARK A: Indexed 5-Axis (3+2) Machining
      // 5-sided prismatic part with 5 discrete workplane orientations
      // ----------------------------------------------------
      const orientations: { name: string; tcp: Vector3D; vec: Vector3D }[] = [
        // Top Face (Z+)
        { name: 'TOP_CENTER', tcp: { x: 0, y: 0, z: 50 }, vec: { x: 0, y: 0, z: 1 } },
        { name: 'TOP_SLOT_1', tcp: { x: -30, y: 0, z: 50 }, vec: { x: 0, y: 0, z: 1 } },
        { name: 'TOP_SLOT_2', tcp: { x: 30, y: 0, z: 50 }, vec: { x: 0, y: 0, z: 1 } },
        // Front Face (Tilted +45° around X)
        { name: 'FRONT_APPROACH', tcp: { x: 0, y: -40, z: 30 }, vec: { x: 0, y: -0.7071, z: 0.7071 } },
        { name: 'FRONT_POCKET', tcp: { x: 20, y: -40, z: 30 }, vec: { x: 0, y: -0.7071, z: 0.7071 } },
        // Right Face (Tilted +45° around Y)
        { name: 'RIGHT_APPROACH', tcp: { x: 40, y: 0, z: 30 }, vec: { x: 0.7071, y: 0, z: 0.7071 } },
        { name: 'RIGHT_POCKET', tcp: { x: 40, y: 20, z: 30 }, vec: { x: 0.7071, y: 0, z: 0.7071 } },
        // Back Face (Tilted -45° around X)
        { name: 'BACK_APPROACH', tcp: { x: 0, y: 40, z: 30 }, vec: { x: 0, y: 0.7071, z: 0.7071 } },
        // Left Face (Tilted -45° around Y)
        { name: 'LEFT_APPROACH', tcp: { x: -40, y: 0, z: 30 }, vec: { x: -0.7071, y: 0, z: 0.7071 } }
      ];

      for (let i = 0; i < orientations.length; i++) {
        nodes.push({
          tcp: orientations[i].tcp,
          toolOrientation: orientations[i].vec,
          feedMmMin: i % 2 === 0 ? 3000 : 1200,
          motionType: i === 0 || i % 2 === 1 ? 'RAPID' : 'INDEXED_MOVE',
          spindleRpm: 12000
        });
      }
    } else if (config.id === 'BENCHMARK_B') {
      // ----------------------------------------------------
      // BENCHMARK B: Simultaneous Freeform Impeller Blade
      // Continuous changing normal, lead 7.5°, tilt 3.0°
      // ----------------------------------------------------
      const numSteps = 30;
      for (let i = 0; i <= numSteps; i++) {
        const u = i / numSteps;
        const theta = u * Math.PI * 0.75; // 0 to 135 deg sweep
        const radius = 60 + Math.sin(u * Math.PI) * 15;
        const x = radius * Math.cos(theta);
        const y = radius * Math.sin(theta);
        const z = 20 + 30 * Math.sin(u * Math.PI * 0.8);

        // Surface normal tilts dynamically along the curve
        const nx = Math.cos(theta) * 0.6;
        const ny = Math.sin(theta) * 0.6;
        const nz = 0.8 - 0.4 * u;
        const normN = FiveAxisMathUtils.normalize({ x: nx, y: ny, z: nz });

        // Feed tangent is along derivative
        const tx = -radius * Math.sin(theta);
        const ty = radius * Math.cos(theta);
        const tz = 24 * Math.cos(u * Math.PI * 0.8);
        const tangent = FiveAxisMathUtils.normalize({ x: tx, y: ty, z: tz });

        const orientControl: SurfaceOrientationControl = {
          surfaceNormal: normN,
          feedTangentVector: tangent,
          leadAngleDeg: 7.5,
          tiltAngleDeg: 3.0
        };

        const toolVec = ToolOrientationSolver.computeToolAxisVector(orientControl);

        nodes.push({
          tcp: { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), z: Number(z.toFixed(4)) },
          toolOrientation: toolVec,
          feedMmMin: 1800,
          surfaceNormal: normN,
          leadAngleDeg: 7.5,
          tiltAngleDeg: 3.0,
          motionType: 'LINEAR',
          spindleRpm: 15000
        });
      }
    } else if (config.id === 'BENCHMARK_C') {
      // ----------------------------------------------------
      // BENCHMARK C: Complex 360° Turbine Shroud Swarf
      // Continuous 360-degree rotation testing rotary unwinding
      // ----------------------------------------------------
      const numSteps = 40;
      for (let i = 0; i <= numSteps; i++) {
        const u = i / numSteps;
        const angle = u * 2 * Math.PI; // Full 360°
        const r = 70;
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);
        const z = 15 + 10 * Math.sin(angle * 2);

        // Swarf tool axis tilted towards cylinder axis by 20°
        const tiltInwardRad = 20 * FiveAxisMathUtils.DEG2RAD;
        const I = -Math.cos(angle) * Math.sin(tiltInwardRad);
        const J = -Math.sin(angle) * Math.sin(tiltInwardRad);
        const K = Math.cos(tiltInwardRad);
        const toolVec = FiveAxisMathUtils.normalize({ x: I, y: J, z: K });

        nodes.push({
          tcp: { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), z: Number(z.toFixed(4)) },
          toolOrientation: toolVec,
          feedMmMin: 2200,
          motionType: 'LINEAR',
          spindleRpm: 16000
        });
      }
    } else if (config.id === 'BENCHMARK_D') {
      // ----------------------------------------------------
      // BENCHMARK D: Near-Singularity Path
      // Trajectory sweeps right through vertical pole (K = 1.0)
      // ----------------------------------------------------
      const numSteps = 25;
      for (let i = 0; i <= numSteps; i++) {
        const u = (i - numSteps / 2) / (numSteps / 2); // -1.0 to +1.0
        const x = u * 50;
        const y = 0;
        const z = 30;

        // Tool vector tilts across pole: at u=0, vector is purely vertical [0, 0, 1]
        const tiltDeg = u * 15; // -15° to +15°
        const tiltRad = tiltDeg * FiveAxisMathUtils.DEG2RAD;
        const I = Math.sin(tiltRad);
        const J = 0;
        const K = Math.cos(tiltRad);
        const toolVec = FiveAxisMathUtils.normalize({ x: I, y: J, z: K });

        nodes.push({
          tcp: { x: Number(x.toFixed(4)), y: 0, z: 30 },
          toolOrientation: toolVec,
          feedMmMin: 1200,
          motionType: 'LINEAR',
          spindleRpm: 12000
        });
      }
    } else {
      // ----------------------------------------------------
      // BENCHMARK E: Multi-Architecture Comparative Trajectory
      // 3D Arc with varying tilt across 3 machines
      // ----------------------------------------------------
      const numSteps = 20;
      for (let i = 0; i <= numSteps; i++) {
        const u = i / numSteps;
        const theta = u * Math.PI * 0.5;
        const x = 50 * Math.cos(theta);
        const y = 50 * Math.sin(theta);
        const z = 25 + 15 * u;

        const tiltRad = (10 + 20 * u) * FiveAxisMathUtils.DEG2RAD;
        const I = Math.sin(tiltRad) * Math.cos(theta);
        const J = Math.sin(tiltRad) * Math.sin(theta);
        const K = Math.cos(tiltRad);
        const toolVec = FiveAxisMathUtils.normalize({ x: I, y: J, z: K });

        nodes.push({
          tcp: { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), z: Number(z.toFixed(4)) },
          toolOrientation: toolVec,
          feedMmMin: 1500,
          motionType: 'LINEAR',
          spindleRpm: 14000
        });
      }
    }

    return nodes;
  }

  /**
   * Executes a reference benchmark against a specific machine definition
   */
  public static runBenchmark(
    benchmarkId: 'BENCHMARK_A' | 'BENCHMARK_B' | 'BENCHMARK_C' | 'BENCHMARK_D' | 'BENCHMARK_E',
    machineId?: string
  ): {
    config: FiveAxisBenchmarkConfig;
    machine: FiveAxisMachineDefinition;
    path: MachineIndependent5AxisPath;
    validation: TrajectoryValidationSummary;
    evidence: any;
  } {
    const catalog = this.getIndustrialMachineCatalog();
    const targetMachine = (machineId && catalog[machineId]) ? catalog[machineId] : catalog['HERMLE_C42U_AC'];

    const benchmarkConfigs: Record<string, FiveAxisBenchmarkConfig> = {
      'BENCHMARK_A': {
        id: 'BENCHMARK_A',
        name: 'Indexed 5-Axis (3+2) Prismatic Block',
        description: 'Multi-plane indexed machining at 5 discrete workplane orientations',
        capability: 'INDEXED_5_AXIS',
        targetToleranceMm: 0.005,
        targetMaxResidualMm: 1e-4,
        machineArchitecture: targetMachine.architecture,
        toolLengthMm: 120,
        toolRadiusMm: 6
      },
      'BENCHMARK_B': {
        id: 'BENCHMARK_B',
        name: 'Simultaneous Impeller Sculptured Surface',
        description: 'Continuous 5-axis surface path with dynamic Lead (7.5°) and Tilt (3.0°)',
        capability: 'SIMULTANEOUS_5_AXIS',
        targetToleranceMm: 0.005,
        targetMaxResidualMm: 1e-4,
        machineArchitecture: targetMachine.architecture,
        toolLengthMm: 120,
        toolRadiusMm: 6
      },
      'BENCHMARK_C': {
        id: 'BENCHMARK_C',
        name: '360° Turbine Shroud Swarf Contouring',
        description: 'Full 360° rotary continuous trajectory with rotary unwinding & continuity',
        capability: 'SIMULTANEOUS_5_AXIS',
        targetToleranceMm: 0.005,
        targetMaxResidualMm: 1e-4,
        machineArchitecture: targetMachine.architecture,
        toolLengthMm: 120,
        toolRadiusMm: 6
      },
      'BENCHMARK_D': {
        id: 'BENCHMARK_D',
        name: 'Near-Singularity Pole Crossing',
        description: 'Trajectory sweeping near/through vertical singular pole with avoidance',
        capability: 'SIMULTANEOUS_5_AXIS',
        targetToleranceMm: 0.005,
        targetMaxResidualMm: 1e-4,
        machineArchitecture: targetMachine.architecture,
        toolLengthMm: 120,
        toolRadiusMm: 6
      },
      'BENCHMARK_E': {
        id: 'BENCHMARK_E',
        name: 'Cross-Architecture Multi-Machine Comparison',
        description: 'Identical TCP trajectory evaluated across Table-Table, Head-Head, and Head-Table',
        capability: 'SIMULTANEOUS_5_AXIS',
        targetToleranceMm: 0.005,
        targetMaxResidualMm: 1e-4,
        machineArchitecture: targetMachine.architecture,
        toolLengthMm: 120,
        toolRadiusMm: 6
      }
    };

    const config = benchmarkConfigs[benchmarkId];
    const nodes = this.generateBenchmarkNodes(config);
    const path = FiveAxisMotionPlanner.planTrajectory(
      targetMachine,
      nodes,
      config.capability,
      config.toolLengthMm,
      { autoAvoidSingularity: benchmarkId === 'BENCHMARK_D' }
    );

    const validation = KinematicValidator.validatePath(targetMachine, path, config.toolLengthMm);
    const evidence = FiveAxisKinematicsEvidenceGenerator.generateEvidence(targetMachine, path, validation);

    return {
      config,
      machine: targetMachine,
      path,
      validation,
      evidence
    };
  }
}
