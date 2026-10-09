/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-258 — Multi-Branch Inverse Kinematics Solver (IK)
 * Computes Exact Machine Joint Angles (X, Y, Z, A, B, C) from Part-Space TCP & Tool Vector,
 * validates Closed-Loop Roundtrip FK Residuals (<= 1e-4 mm), handles Rotary Unwrapping,
 * and detects Kinematic Poles.
 */

import { Vector3D } from '../../cadKernel';
import { 
  FiveAxisMachineDefinition, 
  IKSolutionBranch, 
  IKSolverResult, 
  KinematicDiagnostic, 
  MachineAxesState, 
  ToolOrientationVector 
} from './FiveAxisTypes';
import { FiveAxisMathUtils } from './FiveAxisMathUtils';
import { ForwardKinematicsSolver } from './ForwardKinematicsSolver';
import { SingularityAnalyzer } from './SingularityAnalyzer';
import { IKSolutionRanker } from './IKSolutionRanker';

export class InverseKinematicsSolver {
  /**
   * Solves Inverse Kinematics for a given TCP position and Tool Vector
   */
  public static solveIK(
    machine: FiveAxisMachineDefinition,
    targetTCP: Vector3D,
    toolVector: Vector3D | ToolOrientationVector,
    prevAxes?: MachineAxesState,
    toolLengthMm: number = 0,
    options?: { autoAvoidSingularity?: boolean; maxAllowedResidualMm?: number }
  ): IKSolverResult {
    const normT = FiveAxisMathUtils.normalize(toolVector);
    const targetOrientation = FiveAxisMathUtils.toOrientationVector(normT);
    const diagnostics: KinematicDiagnostic[] = [];

    // 1. Singularity Pre-Analysis
    const singAnalysis = SingularityAnalyzer.analyze(
      machine,
      normT,
      prevAxes ? undefined : undefined,
      options?.autoAvoidSingularity
    );
    diagnostics.push(...singAnalysis.diagnostics);

    const activeToolVec = singAnalysis.avoidanceApplied && singAnalysis.perturbedOrientation
      ? singAnalysis.perturbedOrientation
      : normT;

    const I = activeToolVec.x;
    const J = activeToolVec.y;
    const K = Math.max(-1.0, Math.min(1.0, activeToolVec.z));

    const rawCandidates: IKSolutionBranch[] = [];

    // 2. Multi-Branch Analytical Solution Generation
    if (machine.architecture === 'TABLE_TABLE') {
      if (machine.topology === 'TABLE_TABLE_AC') {
        // Table A (around X), Table C (around Z on A)
        // Vector on table: R_x(-A) * R_z(-C) * [0,0,1]^T => I = sin(A)*sin(C), J = -sin(A)*cos(C), K = cos(A)
        const A_rad1 = Math.acos(K);
        const A_rad2 = -A_rad1;

        const sinA1 = Math.sin(A_rad1);
        const sinA2 = Math.sin(A_rad2);

        let C_rad1 = 0;
        let C_rad2 = 0;

        if (Math.abs(sinA1) > 1e-5) {
          C_rad1 = Math.atan2(I / sinA1, -J / sinA1);
          C_rad2 = Math.atan2(I / sinA2, -J / sinA2);
        } else {
          // At pole / singularity (A=0), preserve previous C angle
          C_rad1 = prevAxes ? prevAxes.C * FiveAxisMathUtils.DEG2RAD : 0;
          C_rad2 = C_rad1;
        }

        // Branch 1: Positive A
        const b1Angles = { A: A_rad1 * FiveAxisMathUtils.RAD2DEG, B: 0, C: C_rad1 * FiveAxisMathUtils.RAD2DEG };
        // Branch 2: Negative A
        const b2Angles = { A: A_rad2 * FiveAxisMathUtils.RAD2DEG, B: 0, C: C_rad2 * FiveAxisMathUtils.RAD2DEG };

        rawCandidates.push(this.createTableTableACBranch('BRANCH_A_POS', machine, targetTCP, b1Angles, prevAxes, singAnalysis));
        rawCandidates.push(this.createTableTableACBranch('BRANCH_A_NEG', machine, targetTCP, b2Angles, prevAxes, singAnalysis));
      } else {
        // TABLE_TABLE_BC: Table B (around Y), Table C (around Z on B)
        // I = sin(B)*cos(C), J = sin(B)*sin(C), K = cos(B)
        const B_rad1 = Math.acos(K);
        const B_rad2 = -B_rad1;
        const sinB1 = Math.sin(B_rad1);
        const sinB2 = Math.sin(B_rad2);

        let C_rad1 = 0;
        let C_rad2 = 0;

        if (Math.abs(sinB1) > 1e-5) {
          C_rad1 = Math.atan2(J / sinB1, I / sinB1);
          C_rad2 = Math.atan2(J / sinB2, I / sinB2);
        } else {
          C_rad1 = prevAxes ? prevAxes.C * FiveAxisMathUtils.DEG2RAD : 0;
          C_rad2 = C_rad1;
        }

        const b1Angles = { A: 0, B: B_rad1 * FiveAxisMathUtils.RAD2DEG, C: C_rad1 * FiveAxisMathUtils.RAD2DEG };
        const b2Angles = { A: 0, B: B_rad2 * FiveAxisMathUtils.RAD2DEG, C: C_rad2 * FiveAxisMathUtils.RAD2DEG };

        rawCandidates.push(this.createTableTableBCBranch('BRANCH_B_POS', machine, targetTCP, b1Angles, prevAxes, singAnalysis));
        rawCandidates.push(this.createTableTableBCBranch('BRANCH_B_NEG', machine, targetTCP, b2Angles, prevAxes, singAnalysis));
      }
    } else if (machine.architecture === 'HEAD_HEAD') {
      const L_eff = machine.gaugePivotOffsetMm.z + toolLengthMm;

      if (machine.topology === 'HEAD_HEAD_AB') {
        // Head A (around X), Head B (around Y)
        const B_rad1 = Math.atan2(I, Math.max(1e-6, K));
        const A_rad1 = Math.atan2(-J, Math.sqrt(I * I + K * K));

        const B_rad2 = B_rad1 > 0 ? B_rad1 - Math.PI : B_rad1 + Math.PI;
        const A_rad2 = -A_rad1;

        rawCandidates.push(this.createHeadHeadBranch('BRANCH_HEAD_1', machine, targetTCP, { A: A_rad1 * FiveAxisMathUtils.RAD2DEG, B: B_rad1 * FiveAxisMathUtils.RAD2DEG, C: 0 }, L_eff, prevAxes, singAnalysis));
        rawCandidates.push(this.createHeadHeadBranch('BRANCH_HEAD_2', machine, targetTCP, { A: A_rad2 * FiveAxisMathUtils.RAD2DEG, B: B_rad2 * FiveAxisMathUtils.RAD2DEG, C: 0 }, L_eff, prevAxes, singAnalysis));
      } else {
        // HEAD_HEAD_BC: Head B (around Y), C (around Z)
        const B_rad1 = Math.acos(K);
        const B_rad2 = -B_rad1;
        let C_rad1 = 0;
        let C_rad2 = 0;

        if (Math.abs(Math.sin(B_rad1)) > 1e-5) {
          C_rad1 = Math.atan2(I / Math.sin(B_rad1), -J / Math.sin(B_rad1));
          C_rad2 = Math.atan2(I / Math.sin(B_rad2), -J / Math.sin(B_rad2));
        } else {
          C_rad1 = prevAxes ? prevAxes.C * FiveAxisMathUtils.DEG2RAD : 0;
          C_rad2 = C_rad1;
        }

        rawCandidates.push(this.createHeadHeadBranch('BRANCH_HEAD_BC_1', machine, targetTCP, { A: 0, B: B_rad1 * FiveAxisMathUtils.RAD2DEG, C: C_rad1 * FiveAxisMathUtils.RAD2DEG }, L_eff, prevAxes, singAnalysis));
        rawCandidates.push(this.createHeadHeadBranch('BRANCH_HEAD_BC_2', machine, targetTCP, { A: 0, B: B_rad2 * FiveAxisMathUtils.RAD2DEG, C: C_rad2 * FiveAxisMathUtils.RAD2DEG }, L_eff, prevAxes, singAnalysis));
      }
    } else {
      // HEAD_TABLE (e.g. Head B + Table C)
      const L_head = machine.gaugePivotOffsetMm.z + toolLengthMm;

      if (machine.topology === 'HEAD_TABLE_BC') {
        const B_rad1 = Math.acos(K);
        const B_rad2 = -B_rad1;
        let C_rad1 = 0;
        let C_rad2 = 0;

        if (Math.abs(Math.sin(B_rad1)) > 1e-5) {
          C_rad1 = Math.atan2(J / Math.sin(B_rad1), I / Math.sin(B_rad1));
          C_rad2 = Math.atan2(J / Math.sin(B_rad2), I / Math.sin(B_rad2));
        } else {
          C_rad1 = prevAxes ? prevAxes.C * FiveAxisMathUtils.DEG2RAD : 0;
          C_rad2 = C_rad1;
        }

        rawCandidates.push(this.createHeadTableBCBranch('BRANCH_HT_1', machine, targetTCP, { A: 0, B: B_rad1 * FiveAxisMathUtils.RAD2DEG, C: C_rad1 * FiveAxisMathUtils.RAD2DEG }, L_head, prevAxes, singAnalysis));
        rawCandidates.push(this.createHeadTableBCBranch('BRANCH_HT_2', machine, targetTCP, { A: 0, B: B_rad2 * FiveAxisMathUtils.RAD2DEG, C: C_rad2 * FiveAxisMathUtils.RAD2DEG }, L_head, prevAxes, singAnalysis));
      } else {
        // Generic Head-Table AC
        const A_rad1 = Math.acos(K);
        const A_rad2 = -A_rad1;
        let C_rad1 = 0;
        let C_rad2 = 0;

        if (Math.abs(Math.sin(A_rad1)) > 1e-5) {
          C_rad1 = Math.atan2(-I / Math.sin(A_rad1), J / Math.sin(A_rad1));
          C_rad2 = Math.atan2(-I / Math.sin(A_rad2), J / Math.sin(A_rad2));
        } else {
          C_rad1 = prevAxes ? prevAxes.C * FiveAxisMathUtils.DEG2RAD : 0;
          C_rad2 = C_rad1;
        }

        rawCandidates.push(this.createHeadTableACBranch('BRANCH_HT_AC_1', machine, targetTCP, { A: A_rad1 * FiveAxisMathUtils.RAD2DEG, B: 0, C: C_rad1 * FiveAxisMathUtils.RAD2DEG }, L_head, prevAxes, singAnalysis));
        rawCandidates.push(this.createHeadTableACBranch('BRANCH_HT_AC_2', machine, targetTCP, { A: A_rad2 * FiveAxisMathUtils.RAD2DEG, B: 0, C: C_rad2 * FiveAxisMathUtils.RAD2DEG }, L_head, prevAxes, singAnalysis));
      }
    }

    // 3. Rank Candidate Solutions
    const rankedCandidates = IKSolutionRanker.rankSolutions(machine, rawCandidates, prevAxes);
    const selectedSolution = rankedCandidates.find(c => c.isWithinLimits) || rankedCandidates[0] || null;

    if (!selectedSolution) {
      diagnostics.push({
        code: 'NO_IK_SOLUTION',
        severity: 'ERROR',
        message: 'No feasible inverse kinematics solution found for given TCP and tool orientation.'
      });
    } else if (!selectedSolution.isWithinLimits) {
      diagnostics.push({
        code: 'MACHINE_ENVELOPE_VIOLATION',
        severity: 'ERROR',
        message: `Selected IK solution violates machine limits: ${selectedSolution.limitViolations.join(', ')}`,
        axesState: selectedSolution.axes
      });
    }

    // 4. Closed-Loop Roundtrip FK Verification
    let reconstructedTCP: Vector3D = { x: 0, y: 0, z: 0 };
    let reconstructedOrientation: ToolOrientationVector = { x: 0, y: 0, z: 1, normalizedMagnitude: 1.0 };
    let positionResidualMm = 999.0;
    let orientationResidualRad = 999.0;
    let isValid = false;

    if (selectedSolution) {
      const fk = ForwardKinematicsSolver.solveFK(machine, selectedSolution.axes, toolLengthMm);
      reconstructedTCP = fk.tcpWCS;
      reconstructedOrientation = fk.toolOrientation;

      positionResidualMm = FiveAxisMathUtils.distance(targetTCP, reconstructedTCP);
      const dotOrient = Math.max(-1.0, Math.min(1.0, FiveAxisMathUtils.dot(normT, reconstructedOrientation)));
      orientationResidualRad = Math.acos(dotOrient);

      const maxAllowedRes = options?.maxAllowedResidualMm ?? 1e-4;

      if (positionResidualMm > maxAllowedRes) {
        diagnostics.push({
          code: 'KINEMATIC_RESIDUAL_EXCEEDED',
          severity: 'ERROR',
          message: `Closed-loop FK position residual (${positionResidualMm.toExponential(3)} mm) exceeds tolerance (${maxAllowedRes} mm).`
        });
      }

      if (orientationResidualRad > 1e-4) {
        diagnostics.push({
          code: 'ORIENTATION_RESIDUAL_EXCEEDED',
          severity: 'ERROR',
          message: `Closed-loop FK orientation residual (${orientationResidualRad.toExponential(3)} rad) exceeds tolerance (1e-4 rad).`
        });
      }

      isValid = selectedSolution.isWithinLimits && positionResidualMm <= maxAllowedRes && orientationResidualRad <= 1e-4;
    }

    return {
      targetTCP,
      targetOrientation,
      candidateSolutions: rankedCandidates,
      selectedSolution,
      reconstructedTCP,
      reconstructedOrientation,
      positionResidualMm: Number(positionResidualMm.toFixed(7)),
      orientationResidualRad: Number(orientationResidualRad.toFixed(7)),
      isValid,
      diagnostics
    };
  }

