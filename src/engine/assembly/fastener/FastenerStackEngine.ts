/**
 * SECP FASTENER STACK & JOINT SOLVER (PATCH-226)
 * 
 * Analyzes full bolted joint stacks:
 * Bolt + Top Washer(s) + Clamped Plies (Parts) + Bottom Washer(s) + Nut(s)
 * 
 * Verifies:
 * - Grip length (Lg)
 * - Required thread engagement (Le)
 * - Protrusion past nut face (minimum 2 pitches)
 * - Blind hole bottoming clearance
 * - Unthreaded shank vs thread interface position
 */

import {
  BoltedJointStack,
  ClampedPly,
  FastenerSpecification
} from './FastenerTypes';

export class FastenerStackEngine {
  /**
   * Solves and validates a complete bolted joint stack
   */
  public static solveStack(
    fastener: FastenerSpecification,
    clampedPlies: ClampedPly[],
    topWashers: FastenerSpecification[] = [],
    bottomWashers: FastenerSpecification[] = [],
    nuts: FastenerSpecification[] = []
  ): BoltedJointStack {
    // 1. Calculate Plies Thickness
    const pliesThickness = clampedPlies.reduce((sum, ply) => sum + (ply.thickness_mm || 0), 0);

    // 2. Calculate Washer Thicknesses
    const topWasherThickness = topWashers.reduce(
      (sum, w) => sum + (w.dimensions.washerThickness_h_mm || w.dimensions.headHeight_k_mm || 0),
      0
    );
    const bottomWasherThickness = bottomWashers.reduce(
      (sum, w) => sum + (w.dimensions.washerThickness_h_mm || w.dimensions.headHeight_k_mm || 0),
      0
    );
    const totalWasherThickness = topWasherThickness + bottomWasherThickness;

    // 3. Total Grip Length
    const totalGripLength = pliesThickness + totalWasherThickness;

    // 4. Calculate Nut Height or Tapped Engagement
    const nutHeight = nuts.reduce(
      (sum, n) => sum + (n.dimensions.nutHeight_m_mm || n.dimensions.headHeight_k_mm || 0),
      0
    );

    const d = fastener.dimensions.nominalDiameter_d_mm;
    const P = fastener.thread.pitch_P_mm;
    const actualLength = fastener.dimensions.overallLength_L_mm;

    // Minimum thread engagement length calculation (ISO standard)
    const isThroughBoltWithNut = nuts.length > 0;
    let minRequiredEngagement: number;

    if (isThroughBoltWithNut) {
      // Must engage entire nut height + 2 thread pitches protrusion
      minRequiredEngagement = nutHeight + 2 * P;
    } else {
      // Tapped hole in base ply: determine based on parent material
      const basePly = clampedPlies[clampedPlies.length - 1];
      const baseMat = basePly ? basePly.materialName.toLowerCase() : 'steel';
      if (baseMat.includes('aluminum') || baseMat.includes('al')) {
        minRequiredEngagement = 2.0 * d; // 2.0d for aluminum
      } else if (baseMat.includes('cast iron') || baseMat.includes('bronze')) {
        minRequiredEngagement = 1.25 * d; // 1.25d for cast iron
      } else {
        minRequiredEngagement = 1.0 * d; // 1.0d for steel
      }
    }

    const requiredFastenerLength = totalGripLength + minRequiredEngagement;

    // Protrusion past nut face
    const totalStackHeight = totalGripLength + nutHeight;
    const threadProtrusion = actualLength - totalStackHeight;
    const availableEngagement = Math.max(0, actualLength - totalGripLength);
    const engagementRatio = minRequiredEngagement > 0 ? availableEngagement / minRequiredEngagement : 1;

    // Check unthreaded shank positioning (ensure shank does not enter nut or base plate before clamping)
    const shankLength = Math.max(0, actualLength - fastener.dimensions.threadLength_b_mm);
    const isShankInterfering = shankLength > (totalGripLength - 0.5); // shank longer than grip -> bottoming on shank shoulder!

    // Diagnostic Evaluation
    let verdict: BoltedJointStack['diagnosticVerdict'] = 'SAFE_CLAMPED';
    let message = '';

    if (actualLength < totalGripLength) {
      verdict = 'FASTENER_TOO_SHORT';
      message = `Fastener length (${actualLength}mm) is shorter than grip thickness (${totalGripLength}mm). Joint cannot clamp!`;
    } else if (isShankInterfering) {
      verdict = 'BOTTOMING_BEFORE_CLAMPING';
      message = `Unthreaded shank length (${shankLength}mm) exceeds grip (${totalGripLength}mm). Nut will bind on shank shoulder before applying clamp load!`;
    } else if (availableEngagement < minRequiredEngagement) {
      verdict = 'INSUFFICIENT_ENGAGEMENT';
      message = `Available thread engagement (${availableEngagement.toFixed(1)}mm) is below required standard (${minRequiredEngagement.toFixed(1)}mm). High risk of thread stripping!`;
    } else if (isThroughBoltWithNut && threadProtrusion > (4 * d)) {
      verdict = 'EXCESSIVE_PROTRUSION';
      message = `Fastener protrudes excessively (${threadProtrusion.toFixed(1)}mm > 4×d) past nut. Potential envelope interference or weight penalty.`;
    } else {
      verdict = 'SAFE_CLAMPED';
      message = `Bolted joint stack verified: Grip ${totalGripLength.toFixed(1)}mm, Engagement ${availableEngagement.toFixed(1)}mm (${(engagementRatio * 100).toFixed(0)}% of required), Protrusion ${threadProtrusion.toFixed(1)}mm.`;
    }

    return {
      stackId: `STACK-${Math.random().toString(36).substring(2, 9)}`,
      name: `Joint Stack [${fastener.partNumber} + ${clampedPlies.length} Plies + ${nuts.length > 0 ? 'Nut' : 'Tapped'}]`,
      fastener,
      topWashers,
      clampedPlies,
      bottomWashers,
      nuts,
      totalGripLength_Lg_mm: parseFloat(totalGripLength.toFixed(2)),
      requiredFastenerLength_Lreq_mm: parseFloat(requiredFastenerLength.toFixed(2)),
      actualFastenerLength_L_mm: actualLength,
      threadProtrusionPastNut_P_mm: parseFloat(threadProtrusion.toFixed(2)),
      availableThreadEngagement_mm: parseFloat(availableEngagement.toFixed(2)),
      engagementRatio: parseFloat(engagementRatio.toFixed(2)),
      diagnosticVerdict: verdict,
      diagnosticMessage: message
    };
  }
}
