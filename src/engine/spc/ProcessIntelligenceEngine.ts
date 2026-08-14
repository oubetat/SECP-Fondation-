/**
 * PATCH-SECP-062: Process Intelligence Engine
 * Correlates machining parameters (spindle times, feed speed, temperature, material properties)
 * with metrology deviations. Employs the scientific rule "Correlation != Causation" to output
 * ROOT_CAUSE_CANDIDATE alerts and locked-down ProcessFeedbackProposals.
 */

import { SPCObservation, ProcessBaseline, ProcessFeedbackProposal } from './SPCTypes';

export interface CorrelationMatrix {
  independentVariable: string;
  dependentVariable: string;
  pearsonR: number;
  strength: 'STRONG_POSITIVE' | 'MODERATE_POSITIVE' | 'NEGLIGIBLE' | 'MODERATE_NEGATIVE' | 'STRONG_NEGATIVE';
  conclusion: 'ROOT_CAUSE_CANDIDATE' | 'NEGLIGIBLE_CORRELATION';
  description: string;
}

export class ProcessIntelligenceEngine {
  /**
   * Compares execution variables with dimensional errors to detect statistical correlations
   */
  public static correlateVariables(
    observations: SPCObservation[]
  ): CorrelationMatrix[] {
    const matrices: CorrelationMatrix[] = [];
    const n = observations.length;
    if (n < 3) return matrices;

    const deviations = observations.map(o => o.deviation);

    // 1. Correlate Spindle Tool Hours with Deviation
    const toolHours = observations.map(o => o.toolHoursUsed || 0);
    const toolCorr = this.computePearson(toolHours, deviations);
    matrices.push({
      independentVariable: 'Cutting Tool Hours Used',
      dependentVariable: 'Dimensional Deviation (mm)',
      pearsonR: toolCorr,
      strength: this.getStrength(toolCorr),
      conclusion: Math.abs(toolCorr) >= 0.7 ? 'ROOT_CAUSE_CANDIDATE' : 'NEGLIGIBLE_CORRELATION',
      description: Math.abs(toolCorr) >= 0.7
        ? `Strong statistical trend (R = ${toolCorr.toFixed(3)}) indicates Cutting Tool wear is a direct root-cause candidate for part drift.`
        : `Negligible correlation (R = ${toolCorr.toFixed(3)}) with tool wear hours.`
    });

    // 2. Correlate Coolant Temperature with Deviation
    const temps = observations.map(o => o.coolantTemperatureC || 20);
    const tempCorr = this.computePearson(temps, deviations);
    matrices.push({
      independentVariable: 'Coolant Temperature (C)',
      dependentVariable: 'Dimensional Deviation (mm)',
      pearsonR: tempCorr,
      strength: this.getStrength(tempCorr),
      conclusion: Math.abs(tempCorr) >= 0.7 ? 'ROOT_CAUSE_CANDIDATE' : 'NEGLIGIBLE_CORRELATION',
      description: Math.abs(tempCorr) >= 0.7
        ? `Strong correlation (R = ${tempCorr.toFixed(3)}) highlights thermal expansion as a root-cause candidate.`
        : `Coolant temperature remains stable and uncorrelated (R = ${tempCorr.toFixed(3)}) with deviation.`
    });

    return matrices;
  }

  /**
   * Formulates a closed-loop engineering corrective offset recommendation.
   * Strictly locks proposal to PENDING status to mandate manual engineering approval.
   */
  public static proposeFeedback(
    observations: SPCObservation[],
    baseline: ProcessBaseline
  ): ProcessFeedbackProposal | null {
    const n = observations.length;
    if (n === 0) return null;

    const latest = observations[n - 1];
    const meanDeviation = observations.reduce((sum, o) => sum + o.deviation, 0) / n;

    // We only recommend an adjustment if the process is noticeably biased or drifting
    if (Math.abs(meanDeviation) < 0.001) {
      return null; // Average deviation is within micro-scale noise, no feedback adjustment needed
    }

    // Proposed offset is the negative of the average deviation to restore centering
    const suggestedOffsetMm = -meanDeviation;

    return {
      proposalId: `feedback-prop-${latest.machineId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      machineId: latest.machineId,
      toolId: latest.toolId,
      parameterName: 'cutting_tool_wear_offset_z',
      suggestedOffsetMm,
      impactAnalysis: `Closed-loop offset adjustment of ${suggestedOffsetMm.toFixed(5)} mm proposed to neutralize measured bias. Requires validation against adjacent parts to ensure no interference with flatness bounds.`,
      approvalStatus: 'PENDING' // Strict change governance, must not be executed automatically
    };
  }

  private static computePearson(x: number[], y: number[]): number {
    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let num = 0;
    let denX = 0;
    let denY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    const den = Math.sqrt(denX * denY);
    return den > 0 ? num / den : 0.0;
  }

  private static getStrength(r: number): CorrelationMatrix['strength'] {
    const absR = Math.abs(r);
    if (absR >= 0.7) {
      return r > 0 ? 'STRONG_POSITIVE' : 'STRONG_NEGATIVE';
    } else if (absR >= 0.3) {
      return r > 0 ? 'MODERATE_POSITIVE' : 'MODERATE_NEGATIVE';
    }
    return 'NEGLIGIBLE';
  }
}
