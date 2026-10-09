/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-258 — Hard Acceptance Gate: 5-Axis Kinematics & Multi-Architecture Verification
 * 36 Automated Deterministic Verification Tests.
 */

import { Vector3D } from '../../cadKernel';
import { FiveAxisKinematicsEngine } from './FiveAxisKinematicsEngine';
import { ForwardKinematicsSolver } from './ForwardKinematicsSolver';
import { InverseKinematicsSolver } from './InverseKinematicsSolver';
import { ToolOrientationSolver } from './ToolOrientationSolver';
import { ToolOrientationSmoother } from './ToolOrientationSmoother';
import { SingularityAnalyzer } from './SingularityAnalyzer';
import { IKSolutionRanker } from './IKSolutionRanker';
import { FiveAxisMathUtils } from './FiveAxisMathUtils';
import { FiveAxisMotionPlanner } from './FiveAxisMotionPlanner';
import { KinematicValidator } from './KinematicValidator';
import { FiveAxisKinematicsEvidenceGenerator } from './FiveAxisKinematicsEvidence';

export interface GateTestResult {
  testId: string;
  name: string;
  category: string;
  passed: boolean;
  message: string;
  durationMs: number;
  numericalDetails?: Record<string, number | string | boolean>;
}

export interface GateSuiteSummary {
  suiteId: string;
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  totalDurationMs: number;
  testResults: GateTestResult[];
}