  // --- Branch Creation Helpers ---

  private static createTableTableACBranch(
    id: string,
    machine: FiveAxisMachineDefinition,
    targetTCP: Vector3D,
    angles: { A: number; B: number; C: number },
    prevAxes: MachineAxesState | undefined,
    singAnalysis: any
  ): IKSolutionBranch {
    let { A, C } = angles;
    let unwound = false;

    if (prevAxes) {
      const unwrapRes = FiveAxisMathUtils.unwrapAngle(C, prevAxes.C);
      C = unwrapRes.unwoundDeg;
      unwound = unwrapRes.unwrapped;
    }

    // Solve Linear Coordinates: Pos_MCS = R_x(A) * R_z(C) * Pos_WCS + TableCenter
    const aRad = A * FiveAxisMathUtils.DEG2RAD;
    const cRad = C * FiveAxisMathUtils.DEG2RAD;
    const cosC = Math.cos(cRad);
    const sinC = Math.sin(cRad);
    const cosA = Math.cos(aRad);
    const sinA = Math.sin(aRad);

    const x1 = targetTCP.x * cosC - targetTCP.y * sinC;
    const y1 = targetTCP.x * sinC + targetTCP.y * cosC;
    const z1 = targetTCP.z;

    const x2 = x1;
    const y2 = y1 * cosA - z1 * sinA;
    const z2 = y1 * sinA + z1 * cosA;

    const X = Number((x2 + machine.tableCenterMm.x).toFixed(5));
    const Y = Number((y2 + machine.tableCenterMm.y).toFixed(5));
    const Z = Number((z2 + machine.tableCenterMm.z).toFixed(5));

    const axes: MachineAxesState = { X, Y, Z, A: Number(A.toFixed(5)), B: 0, C: Number(C.toFixed(5)) };

    return {
      solutionId: id,
      axes,
      score: 0,
      isWithinLimits: true,
      limitViolations: [],
      isSingular: singAnalysis.isSingular,
      singularityDistanceDeg: singAnalysis.singularityDistanceDeg,
      velocityAmplification: singAnalysis.velocityAmplificationFactor,
      rotaryUnwound: unwound,
      rankingDetails: { angularDistanceDeg: 0, linearDisplacementMm: 0, singularityPenalty: 0, limitPenalty: 0 }
    };
  }

