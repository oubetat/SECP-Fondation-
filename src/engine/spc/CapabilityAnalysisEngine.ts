/**
 * PATCH-SECP-062: Capability Analysis Engine
 * Calculates Process Capability Indices:
 * - Cp (Potential Capability based on short-term/within variation)
 * - Cpk (Actual Centering Capability based on short-term/within variation)
 * - Pp (Performance index based on long-term overall variation)
 * - Ppk (Actual Centering Performance based on long-term overall variation)
 * Employs d2 constant = 1.128 (subgroup size 2) for standard within-group sigma approximation.
 */

import { SPCObservation, ProcessBaseline, ProcessCapability } from './SPCTypes';

export class CapabilityAnalysisEngine {
  /**
   * Evaluates process capability against CAD tolerance upper (USL) and lower (LSL) boundaries
   */
  public static analyzeCapability(
    observations: SPCObservation[],
    baseline: ProcessBaseline
  ): ProcessCapability {
    const n = observations.length;
    if (n === 0) {
      return {
        cp: 0, cpk: 0, pp: 0, ppk: 0,
        withinVariation: 0, overallVariation: 0,
        status: 'INCAPABLE',
        interpretation: 'Insufficient data points to compute process capability.'
      };
    }

    // Design Specification limits (USL & LSL) derived from CAD definitions
    // Taken from first observation as baseline standard
    const usl = observations[0].toleranceUpper;
    const lsl = observations[0].toleranceLower;
    const mean = baseline.mean;

    // 1. Overall Variation (Standard Deviation of entire sample)
    const overallVariation = baseline.standardDeviation;

    // 2. Within-subgroup Variation: estimated from Moving Range
    // Sigma_within = MR_bar / d2, where d2 = 1.128 for subgroup size of 2
    const d2 = 1.128;
    const withinVariation = baseline.movingRange > 0 
      ? baseline.movingRange / d2 
      : overallVariation; // Fallback if no moving range is available

    // Guard against zero-variance process to prevent division-by-zero crashes
    if (overallVariation < 1e-6 || withinVariation < 1e-6) {
      return {
        cp: 99.0, cpk: 99.0, pp: 99.0, ppk: 99.0,
        withinVariation: 0, overallVariation: 0,
        status: 'CAPABLE',
        interpretation: 'Process exhibits zero measurable variation. Highly capable under current conditions.'
      };
    }

    // 3. Short-Term Capability (Cp, Cpk)
    const cp = (usl - lsl) / (6 * withinVariation);
    const cpu = (usl - mean) / (3 * withinVariation);
    const cpl = (mean - lsl) / (3 * withinVariation);
    const cpk = Math.min(cpu, cpl);

    // 4. Long-Term Performance (Pp, Ppk)
    const pp = (usl - lsl) / (6 * overallVariation);
    const ppu = (usl - mean) / (3 * overallVariation);
    const ppl = (mean - lsl) / (3 * overallVariation);
    const ppk = Math.min(ppu, ppl);

    // 5. Centering & Capability Status Rating
    let status: ProcessCapability['status'] = 'INCAPABLE';
    let interpretation = '';

    if (cpk >= 1.33 && ppk >= 1.33) {
      status = 'CAPABLE';
      interpretation = 'Highly Capable Process. Cpk and Ppk both meet standard Six Sigma tolerances. Standard centering is maintained.';
    } else if (cpk >= 1.0 && ppk >= 1.0) {
      status = 'MARGINAL';
      interpretation = 'Marginally Capable. The process average is stable but rests close to design tolerance boundaries, risking out-of-spec defects on drift.';
    } else {
      status = 'INCAPABLE';
      interpretation = 'Incapable Process. Out-of-spec risk is high. Prompt correction of spindle alignment, tooling wear offsets, or feed speeds is highly recommended.';
    }

    // Explicit caution: Capability is a tool diagnostic, never a design requirement override
    interpretation += ' Note: Process capability indexes represent statistical centering diagnostics and do not substitute direct CAD geometric verification on individual parts.';

    return {
      cp,
      cpk,
      pp,
      ppk,
      withinVariation,
      overallVariation,
      status,
      interpretation
    };
  }
}