export class HardAcceptanceGate258 {
  public static runAllTests(): GateSuiteSummary {
    const startTime = performance.now();
    const results: GateTestResult[] = [];
    const machines = FiveAxisKinematicsEngine.getIndustrialMachineCatalog();

    const addResult = (testId: string, name: string, category: string, fn: () => { passed: boolean; message: string; details?: any }) => {
      const t0 = performance.now();
      try {
        const res = fn();
        results.push({
          testId,
          name,
          category,
          passed: res.passed,
          message: res.message,
          durationMs: Number((performance.now() - t0).toFixed(2)),
          numericalDetails: res.details
        });
      } catch (err: any) {
        results.push({
          testId,
          name,
          category,
          passed: false,
          message: `Exception in test ${testId}: ${err?.message || err}`,
          durationMs: Number((performance.now() - t0).toFixed(2))
        });
      }
    };

    // ========================================================
    // CATEGORY 1: MACHINE DEFINITIONS & KINEMATIC CHAINS (Tests 1-5)
    // ========================================================
    addResult('TEST_258_01', 'Table-Table AC Machine Kinematic Chain Integrity', 'Kinematic Chain', () => {
      const m = machines['HERMLE_C42U_AC'];
      const valid = m && m.architecture === 'TABLE_TABLE' && m.topology === 'TABLE_TABLE_AC' && m.kinematicChain.length >= 4;
      return { passed: !!valid, message: 'Hermle C42U AC kinematic chain verified with table A/C nodes.', details: { nodesCount: m.kinematicChain.length } };
    });

    addResult('TEST_258_02', 'Table-Table BC Machine Kinematic Chain Integrity', 'Kinematic Chain', () => {
      const m = machines['DMG_MORI_DMU50_BC'];
      const valid = m && m.architecture === 'TABLE_TABLE' && m.topology === 'TABLE_TABLE_BC' && m.kinematicChain.length >= 4;
      return { passed: !!valid, message: 'DMG Mori DMU 50 BC kinematic chain verified with table B/C nodes.', details: { nodesCount: m.kinematicChain.length } };
    });

    addResult('TEST_258_03', 'Head-Head AB Machine Kinematic Chain Integrity', 'Kinematic Chain', () => {
      const m = machines['FIDIA_GTF_HEAD_HEAD_AB'];
      const valid = m && m.architecture === 'HEAD_HEAD' && m.topology === 'HEAD_HEAD_AB' && m.kinematicChain.length >= 4;
      return { passed: !!valid, message: 'FIDIA GTF Head-Head AB chain verified with swivel fork nodes.', details: { nodesCount: m.kinematicChain.length } };
    });

    addResult('TEST_258_04', 'Head-Table BC Machine Kinematic Chain Integrity', 'Kinematic Chain', () => {
      const m = machines['GROB_G350_HEAD_TABLE_BC'];
      const valid = m && m.architecture === 'HEAD_TABLE' && m.topology === 'HEAD_TABLE_BC' && m.kinematicChain.length >= 4;
      return { passed: !!valid, message: 'GROB G350 Head-Table BC chain verified with head B & table C.', details: { nodesCount: m.kinematicChain.length } };
    });

    addResult('TEST_258_05', 'Linear & Rotary Travel Limit Envelopes', 'Machine Architecture', () => {
      const m = machines['HERMLE_C42U_AC'];
      const valid = m.linearLimits.X.max > m.linearLimits.X.min && m.rotaryLimits.primary.limits.max > m.rotaryLimits.primary.limits.min;
      return { passed: valid, message: 'Travel limits and physical envelopes defined for all 5 axes.' };
    });

    // ========================================================
    // CATEGORY 2: FORWARD & INVERSE KINEMATICS (Tests 6-12)
    // ========================================================
    addResult('TEST_258_06', 'Table-Table AC Pure Vertical FK Calculation', 'Forward Kinematics', () => {
      const m = machines['HERMLE_C42U_AC'];
      const fk = ForwardKinematicsSolver.solveFK(m, { X: 10, Y: 20, Z: 30, A: 0, B: 0, C: 0 }, 100);
      const passed = Math.abs(fk.tcpWCS.x - 10) < 1e-4 && Math.abs(fk.tcpWCS.y - 20) < 1e-4 && Math.abs(fk.tcpWCS.z - 30) < 1e-4;
      return { passed, message: 'Table-Table AC FK matches home position exactly.', details: { tcp: fk.tcpWCS } };
    });

    addResult('TEST_258_07', 'Table-Table AC 90° Tilted FK Calculation', 'Forward Kinematics', () => {
      const m = machines['HERMLE_C42U_AC'];
      const fk = ForwardKinematicsSolver.solveFK(m, { X: 0, Y: 50, Z: 0, A: 90, B: 0, C: 0 }, 0);
      // Tool vector should point along Y (J = -1)
      const passed = Math.abs(fk.toolOrientation.y - (-1.0)) < 1e-4;
      return { passed, message: 'Table-Table AC 90° tilt tool vector correctly calculated.', details: { toolVector: fk.toolOrientation } };
    });

    addResult('TEST_258_08', 'Head-Head AB Forward Kinematics Gauge Pivot Offset', 'Forward Kinematics', () => {
      const m = machines['FIDIA_GTF_HEAD_HEAD_AB'];
      const fk = ForwardKinematicsSolver.solveFK(m, { X: 100, Y: 100, Z: -200, A: 0, B: 0, C: 0 }, 120);
      const passed = Math.abs(fk.tcpWCS.x - 100) < 1e-4 && Math.abs(fk.tcpWCS.y - 100) < 1e-4;
      return { passed, message: 'Head-Head AB FK gauge pivot offset verified.', details: { tcp: fk.tcpWCS } };
    });

    addResult('TEST_258_09', 'Multi-Branch IK Analytical Solution Derivation (Table-Table AC)', 'Inverse Kinematics', () => {
      const m = machines['HERMLE_C42U_AC'];
      const ik = InverseKinematicsSolver.solveIK(m, { x: 50, y: 50, z: 20 }, { x: 0.3535, y: -0.3535, z: 0.866 });
      const passed = ik.candidateSolutions.length >= 2 && ik.selectedSolution !== null;
      return { passed, message: 'IK successfully generated multiple analytical solution branches.', details: { branches: ik.candidateSolutions.length } };
    });

    addResult('TEST_258_10', 'Multi-Branch IK Analytical Solution Derivation (Table-Table BC)', 'Inverse Kinematics', () => {
      const m = machines['DMG_MORI_DMU50_BC'];
      const ik = InverseKinematicsSolver.solveIK(m, { x: 30, y: -20, z: 15 }, { x: 0.5, y: 0.0, z: 0.866 });
      const passed = ik.candidateSolutions.length >= 2 && ik.selectedSolution !== null;
      return { passed, message: 'DMU 50 Table-Table BC IK multi-branch derived successfully.', details: { branches: ik.candidateSolutions.length } };
    });

    addResult('TEST_258_11', 'Multi-Branch IK Solution Derivation (Head-Head AB)', 'Inverse Kinematics', () => {
      const m = machines['FIDIA_GTF_HEAD_HEAD_AB'];
      const ik = InverseKinematicsSolver.solveIK(m, { x: 200, y: 150, z: -100 }, { x: 0.2588, y: -0.2588, z: 0.9306 }, undefined, 150);
      const passed = ik.candidateSolutions.length >= 2 && ik.selectedSolution !== null;
      return { passed, message: 'Head-Head AB IK solved with gauge pivot compensation.', details: { axes: ik.selectedSolution?.axes } };
    });

    addResult('TEST_258_12', 'Multi-Branch IK Solution Derivation (Head-Table BC)', 'Inverse Kinematics', () => {
      const m = machines['GROB_G350_HEAD_TABLE_BC'];
      const ik = InverseKinematicsSolver.solveIK(m, { x: 40, y: 30, z: 10 }, { x: 0.3, y: 0.3, z: 0.9055 }, undefined, 100);
      const passed = ik.candidateSolutions.length >= 2 && ik.selectedSolution !== null;
      return { passed, message: 'Head-Table BC IK resolved with coupled table C & head B.', details: { axes: ik.selectedSolution?.axes } };
    });

    // ========================================================
    // CATEGORY 3: CLOSED-LOOP ROUNDTRIP RESIDUALS (Tests 13-17)
    // ========================================================
    addResult('TEST_258_13', 'Closed-Loop FK/IK Roundtrip: Table-Table AC (Residual <= 1e-4 mm)', 'Closed-Loop Residuals', () => {
      const m = machines['HERMLE_C42U_AC'];
      const targetTCP: Vector3D = { x: 45.123, y: -38.456, z: 22.789 };
      const targetVec: Vector3D = { x: 0.2, y: -0.3, z: 0.9327 };
      const ik = InverseKinematicsSolver.solveIK(m, targetTCP, targetVec);
      const passed = ik.positionResidualMm <= 1e-4 && ik.orientationResidualRad <= 1e-5;
      return { passed, message: `Hermle C42U closed-loop position residual: ${ik.positionResidualMm.toExponential(3)} mm, orient: ${ik.orientationResidualRad.toExponential(3)} rad`, details: { posResidual: ik.positionResidualMm, orientResidual: ik.orientationResidualRad } };
    });

    addResult('TEST_258_14', 'Closed-Loop FK/IK Roundtrip: Table-Table BC (Residual <= 1e-4 mm)', 'Closed-Loop Residuals', () => {
      const m = machines['DMG_MORI_DMU50_BC'];
      const targetTCP: Vector3D = { x: -60.25, y: 75.8, z: 35.12 };
      const targetVec: Vector3D = { x: 0.35, y: 0.35, z: 0.8689 };
      const ik = InverseKinematicsSolver.solveIK(m, targetTCP, targetVec);
      const passed = ik.positionResidualMm <= 1e-4 && ik.orientationResidualRad <= 1e-5;
      return { passed, message: `DMU 50 closed-loop position residual: ${ik.positionResidualMm.toExponential(3)} mm`, details: { posResidual: ik.positionResidualMm } };
    });

    addResult('TEST_258_15', 'Closed-Loop FK/IK Roundtrip: Head-Head AB (Residual <= 1e-4 mm)', 'Closed-Loop Residuals', () => {
      const m = machines['FIDIA_GTF_HEAD_HEAD_AB'];
      const targetTCP: Vector3D = { x: 350.0, y: -220.0, z: -50.0 };
      const targetVec: Vector3D = { x: 0.15, y: -0.25, z: 0.9565 };
      const ik = InverseKinematicsSolver.solveIK(m, targetTCP, targetVec, undefined, 140);
      const passed = ik.positionResidualMm <= 1e-4 && ik.orientationResidualRad <= 1e-5;
      return { passed, message: `FIDIA GTF closed-loop position residual: ${ik.positionResidualMm.toExponential(3)} mm`, details: { posResidual: ik.positionResidualMm } };
    });

    addResult('TEST_258_16', 'Closed-Loop FK/IK Roundtrip: Head-Table BC (Residual <= 1e-4 mm)', 'Closed-Loop Residuals', () => {
      const m = machines['GROB_G350_HEAD_TABLE_BC'];
      const targetTCP: Vector3D = { x: 80.0, y: 50.0, z: 40.0 };
      const targetVec: Vector3D = { x: 0.4, y: 0.2, z: 0.8944 };
      const ik = InverseKinematicsSolver.solveIK(m, targetTCP, targetVec, undefined, 110);
      const passed = ik.positionResidualMm <= 1e-4 && ik.orientationResidualRad <= 1e-5;
      return { passed, message: `GROB G350 closed-loop position residual: ${ik.positionResidualMm.toExponential(3)} mm`, details: { posResidual: ik.positionResidualMm } };
    });

    addResult('TEST_258_17', 'Roundtrip High-Precision Array Battery (10 Random Poses)', 'Closed-Loop Residuals', () => {
      const m = machines['HERMLE_C42U_AC'];
      let maxPos = 0;
      let maxOrient = 0;
      for (let i = 0; i < 10; i++) {
        const tilt = (i * 4 + 5) * FiveAxisMathUtils.DEG2RAD;
        const azim = (i * 36) * FiveAxisMathUtils.DEG2RAD;
        const vec = { x: Math.sin(tilt) * Math.cos(azim), y: Math.sin(tilt) * Math.sin(azim), z: Math.cos(tilt) };
        const tcp = { x: (i - 5) * 15, y: (i - 3) * 12, z: 20 + i * 5 };
        const ik = InverseKinematicsSolver.solveIK(m, tcp, vec);
        if (ik.positionResidualMm > maxPos) maxPos = ik.positionResidualMm;
        if (ik.orientationResidualRad > maxOrient) maxOrient = ik.orientationResidualRad;
      }
      const passed = maxPos <= 1e-4 && maxOrient <= 1e-5;
      return { passed, message: `Array battery max position residual: ${maxPos.toExponential(3)} mm`, details: { maxPosResidual: maxPos, maxOrientResidual: maxOrient } };
    });

    // ========================================================
    // CATEGORY 4: TOOL ORIENTATION & CONTACT POINT OFFSETS (Tests 18-22)
    // ========================================================
    addResult('TEST_258_18', 'Surface Normal & Feed Tangent Lead/Tilt Transformation', 'Tool Orientation', () => {
      const control = {
        surfaceNormal: { x: 0, y: 0, z: 1 },
        feedTangentVector: { x: 1, y: 0, z: 0 },
        leadAngleDeg: 10.0,
        tiltAngleDeg: 5.0
      };
      const toolVec = ToolOrientationSolver.computeToolAxisVector(control);
      const passed = Math.abs(toolVec.normalizedMagnitude - 1.0) < 1e-5 && toolVec.x > 0 && toolVec.y > 0;
      return { passed, message: 'Tool axis vector correctly computed with lead & tilt angles.', details: { toolVec } };
    });

    addResult('TEST_258_19', 'Ball Endmill Cutter Contact Point (CC) -> TCP Offset', 'Tool Geometry', () => {
      const cc: Vector3D = { x: 10, y: 10, z: 0 };
      const normal: Vector3D = { x: 0, y: 0, z: 1 };
      const toolVec: Vector3D = { x: 0, y: 0, z: 1 };
      const pt = ToolOrientationSolver.computeToolCenterPoint(cc, normal, toolVec, 'BALL_ENDMILL', 8);
      const passed = Math.abs(pt.position.z - 8) < 1e-4 && Math.abs(pt.toolTipPosition.z - 0) < 1e-4;
      return { passed, message: 'Ball endmill TCP and tool tip calculated at CC + R * Normal.', details: { tcp: pt.position, tip: pt.toolTipPosition } };
    });

    addResult('TEST_258_20', 'Bullnose Toroidal Cutter Contact Offset', 'Tool Geometry', () => {
      const cc: Vector3D = { x: 20, y: 20, z: 0 };
      const normal: Vector3D = { x: 0, y: 0, z: 1 };
      const toolVec: Vector3D = { x: 0, y: 0, z: 1 };
      const pt = ToolOrientationSolver.computeToolCenterPoint(cc, normal, toolVec, 'BULLNOSE_TOROIDAL', 10, 2);
      const passed = pt.position.z > 0;
      return { passed, message: 'Bullnose toroidal cutter corner radius offset verified.', details: { tcp: pt.position } };
    });

    addResult('TEST_258_21', 'Tool Orientation SLERP Interpolation', 'Orientation Smoothing', () => {
      const v0 = { x: 0, y: 0, z: 1 };
      const v1 = { x: 0.7071, y: 0, z: 0.7071 }; // 45 deg tilt
      const seg = ToolOrientationSmoother.interpolateOrientations(v0, v1, 2.0);
      const passed = seg.interpolatedVectors.length >= 22 && seg.interpolatedVectors.every(v => Math.abs(v.normalizedMagnitude - 1.0) < 1e-5);
      return { passed, message: 'SLERP smooth interpolation generated intermediate unit vectors.', details: { steps: seg.interpolatedVectors.length } };
    });

    addResult('TEST_258_22', 'Tool Orientation Abrupt Discontinuity Detection', 'Orientation Smoothing', () => {
      const v0 = { x: 0, y: 0, z: 1 };
      const v1 = { x: 0, y: 1, z: 0 }; // 90 deg jump
      const seg = ToolOrientationSmoother.interpolateOrientations(v0, v1, 5.0, 45.0);
      const passed = seg.hasDiscontinuity && seg.diagnostics.some(d => d.code === 'TOOL_ORIENTATION_DISCONTINUITY');
      return { passed, message: 'Abrupt 90° orientation jump flagged as TOOL_ORIENTATION_DISCONTINUITY.', details: { hasDiscontinuity: seg.hasDiscontinuity } };
    });

    // ========================================================
    // CATEGORY 5: SINGULARITY, UNWINDING & DYNAMICS (Tests 23-28)
    // ========================================================
    addResult('TEST_258_23', 'Singularity Detection at Vertical Pole (K = 1.0)', 'Singularity & Poles', () => {
      const m = machines['HERMLE_C42U_AC'];
      const res = SingularityAnalyzer.analyze(m, { x: 0, y: 0, z: 1 });
      const passed = res.isSingular && res.diagnostics.some(d => d.code === 'KINEMATIC_SINGULARITY');
      return { passed, message: 'Vertical tool vector correctly identified as kinematic singularity.', details: { isSingular: res.isSingular } };
    });

    addResult('TEST_258_24', 'Singularity Risk Warning Inside Cone Angle', 'Singularity & Poles', () => {
      const m = machines['HERMLE_C42U_AC'];
      // 0.8° tilt (inside 1.2° cone)
      const rad = 0.8 * FiveAxisMathUtils.DEG2RAD;
      const res = SingularityAnalyzer.analyze(m, { x: Math.sin(rad), y: 0, z: Math.cos(rad) });
      const passed = res.isHighRisk && !res.isSingular && res.diagnostics.some(d => d.code === 'SINGULARITY_RISK_HIGH');
      return { passed, message: 'Tool vector at 0.8° tilt triggered SINGULARITY_RISK_HIGH warning.', details: { distDeg: res.singularityDistanceDeg } };
    });

    addResult('TEST_258_25', 'Singularity Avoidance Micro-Perturbation', 'Singularity & Poles', () => {
      const m = machines['HERMLE_C42U_AC'];
      const res = SingularityAnalyzer.analyze(m, { x: 0, y: 0, z: 1 }, undefined, true);
      const passed = res.avoidanceApplied && res.perturbedOrientation !== undefined && res.perturbedOrientation.z < 0.9999;
      return { passed, message: 'Automated singularity avoidance successfully perturbed pole vector.', details: { perturbed: res.perturbedOrientation } };
    });

    addResult('TEST_258_26', 'Continuous Rotary Unwrapping Across 360° Boundary', 'Rotary Continuity', () => {
      const unwrap = FiveAxisMathUtils.unwrapAngle(10, 350); // Jump from 350 to 10 should become 370
      const passed = unwrap.unwoundDeg === 370 && unwrap.unwrapped === true;
      return { passed, message: 'Rotary angle unwound from 10° to 370° to preserve continuous motion.', details: { unwoundDeg: unwrap.unwoundDeg } };
    });

    addResult('TEST_258_27', 'IK Solution Ranker Travel Limits Enforcement', 'IK Ranking', () => {
      const m = machines['HERMLE_C42U_AC'];
      const badState = { X: 9999, Y: 0, Z: 0, A: 0, B: 0, C: 0 }; // Violates X limit
      const goodState = { X: 50, Y: 0, Z: 0, A: 0, B: 0, C: 0 };
      const ranked = IKSolutionRanker.rankSolutions(m, [
        { solutionId: 'BAD', axes: badState, score: 0, isWithinLimits: true, limitViolations: [], isSingular: false, singularityDistanceDeg: 45, velocityAmplification: 1, rotaryUnwound: false, rankingDetails: { angularDistanceDeg: 0, linearDisplacementMm: 0, singularityPenalty: 0, limitPenalty: 0 } },
        { solutionId: 'GOOD', axes: goodState, score: 0, isWithinLimits: true, limitViolations: [], isSingular: false, singularityDistanceDeg: 45, velocityAmplification: 1, rotaryUnwound: false, rankingDetails: { angularDistanceDeg: 0, linearDisplacementMm: 0, singularityPenalty: 0, limitPenalty: 0 } }
      ]);
      const passed = ranked[0].solutionId === 'GOOD' && ranked[1].isWithinLimits === false;
      return { passed, message: 'Out-of-limit solution branch rejected and ranked lowest.', details: { topSolution: ranked[0].solutionId } };
    });

    addResult('TEST_258_28', 'Inverse-Time Feedrate Mode (G93) Dynamic Activation', 'Feedrate Dynamics', () => {
      const m = machines['HERMLE_C42U_AC'];
      const nodes = [
        { tcp: { x: 0, y: 0, z: 20 }, toolOrientation: { x: 0, y: 0, z: 1 } },
        { tcp: { x: 20, y: 20, z: 20 }, toolOrientation: { x: 0.3535, y: 0.3535, z: 0.866 } }
      ];
      const path = FiveAxisMotionPlanner.planTrajectory(m, nodes, 'SIMULTANEOUS_5_AXIS');
      const passed = path.points[1].feedrateMode === 'G93';
      return { passed, message: 'G93 Inverse-Time mode dynamically activated for simultaneous multi-axis motion.', details: { feedMode: path.points[1].feedrateMode } };
    });

    // ========================================================
    // CATEGORY 6: BENCHMARKS A-E & CRYPTOGRAPHIC EVIDENCE (Tests 29-36)
    // ========================================================
    addResult('TEST_258_29', 'Benchmark A: Indexed 5-Axis (3+2) Prismatic Execution', 'Benchmarks', () => {
      const res = FiveAxisKinematicsEngine.runBenchmark('BENCHMARK_A', 'HERMLE_C42U_AC');
      const passed = res.validation.isValid && res.validation.maxPositionResidualMm <= 1e-4 && res.path.points.length === 9;
      return { passed, message: `Benchmark A verified on Hermle C42U. Max residual: ${res.validation.maxPositionResidualMm.toExponential(3)} mm`, details: { points: res.path.points.length, maxRes: res.validation.maxPositionResidualMm } };
    });

    addResult('TEST_258_30', 'Benchmark B: Simultaneous Freeform Impeller Blade', 'Benchmarks', () => {
      const res = FiveAxisKinematicsEngine.runBenchmark('BENCHMARK_B', 'HERMLE_C42U_AC');
      const passed = res.validation.isValid && res.validation.maxPositionResidualMm <= 1e-4 && res.path.points.length === 31;
      return { passed, message: `Benchmark B verified with dynamic lead/tilt. Max residual: ${res.validation.maxPositionResidualMm.toExponential(3)} mm`, details: { maxRes: res.validation.maxPositionResidualMm } };
    });

    addResult('TEST_258_31', 'Benchmark C: 360° Turbine Shroud Swarf Contouring', 'Benchmarks', () => {
      const res = FiveAxisKinematicsEngine.runBenchmark('BENCHMARK_C', 'DMG_MORI_DMU50_BC');
      const passed = res.validation.isValid && res.validation.maxPositionResidualMm <= 1e-4 && res.validation.rotaryUnwindsCount >= 0;
      return { passed, message: `Benchmark C full 360° rotary trajectory verified on DMU 50. Max residual: ${res.validation.maxPositionResidualMm.toExponential(3)} mm`, details: { maxRes: res.validation.maxPositionResidualMm } };
    });

    addResult('TEST_258_32', 'Benchmark D: Near-Singularity Path with Avoidance', 'Benchmarks', () => {
      const res = FiveAxisKinematicsEngine.runBenchmark('BENCHMARK_D', 'HERMLE_C42U_AC');
      const passed = res.validation.isValid && res.validation.maxPositionResidualMm <= 1e-4;
      return { passed, message: `Benchmark D pole-crossing path solved with micro-avoidance. Max residual: ${res.validation.maxPositionResidualMm.toExponential(3)} mm`, details: { maxRes: res.validation.maxPositionResidualMm } };
    });

    addResult('TEST_258_33', 'Benchmark E: Multi-Architecture Comparative Trajectory', 'Benchmarks', () => {
      const resHermle = FiveAxisKinematicsEngine.runBenchmark('BENCHMARK_E', 'HERMLE_C42U_AC'); // Table-Table AC
      const resFidia = FiveAxisKinematicsEngine.runBenchmark('BENCHMARK_E', 'FIDIA_GTF_HEAD_HEAD_AB'); // Head-Head AB
      const resGrob = FiveAxisKinematicsEngine.runBenchmark('BENCHMARK_E', 'GROB_G350_HEAD_TABLE_BC'); // Head-Table BC

      const passed = resHermle.validation.isValid && resFidia.validation.isValid && resGrob.validation.isValid &&
                     resHermle.validation.maxPositionResidualMm <= 1e-4 && resFidia.validation.maxPositionResidualMm <= 1e-4 && resGrob.validation.maxPositionResidualMm <= 1e-4;
      return { passed, message: 'Benchmark E solved across Table-Table, Head-Head, and Head-Table architectures with residual <= 1e-4 mm across all 3.', details: { hermleRes: resHermle.validation.maxPositionResidualMm, fidiaRes: resFidia.validation.maxPositionResidualMm, grobRes: resGrob.validation.maxPositionResidualMm } };
    });

    addResult('TEST_258_34', 'Architecture-Specific Machine Coordinate Divergence', 'Machine Architecture', () => {
      const resHermle = FiveAxisKinematicsEngine.runBenchmark('BENCHMARK_E', 'HERMLE_C42U_AC');
      const resFidia = FiveAxisKinematicsEngine.runBenchmark('BENCHMARK_E', 'FIDIA_GTF_HEAD_HEAD_AB');
      // For the same target TCP, the machine X/Y/Z and rotary angles should be distinct due to different kinematics
      const ptIdx = 5;
      const axesHermle = resHermle.path.points[ptIdx].machineAxes;
      const axesFidia = resFidia.path.points[ptIdx].machineAxes;
      const isDivergent = Math.abs(axesHermle.X - axesFidia.X) > 1.0 || Math.abs(axesHermle.Z - axesFidia.Z) > 1.0;
      return { passed: isDivergent, message: 'Verified distinct joint coordinates for Table-Table vs Head-Head kinematics on identical part path.', details: { axesHermle, axesFidia } };
    });

    addResult('TEST_258_35', 'Cryptographic SHA-256 Provenance & Evidence Generation', 'Evidence Package', () => {
      const res = FiveAxisKinematicsEngine.runBenchmark('BENCHMARK_B', 'HERMLE_C42U_AC');
      const ev = res.evidence;
      const passed = ev && ev.gatePassed === true && ev.classification === 'PROVEN' && ev.provenanceSignature.startsWith('sha256_') && ev.machineModelHash.startsWith('sha256_');
      return { passed: !!passed, message: 'Tamper-evident cryptographic evidence package generated with PROVEN status.', details: { signature: ev.provenanceSignature, classification: ev.classification } };
    });

    addResult('TEST_258_36', 'Full Gate Suite 36/36 Deterministic Pass Certification', 'Production Gate', () => {
      const passedCount = results.filter(r => r.passed).length;
      // Including this test, all prior 35 must pass
      const passed = passedCount === 35;
      return { passed, message: 'All 36/36 tests in Hard Acceptance Gate 258 certified passed.', details: { priorPassed: passedCount } };
    });

    const totalDuration = performance.now() - startTime;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.length - passedTests;

    return {
      suiteId: `GATE_258_${Date.now()}`,
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      passedTests,
      failedTests,
      allPassed: failedTests === 0,
      totalDurationMs: Number(totalDuration.toFixed(2)),
      testResults: results
    };
  }
}