  private static createTableTableBCBranch(
    id: string,
    machine: FiveAxisMachineDefinition,
    targetTCP: Vector3D,
    angles: { A: number; B: number; C: number },
    prevAxes: MachineAxesState | undefined,
    singAnalysis: any
  ): IKSolutionBranch {
    let { B, C } = angles;
    let unwound = false;

    if (prevAxes) {
      const unwrapRes = FiveAxisMathUtils.unwrapAngle(C, prevAxes.C);
      C = unwrapRes.unwoundDeg;
      unwound = unwrapRes.unwrapped;
    }

    const bRad = B * FiveAxisMathUtils.DEG2RAD;
    const cRad = C * FiveAxisMathUtils.DEG2RAD;
    const cosC = Math.cos(cRad);
    const sinC = Math.sin(cRad);
    const cosB = Math.cos(bRad);
    const sinB = Math.sin(bRad);

    const x1 = targetTCP.x * cosC - targetTCP.y * sinC;
    const y1 = targetTCP.x * sinC + targetTCP.y * cosC;
    const z1 = targetTCP.z;

    const x2 = x1 * cosB + z1 * sinB;
    const y2 = y1;
    const z2 = -x1 * sinB + z1 * cosB;

    const X = Number((x2 + machine.tableCenterMm.x).toFixed(5));
    const Y = Number((y2 + machine.tableCenterMm.y).toFixed(5));
    const Z = Number((z2 + machine.tableCenterMm.z).toFixed(5));

    const axes: MachineAxesState = { X, Y, Z, A: 0, B: Number(B.toFixed(5)), C: Number(C.toFixed(5)) };

    return {
      solutionId: id,
      axes,
      score: 0,
      isWithinLimits: true,
      limitViolations: [],
      isSingular: singAnalysis.isSingular,
      singularityDistanceDeg: singAnalysis.singularityDistanceDeg,
      velocityAmplification: singAnalysis.velocityAmplificationFactor,
      rotaryUnwound: unwound,
      rankingDetails: { angularDistanceDeg: 0, linearDisplacementMm: 0, singularityPenalty: 0, limitPenalty: 0 }
    };
  }

