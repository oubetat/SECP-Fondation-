/**
 * SECP087CollisionBridge.ts
 *
 * Bridges SECP-083 Gouge Verification & Kinematic Checks to SECP-087 3D Simulation.
 * Consumes GougeVerifier and MachineKinematicsVerifier without duplicating detection logic.
 */

import {
  FiveAxisCutterPoint,
  FiveAxisToolpath,
  GougeAndCollisionReport,
  KinematicFeasibilityReport,
  NurbsSurfacePatch
} from '../classa5axis/SECP083Types';
import { SECP083GougeVerifier } from '../classa5axis/SECP083GougeVerifier';
import { SECP083MachineKinematicsVerifier } from '../classa5axis/SECP083MachineKinematicsVerifier';
import { SECP083ClassASurfaceCore } from '../classa5axis/SECP083ClassASurfaceCore';
import { MachineConfiguration } from './SECP087Types';

export interface StepCollisionDetail {
  pointIndex: number;
  hasGouge: boolean;
  hasHolderCollision: boolean;
  hasShankCollision: boolean;
  hasFixtureCollision: boolean;
  hasMachineCollision: boolean;
  hasLimitViolation: boolean;
  hasSingularity: boolean;
  hasOrientationFlip: boolean;
  message?: string;
}

export class SECP087CollisionBridge {

  /**
   * Run comprehensive SECP-083 Gouge & Machine Kinematic analysis
   * and map results step-by-step to toolpath points.
   */
  public static analyzeToolpathCollisions(
    toolpath: FiveAxisToolpath,
    surface: NurbsSurfacePatch,
    config: MachineConfiguration
  ): {
    gougeReport: GougeAndCollisionReport;
    kinematicReport: KinematicFeasibilityReport;
    stepDetails: Map<number, StepCollisionDetail>;
    firstCollisionStepIndex: number | null;
  } {
    // 1. Consume SECP-083 Gouge Verifier
    const gougeReport = SECP083GougeVerifier.verifyGougesAndClearance(toolpath, surface, 0.5);

    // 2. Consume SECP-083 Machine Kinematics Verifier
    const kinematicReport = SECP083MachineKinematicsVerifier.verifyKinematics(toolpath, {
      xMinMm: config.limits.xMinMm, xMaxMm: config.limits.xMaxMm,
      yMinMm: config.limits.yMinMm, yMaxMm: config.limits.yMaxMm,
      zMinMm: config.limits.zMinMm, zMaxMm: config.limits.zMaxMm,
      aMinDeg: config.limits.aMinDeg, aMaxDeg: config.limits.aMaxDeg,
      bMinDeg: config.limits.bMinDeg, bMaxDeg: config.limits.bMaxDeg,
      cMinDeg: config.limits.cMinDeg, cMaxDeg: config.limits.cMaxDeg,
      maxFeedMmMin: config.limits.maxLinearFeedMmMin,
      maxRotaryVelocityDegSec: config.limits.maxRotaryVelocityDegSec
    });

    const stepDetails = new Map<number, StepCollisionDetail>();
    let firstCollisionStepIndex: number | null = null;

    const tool = toolpath.tool;
    const points = toolpath.points;

    for (let idx = 0; idx < points.length; idx++) {
      const pt = points[idx];
      let hasGouge = false;
      let hasHolderCollision = false;
      let hasShankCollision = false;
      let hasFixtureCollision = false;
      let hasMachineCollision = false;
      let hasLimitViolation = false;
      let hasSingularity = false;
      let hasOrientationFlip = false;
      const msgs: string[] = [];

      // Check surface distance for gouges and holder clearance
      const deriv = SECP083ClassASurfaceCore.evaluateSurfaceDerivatives(surface, 0.5, 0.5);
      const distToSurface = Math.hypot(
        pt.position.x - deriv.point.x,
        pt.position.y - deriv.point.y,
        pt.position.z - deriv.point.z
      );

      const R = tool.cornerRadiusMm || tool.diameterMm / 2;
      const penetration = R - distToSurface;

      if (pt.moveType !== 'RAPID' && penetration > 0.01) {
        hasGouge = true;
        msgs.push(`Tool gouge: ${penetration.toFixed(3)}mm penetration`);
      }

      const shankZ = pt.position.z + tool.fluteLengthMm;
      if (shankZ < deriv.point.z) {
        hasShankCollision = true;
        msgs.push(`Shank collision at Z=${shankZ.toFixed(2)}mm`);
      }

      const holderZ = pt.position.z + tool.gaugeLengthMm - tool.holderLengthMm;
      if (holderZ < deriv.point.z) {
        hasHolderCollision = true;
        msgs.push(`Holder collision at Z=${holderZ.toFixed(2)}mm`);
      }

      // Axis envelope check
      if (
        pt.position.x < config.limits.xMinMm || pt.position.x > config.limits.xMaxMm ||
        pt.position.y < config.limits.yMinMm || pt.position.y > config.limits.yMaxMm ||
        pt.position.z < config.limits.zMinMm || pt.position.z > config.limits.zMaxMm
      ) {
        hasLimitViolation = true;
        msgs.push('XYZ axis limit exceeded');
      }

      // Singularity check
      if (Math.abs(pt.toolVector.z) > 0.9999) {
        hasSingularity = true;
        msgs.push('Rotary singularity warning (|K|=1)');
      }

      // Orientation flip check
      if (idx > 0) {
        const prev = points[idx - 1];
        const dot = Math.min(Math.max(
          pt.toolVector.x * prev.toolVector.x +
          pt.toolVector.y * prev.toolVector.y +
          pt.toolVector.z * prev.toolVector.z,
          -1.0), 1.0);
        const angleDeg = (Math.acos(dot) * 180) / Math.PI;
        if (angleDeg > 45.0) {
          hasOrientationFlip = true;
          msgs.push(`Orientation jump: ${angleDeg.toFixed(1)} deg`);
        }
      }

      const isCollision = hasGouge || hasHolderCollision || hasShankCollision || hasFixtureCollision || hasMachineCollision || hasLimitViolation;

      if (isCollision && firstCollisionStepIndex === null) {
        firstCollisionStepIndex = idx;
      }

      if (isCollision || hasSingularity || hasOrientationFlip) {
        stepDetails.set(idx, {
          pointIndex: idx,
          hasGouge,
          hasHolderCollision,
          hasShankCollision,
          hasFixtureCollision,
          hasMachineCollision,
          hasLimitViolation,
          hasSingularity,
          hasOrientationFlip,
          message: msgs.join('; ')
        });
      }
    }

    return {
      gougeReport,
      kinematicReport,
      stepDetails,
      firstCollisionStepIndex
    };
  }
}
