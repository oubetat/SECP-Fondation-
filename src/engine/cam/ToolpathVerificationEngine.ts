/**
 * PATCH-SECP-057 — 057-H: Independent Toolpath Verification Engine
 * Separate validation pipeline that checks candidate toolpaths against Part B-Rep,
 * Stock bounds, Toolholder reach, and Machine envelope limits.
 */

import { Vector3D } from '../cadKernel';
import { 
  CandidateToolpathTrajectory, 
  VerifiedToolpathTrajectory, 
  ToolpathVerificationReport, 
  VerificationIssue, 
  StockModelBounds 
} from './ToolpathTypes';
import { CuttingToolModel } from './CuttingToolModel';

export interface MachineEnvelopeLimits {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

export class ToolpathVerificationEngine {
  public static defaultMachineLimits: MachineEnvelopeLimits = {
    xMin: -500,
    xMax: 500,
    yMin: -400,
    yMax: 400,
    zMin: -250,
    zMax: 350
  };

  /**
   * Independently verifies a candidate toolpath trajectory against geometry, holder, rapid, and envelope constraints
   */
  public static verifyToolpath(
    candidate: CandidateToolpathTrajectory,
    partFloorZ: number,
    stockBounds: StockModelBounds,
    machineLimits: MachineEnvelopeLimits = ToolpathVerificationEngine.defaultMachineLimits
  ): VerifiedToolpathTrajectory {
    const issues: VerificationIssue[] = [];
    let gougeFree = true;
    let collisionFree = true;
    let clearanceSatisfied = true;
    let axisLimitsSatisfied = true;

    const tool = candidate.tool;
    const reachCheck = CuttingToolModel.validateToolReach(tool, stockBounds.zMax - partFloorZ);

    // 1. Holder Collision Check based on Reach
    if (!reachCheck.satisfiesReach) {
      collisionFree = false;
      issues.push({
        pointIndex: 0,
        issueType: 'COLLISION_HOLDER',
        location: { x: 0, y: 0, z: partFloorZ },
        description: `Tool reach (${tool.reachMm}mm) insufficient for cut depth (${(stockBounds.zMax - partFloorZ).toFixed(1)}mm). Holder collision risk.`,
        severity: 'CRITICAL'
      });
    }

    // Iterate through all cutter location points
    candidate.points.forEach((pt, idx) => {
      const pos = pt.position;

      // 2. Machine Axis Limit Verification
      if (
        pos.x < machineLimits.xMin || pos.x > machineLimits.xMax ||
        pos.y < machineLimits.yMin || pos.y > machineLimits.yMax ||
        pos.z < machineLimits.zMin || pos.z > machineLimits.zMax
      ) {
        axisLimitsSatisfied = false;
        issues.push({
          pointIndex: idx,
          issueType: 'AXIS_LIMIT_VIOLATION',
          location: pos,
          description: `Point [${pos.x}, ${pos.y}, ${pos.z}] exceeds machine envelope.`,
          severity: 'CRITICAL'
        });
      }

      // 3. Gouge Verification (Cutter plunging below part B-Rep floor Z with tolerance)
      const gougeTolerance = 0.05; // 50 microns
      if ((pt.moveType === 'CUTTING' || pt.moveType === 'ADAPTIVE_TROCHOIDAL' || pt.moveType === 'PLUNGE') && pos.z < (partFloorZ - gougeTolerance)) {
        gougeFree = false;
        issues.push({
          pointIndex: idx,
          issueType: 'GOUGE_PART',
          location: pos,
          description: `Tool position Z (${pos.z.toFixed(3)}mm) gouges below B-Rep floor level (${partFloorZ}mm).`,
          severity: 'CRITICAL'
        });
      }

      // 4. Rapid Collision Verification (G0 traverse below stock Z without feed)
      if ((pt.moveType === 'RAPID_APPROACH' || pt.moveType === 'CLEARANCE_TRANSITION') && pos.z < stockBounds.zMax - 1.0) {
        collisionFree = false;
        issues.push({
          pointIndex: idx,
          issueType: 'COLLISION_RAPID',
          location: pos,
          description: `Rapid traverse move at Z (${pos.z.toFixed(2)}mm) below raw stock top (${stockBounds.zMax}mm). Risk of rapid collision.`,
          severity: 'CRITICAL'
        });
      }

      // 5. Clearance Plane Verification
      if (pt.moveType === 'CLEARANCE_TRANSITION' && pos.z < stockBounds.zMax) {
        clearanceSatisfied = false;
        issues.push({
          pointIndex: idx,
          issueType: 'INSUFFICIENT_CLEARANCE',
          location: pos,
          description: `Clearance transition Z (${pos.z.toFixed(2)}mm) below raw stock top (${stockBounds.zMax}mm).`,
          severity: 'WARNING'
        });
      }
    });

    const isValid = gougeFree && collisionFree && clearanceSatisfied && axisLimitsSatisfied;

    const report: ToolpathVerificationReport = {
      operationId: candidate.operationId,
      isValid,
      gougeFree,
      collisionFree,
      clearanceSatisfied,
      axisLimitsSatisfied,
      issues,
      verifiedPointsCount: candidate.points.length,
      verifiedAt: new Date().toISOString()
    };

    return {
      ...candidate,
      verificationReport: report,
      collisionFree,
      gougeFree
    };
  }
}