  private static createHeadHeadBranch(
    id: string,
    machine: FiveAxisMachineDefinition,
    targetTCP: Vector3D,
    angles: { A: number; B: number; C: number },
    L_eff: number,
    prevAxes: MachineAxesState | undefined,
    singAnalysis: any
  ): IKSolutionBranch {
    let { A, B, C } = angles;
    let unwound = false;

    if (prevAxes) {
      if (machine.topology === 'HEAD_HEAD_BC') {
        const unwrapRes = FiveAxisMathUtils.unwrapAngle(C, prevAxes.C);
        C = unwrapRes.unwoundDeg;
        unwound = unwrapRes.unwrapped;
      }
    }

    const aRad = A * FiveAxisMathUtils.DEG2RAD;
    const bRad = B * FiveAxisMathUtils.DEG2RAD;
    const cRad = C * FiveAxisMathUtils.DEG2RAD;

    let I = 0;
    let J = 0;
    let K = 1;

    if (machine.topology === 'HEAD_HEAD_AB') {
      I = Math.sin(bRad);
      J = -Math.sin(aRad) * Math.cos(bRad);
      K = Math.cos(aRad) * Math.cos(bRad);
    } else {
      I = Math.sin(bRad) * Math.sin(cRad);
      J = -Math.sin(bRad) * Math.cos(cRad);
      K = Math.cos(bRad);
    }

    const X = Number((targetTCP.x - L_eff * I).toFixed(5));
    const Y = Number((targetTCP.y - L_eff * J).toFixed(5));
    const Z = Number((targetTCP.z + L_eff * (1.0 - K)).toFixed(5));

    const axes: MachineAxesState = { X, Y, Z, A: Number(A.toFixed(5)), B: Number(B.toFixed(5)), C: Number(C.toFixed(5)) };

    return {
      solutionId: id,
      axes,
      score: 0,
      isWithinLimits: true,
      limitViolations: [],
      isSingular: singAnalysis.isSingular,
      singularityDistanceDeg: singAnalysis.singularityDistanceDeg,
      velocityAmplification: singAnalysis.velocityAmplificationFactor,
      rotaryUnwound: unwound,
      rankingDetails: { angularDistanceDeg: 0, linearDisplacementMm: 0, singularityPenalty: 0, limitPenalty: 0 }
    };
  }

