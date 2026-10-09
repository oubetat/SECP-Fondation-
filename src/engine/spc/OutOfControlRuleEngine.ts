/**
 * PATCH-SECP-062: Out-Of-Control Rule Engine
 * Deterministic rules parser executing standard Western Electric/Nelson Rules to detect
 * process anomalies. Outlaws AI "black-box" decision making in safety-critical SPC calculations.
 */

import { SPCObservation, ProcessBaseline, OutOfControlSignal, OutOfControlRuleId } from './SPCTypes';

export class OutOfControlRuleEngine {
  /**
   * Scans a series of observations against established baselines to detect out-of-control signals
   */
  public static evaluateRules(
    observations: SPCObservation[],
    baseline: ProcessBaseline
  ): OutOfControlSignal[] {
    const signals: OutOfControlSignal[] = [];
    const n = observations.length;
    if (n === 0) return signals;

    const values = observations.map(o => o.measured);
    const ucl = baseline.controlLimits.ucl;
    const lcl = baseline.controlLimits.lcl;
    const cl = baseline.controlLimits.cl;
    const sigma = baseline.controlLimits.sigma;

    // --- RULE 1: Extreme Outlier (Any single point beyond UCL or LCL) ---
    const rule1Indices: number[] = [];
    for (let i = 0; i < n; i++) {
      if (values[i] > ucl || values[i] < lcl) {
        rule1Indices.push(i);
      }
    }
    if (rule1Indices.length > 0) {
      signals.push({
        ruleId: 'RULE_1',
        name: 'Single Point Beyond Control Limits',
        pointIndices: rule1Indices,
        description: `Detected ${rule1Indices.length} point(s) exceeding 3-sigma control boundaries (${lcl.toFixed(5)} to ${ucl.toFixed(5)}). Indicates sudden fixture slippage, probe error, or severe surface defects.`,
        severity: 'CRITICAL'
      });
    }

    // --- RULE 2: Sustained Bias / Process Shift (8 or more consecutive points on one side of center line) ---
    let aboveCount = 0;
    let belowCount = 0;
    let aboveIndices: number[] = [];
    let belowIndices: number[] = [];

    for (let i = 0; i < n; i++) {
      if (values[i] > cl) {
        aboveCount++;
        aboveIndices.push(i);
        belowCount = 0;
        belowIndices = [];
      } else if (values[i] < cl) {
        belowCount++;
        belowIndices.push(i);
        aboveCount = 0;
        aboveIndices = [];
      } else {
        aboveCount = 0;
        belowCount = 0;
        aboveIndices = [];
        belowIndices = [];
      }

      if (aboveCount >= 8) {
        signals.push({
          ruleId: 'RULE_2',
          name: 'Sustained Positive Process Shift',
          pointIndices: [...aboveIndices],
          description: `Detected 8 or more consecutive points entirely above the process average line. Indicates a permanent shift in machining conditions.`,
          severity: 'CRITICAL'
        });
        aboveCount = 0; // Reset to avoid double triggering
        aboveIndices = [];
      }
      if (belowCount >= 8) {
        signals.push({
          ruleId: 'RULE_2',
          name: 'Sustained Negative Process Shift',
          pointIndices: [...belowIndices],
          description: `Detected 8 or more consecutive points entirely below the process average line. Indicates a permanent shift in machining conditions.`,
          severity: 'CRITICAL'
        });
        belowCount = 0; // Reset
        belowIndices = [];
      }
    }

    // --- RULE 3: Monotonic Trend / Tool Wear (7 consecutive points steadily rising or steadily falling) ---
    let risingCount = 1;
    let fallingCount = 1;
    let riseIndices: number[] = [0];
    let fallIndices: number[] = [0];

    for (let i = 1; i < n; i++) {
      if (values[i] > values[i - 1]) {
        risingCount++;
        riseIndices.push(i);
        fallingCount = 1;
        fallIndices = [i];
      } else if (values[i] < values[i - 1]) {
        fallingCount++;
        fallIndices.push(i);
        risingCount = 1;
        riseIndices = [i];
      } else {
        risingCount = 1;
        fallingCount = 1;
        riseIndices = [i];
        fallIndices = [i];
      }

      if (risingCount >= 7) {
        signals.push({
          ruleId: 'RULE_3',
          name: 'Monotonic Upward Drift',
          pointIndices: [...riseIndices],
          description: `Detected 7 consecutive points steadily increasing. Typical indicator of steady cutting-tool abrasive wear.`,
          severity: 'WARNING'
        });
        risingCount = 1;
        riseIndices = [i];
      }
      if (fallingCount >= 7) {
        signals.push({
          ruleId: 'RULE_3',
          name: 'Monotonic Downward Drift',
          pointIndices: [...fallIndices],
          description: `Detected 7 consecutive points steadily decreasing. Indicator of machine warm-up cycles or cooling drift.`,
          severity: 'WARNING'
        });
        fallingCount = 1;
        fallIndices = [i];
      }
    }

    // --- RULE 4: Alternating Pattern / Vibration (8 or more consecutive points alternating up and down) ---
    let alternateCount = 1;
    let altIndices: number[] = [0];
    for (let i = 1; i < n; i++) {
      const currentDiff = values[i] - values[i - 1];
      const prevDiff = i > 1 ? values[i - 1] - values[i - 2] : 0;
      
      if (i === 1) {
        if (Math.abs(currentDiff) > 0) {
          alternateCount = 2;
          altIndices.push(i);
        }
      } else {
        // Alternates sign
        if ((currentDiff > 0 && prevDiff < 0) || (currentDiff < 0 && prevDiff > 0)) {
          alternateCount++;
          altIndices.push(i);
        } else {
          alternateCount = 2;
          altIndices = [i - 1, i];
        }
      }

      if (alternateCount >= 8) {
        signals.push({
          ruleId: 'RULE_4',
          name: 'Cyclic Instability / Spindle Vibration',
          pointIndices: [...altIndices],
          description: `Detected 8 consecutive points alternating continuously up and down. Indicates mechanical chatter, spindle wobble, or thermal feedback loop oscillation.`,
          severity: 'WARNING'
        });
        alternateCount = 1;
        altIndices = [i];
      }
    }

    // --- RULE 5: Zone A Clustering (2 out of 3 successive points fall in Zone A or beyond on same side of center) ---
    // Zone A Upper: > cl + 2*sigma. Zone A Lower: < cl - 2*sigma.
    for (let i = 2; i < n; i++) {
      const p1 = values[i - 2];
      const p2 = values[i - 1];
      const p3 = values[i];

      // Upper Zone A
      let upperA_Count = 0;
      if (p1 > cl + 2 * sigma) upperA_Count++;
      if (p2 > cl + 2 * sigma) upperA_Count++;
      if (p3 > cl + 2 * sigma) upperA_Count++;

      // Lower Zone A
      let lowerA_Count = 0;
      if (p1 < cl - 2 * sigma) lowerA_Count++;
      if (p2 < cl - 2 * sigma) lowerA_Count++;
      if (p3 < cl - 2 * sigma) lowerA_Count++;

      if (upperA_Count >= 2) {
        signals.push({
          ruleId: 'RULE_5',
          name: 'Zone A Clustering (Upper)',
          pointIndices: [i - 2, i - 1, i],
          description: `2 out of 3 consecutive points fall in the outer 2-sigma Zone A boundary on the positive side of the mean.`,
          severity: 'WARNING'
        });
      }
      if (lowerA_Count >= 2) {
        signals.push({
          ruleId: 'RULE_5',
          name: 'Zone A Clustering (Lower)',
          pointIndices: [i - 2, i - 1, i],
          description: `2 out of 3 consecutive points fall in the outer 2-sigma Zone A boundary on the negative side of the mean.`,
          severity: 'WARNING'
        });
      }
    }

    return signals;
  }
}
