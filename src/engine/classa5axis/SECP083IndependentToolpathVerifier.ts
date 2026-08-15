/**
 * PATCH-SECP-083: SECP083IndependentToolpathVerifier
 * 
 * Re-evaluates 5-axis toolpaths independently without trusting generator flags.
 * Recomputes gouges, collisions, machine envelope limits, rotary singularities,
 * and orientation smoothness.
 */

import {
  FiveAxisToolpath,
  GougeAndCollisionReport,
  KinematicFeasibilityReport,
  MachineKinematicLimits,
  NurbsSurfacePatch
} from './SECP083Types';
import { SECP083GougeVerifier } from './SECP083GougeVerifier';
import { SECP083MachineKinematicsVerifier } from './SECP083MachineKinematicsVerifier';

export interface IndependentToolpathAuditResult {
  toolpathId: string;
  gougeAndCollisionReport: GougeAndCollisionReport;
  kinematicReport: KinematicFeasibilityReport;
  independentVerdict: 'VERIFIED_CLEAN_5AXIS' | 'REJECTED_GOUGE_COLLISION' | 'REJECTED_KINEMATIC_VIOLATION';
  passed: boolean;
  details: string;
}

export class SECP083IndependentToolpathVerifier {

  public static verifyToolpathIndependently(
    toolpath: FiveAxisToolpath,
    surface: NurbsSurfacePatch,
    machineLimits?: MachineKinematicLimits
  ): IndependentToolpathAuditResult {
    // 1. Independent Gouge & Collision Verification
    const gougeReport = SECP083GougeVerifier.verifyGougesAndClearance(toolpath, surface);

    // 2. Independent Machine Kinematics Verification
    const kinematicReport = SECP083MachineKinematicsVerifier.verifyKinematics(toolpath, machineLimits);

    const passed = gougeReport.passed && kinematicReport.passed;

    let independentVerdict: 'VERIFIED_CLEAN_5AXIS' | 'REJECTED_GOUGE_COLLISION' | 'REJECTED_KINEMATIC_VIOLATION' = 'VERIFIED_CLEAN_5AXIS';
    if (!gougeReport.passed) {
      independentVerdict = 'REJECTED_GOUGE_COLLISION';
    } else if (!kinematicReport.passed) {
      independentVerdict = 'REJECTED_KINEMATIC_VIOLATION';
    }

    const details = passed
      ? `VERIFIED: Clean 5-axis toolpath with 0 gouges, 0 collisions, 0 kinematic violations across ${toolpath.points.length} points.`
      : `REJECTED: Independent verification failed (${gougeReport.details} / ${kinematicReport.details})`;

    return {
      toolpathId: toolpath.toolpathId,
      gougeAndCollisionReport: gougeReport,
      kinematicReport,
      independentVerdict,
      passed,
      details
    };
  }
}