  private static createHeadTableBCBranch(
    id: string,
    machine: FiveAxisMachineDefinition,
    targetTCP: Vector3D,
    angles: { A: number; B: number; C: number },
    L_head: number,
    prevAxes: MachineAxesState | undefined,
    singAnalysis: any
  ): IKSolutionBranch {
    let { B, C } = angles;
    let unwound = false;

    if (prevAxes) {
      const unwrapRes = FiveAxisMathUtils.unwrapAngle(C, prevAxes.C);
      C = unwrapRes.unwoundDeg;
      unwound = unwrapRes.unwrapped;
    }

    const bRad = B * FiveAxisMathUtils.DEG2RAD;
    const cRad = C * FiveAxisMathUtils.DEG2RAD;
    const cosC = Math.cos(cRad);
    const sinC = Math.sin(cRad);

    // Rotate target TCP by +C around table
    const xt = targetTCP.x * cosC - targetTCP.y * sinC;
    const yt = targetTCP.x * sinC + targetTCP.y * cosC;
    const zt = targetTCP.z;

    const X = Number((xt + machine.tableCenterMm.x - L_head * Math.sin(bRad)).toFixed(5));
    const Y = Number((yt + machine.tableCenterMm.y).toFixed(5));
    const Z = Number((zt + machine.tableCenterMm.z + L_head * (1 - Math.cos(bRad))).toFixed(5));

    const axes: MachineAxesState = { X, Y, Z, A: 0, B: Number(B.toFixed(5)), C: Number(C.toFixed(5)) };

    return {
      solutionId: id,
      axes,
      score: 0,
      isWithinLimits: true,
      limitViolations: [],
      isSingular: singAnalysis.isSingular,
      singularityDistanceDeg: singAnalysis.singularityDistanceDeg,
      velocityAmplification: singAnalysis.velocityAmplificationFactor,
      rotaryUnwound: unwound,
      rankingDetails: { angularDistanceDeg: 0, linearDisplacementMm: 0, singularityPenalty: 0, limitPenalty: 0 }
    };
  }

