import { 
  MachineKinematicConfig, 
  FiveAxisToolpath, 
  KinematicVerificationResult,
  AxisLimitViolation,
  SingularityEvent,
  FiveAxisVerificationMetrics
} from './KinematicTypes';
import { FiveAxisKinematicsEngine } from './FiveAxisKinematicsEngine';
import { CollisionEngine, CollisionConfig } from './CollisionEngine';
import { generateDeterministicHash } from '../../lib/hash';

export class FiveAxisVerificationEngine {
  private kinEngine: FiveAxisKinematicsEngine;
  private colEngine: CollisionEngine;

  constructor(kinConfig: MachineKinematicConfig, colConfig: CollisionConfig) {
    this.kinEngine = new FiveAxisKinematicsEngine(kinConfig);
    this.colEngine = new CollisionEngine(colConfig);
  }

  public async verifyToolpathAsync(
    toolpath: FiveAxisToolpath, 
    dependencies: { secp096Hash: string, secp097Hash: string, secp098Hash: string }
  ): Promise<KinematicVerificationResult> {
    
    const limitViolations: AxisLimitViolation[] = [];
    const singularityEvents: SingularityEvent[] = [];
    
    let pathLength = 0;
    let minCartesianSegmentLength = Infinity;
    let minMachineAxisStep = Infinity;
    let maxPositionResidual = 0;
    let maxOrientationResidual = 0;
    let maxAxisLimitExcursion = 0;
    let zeroLengthSegmentCount = 0;
    let cartesianContinuityGapCount = 0;
    let orientationDiscontinuityCount = 0;
    let machineAxisDiscontinuityCount = 0;

    let validPoseCount = 0;
    let rejectedPoseCount = 0;

    const CARTESIAN_GAP_TOL = 10.0;
    const ORIENT_GAP_TOL = 0.1; // radians
    const AXIS_GAP_TOL = 5.0; // degrees

    for (let i = 0; i < toolpath.points.length; i++) {
      const pt = toolpath.points[i];
      let rejected = false;

      // 1. Validate Orientation
      try {
        this.kinEngine.validateOrientation(pt.toolOrientation);
      } catch (e) {
        rejectedPoseCount++;
        continue;
      }

      // 2. Singularity
      const singRes = this.kinEngine.detectSingularity(pt.toolOrientation);
      if (singRes.status === 'SINGULAR' || singRes.status === 'WARNING') {
        singularityEvents.push({
          status: singRes.status,
          metric: singRes.metric,
          tolerance: 1e-5,
          poseIndex: i
        });
        if (singRes.status === 'SINGULAR') {
          rejected = true;
        }
      }

      // 3. Inverse Kinematics
      let solutions;
      try {
        solutions = this.kinEngine.inverseKinematics(pt.position, pt.toolOrientation);
      } catch (e) {
        rejected = true;
      }

      if (!solutions || solutions.length === 0) {
        rejected = true;
      } else {
        // Pick first valid solution
        const sol = solutions[0];
        const limits = this.kinEngine.checkAxisLimits(sol);
        
        if (limits.length > 0) {
          limits.forEach(l => limitViolations.push({
            axis: l,
            requested: sol[l],
            limit: 0, // Fallback limit
            excess: 0,
            poseIndex: i
          }));
          rejected = true;
        }

        // 4. Forward Kinematics (Residuals)
        const fk = this.kinEngine.forwardKinematics(sol);
        const dx = fk.position.x - pt.position.x;
        const dy = fk.position.y - pt.position.y;
        const dz = fk.position.z - pt.position.z;
        const posRes = Math.sqrt(dx*dx + dy*dy + dz*dz);
        maxPositionResidual = Math.max(maxPositionResidual, posRes);

        const dI = fk.orientation.i - pt.toolOrientation.i;
        const dJ = fk.orientation.j - pt.toolOrientation.j;
        const dK = fk.orientation.k - pt.toolOrientation.k;
        const oriRes = Math.sqrt(dI*dI + dJ*dJ + dK*dK);
        maxOrientationResidual = Math.max(maxOrientationResidual, oriRes);

        if (posRes > 1e-3 || oriRes > 1e-3) {
          rejected = true;
        }

        pt.machinePose = {
          position: fk.position,
          orientation: fk.orientation,
          machineAxes: sol
        };
      }

      if (rejected) {
        rejectedPoseCount++;
      } else {
        validPoseCount++;
      }

      // 5. Continuity Metrics
      if (i > 0) {
        const prev = toolpath.points[i-1];
        const dX = pt.position.x - prev.position.x;
        const dY = pt.position.y - prev.position.y;
        const dZ = pt.position.z - prev.position.z;
        const dist = Math.sqrt(dX*dX + dY*dY + dZ*dZ);
        
        pathLength += dist;

        if (dist > 0 && dist < minCartesianSegmentLength) {
          minCartesianSegmentLength = dist;
        }

        if (dist < 1e-7) {
          zeroLengthSegmentCount++;
        }

        if (dist > CARTESIAN_GAP_TOL && pt.moveType === 'CUTTING') {
          cartesianContinuityGapCount++;
        }

        const dOri = Math.sqrt(
          (pt.toolOrientation.i - prev.toolOrientation.i)**2 +
          (pt.toolOrientation.j - prev.toolOrientation.j)**2 +
          (pt.toolOrientation.k - prev.toolOrientation.k)**2
        );
        if (dOri > ORIENT_GAP_TOL) {
          orientationDiscontinuityCount++;
        }

        if (pt.machinePose && prev.machinePose) {
           const dA = Math.abs((pt.machinePose.machineAxes['A'] || 0) - (prev.machinePose.machineAxes['A'] || 0));
           const dC = Math.abs((pt.machinePose.machineAxes['C'] || 0) - (prev.machinePose.machineAxes['C'] || 0));
           const axisStep = Math.max(dA, dC);

           if (axisStep > 0 && axisStep < minMachineAxisStep) {
             minMachineAxisStep = axisStep;
           }

           if (axisStep > AXIS_GAP_TOL) {
             machineAxisDiscontinuityCount++;
           }
        }
      }
    }

    const { collisions, gougingEvents, clearanceResult } = this.colEngine.verifyPath(toolpath.points);
    const actualCollisions = collisions.filter(c => c.type !== 'NOT_AVAILABLE');

    const metrics: FiveAxisVerificationMetrics = {
      pathLength: Number(pathLength.toFixed(3)),
      poseCount: toolpath.points.length,
      validPoseCount,
      rejectedPoseCount,
      minCartesianSegmentLength: minCartesianSegmentLength === Infinity ? 0 : Number(minCartesianSegmentLength.toFixed(6)),
      minMachineAxisStep: minMachineAxisStep === Infinity ? 0 : Number(minMachineAxisStep.toFixed(6)),
      maxPositionResidual: Number(maxPositionResidual.toFixed(6)),
      maxOrientationResidual: Number(maxOrientationResidual.toFixed(6)),
      maxAxisLimitExcursion,
      minClearance: Number(clearanceResult.minClearance.toFixed(6)),
      collisionCount: actualCollisions.length,
      gougingCount: gougingEvents.length,
      singularityCount: singularityEvents.length,
      zeroLengthSegmentCount,
      cartesianContinuityGapCount,
      orientationDiscontinuityCount,
      machineAxisDiscontinuityCount
    };

    const isValid = rejectedPoseCount === 0 && actualCollisions.length === 0 && gougingEvents.length === 0;

    const provenanceData = {
      dependencies,
      toolpath: toolpath.operationId,
      pointCount: toolpath.points.length,
      metrics
    };

    const provenanceHash = await generateDeterministicHash(provenanceData);

    return {
      isValid,
      metrics,
      limitViolations,
      singularityEvents,
      collisionEvents: collisions,
      clearanceResult,
      gougingEvents,
      provenanceHash
    };
  }
}