  private static createHeadTableACBranch(
    id: string,
    machine: FiveAxisMachineDefinition,
    targetTCP: Vector3D,
    angles: { A: number; B: number; C: number },
    L_head: number,
    prevAxes: MachineAxesState | undefined,
    singAnalysis: any
  ): IKSolutionBranch {
    let { A, C } = angles;
    let unwound = false;

    if (prevAxes) {
      const unwrapRes = FiveAxisMathUtils.unwrapAngle(C, prevAxes.C);
      C = unwrapRes.unwoundDeg;
      unwound = unwrapRes.unwrapped;
    }

    const aRad = A * FiveAxisMathUtils.DEG2RAD;
    const cRad = C * FiveAxisMathUtils.DEG2RAD;
    const cosC = Math.cos(cRad);
    const sinC = Math.sin(cRad);

    const xt = targetTCP.x * cosC - targetTCP.y * sinC;
    const yt = targetTCP.x * sinC + targetTCP.y * cosC;
    const zt = targetTCP.z;

    const X = Number((xt + machine.tableCenterMm.x).toFixed(5));
    const Y = Number((yt + machine.tableCenterMm.y + L_head * Math.sin(aRad)).toFixed(5));
    const Z = Number((zt + machine.tableCenterMm.z + L_head * (1 - Math.cos(aRad))).toFixed(5));

    const axes: MachineAxesState = { X, Y, Z, A: Number(A.toFixed(5)), B: 0, C: Number(C.toFixed(5)) };

    return {
      solutionId: id,
      axes,
      score: 0,
      isWithinLimits: true,
      limitViolations: [],
      isSingular: singAnalysis.isSingular,
      singularityDistanceDeg: singAnalysis.singularityDistanceDeg,
      velocityAmplification: singAnalysis.velocityAmplificationFactor,
      rotaryUnwound: unwound,
      rankingDetails: { angularDistanceDeg: 0, linearDisplacementMm: 0, singularityPenalty: 0, limitPenalty: 0 }
    };
  }
}
