/**
 * SECP Industrial OS - PATCH-269: Fatigue Analysis Kernel
 * Rainflow Cycle Counter conforming to ASTM E1049-85 Standard Practice
 */

import { RainflowCycle, StressHistoryPoint, RainflowHistogramBin } from './FatigueTypes269';

export class RainflowCycleCounter269 {
  /**
   * Filter stress history down to local turning points (peaks and valleys).
   */
  public static extractPeaksAndValleys(history: number[]): number[] {
    if (history.length <= 2) return [...history];

    const extrema: number[] = [history[0]];
    for (let i = 1; i < history.length - 1; i++) {
      const prev = history[i - 1];
      const curr = history[i];
      const next = history[i + 1];

      // Local peak or valley
      if ((curr >= prev && curr > next) || (curr <= prev && curr < next)) {
        // Prevent duplicate adjacent peaks/valleys
        if (extrema[extrema.length - 1] !== curr) {
          extrema.push(curr);
        }
      }
    }
    // Always include end point if distinct
    const last = history[history.length - 1];
    if (extrema[extrema.length - 1] !== last) {
      extrema.push(last);
    }

    return extrema;
  }

  /**
   * ASTM E1049-85 Rainflow Cycle Counting Algorithm.
   */
  public static countCycles(history: StressHistoryPoint[]): RainflowCycle[] {
    if (!history || history.length < 2) return [];

    const rawValues = history.map((h) => h.stressPa);
    const points = this.extractPeaksAndValleys(rawValues);

    const cycles: RainflowCycle[] = [];
    const stack: number[] = [];
    let cycleCounter = 1;

    for (let i = 0; i < points.length; i++) {
      stack.push(points[i]);

      while (stack.length >= 3) {
        const p1 = stack[stack.length - 3];
        const p2 = stack[stack.length - 2];
        const p3 = stack[stack.length - 1];

        const ds1 = Math.abs(p2 - p1);
        const ds2 = Math.abs(p3 - p2);

        if (ds2 >= ds1) {
          // If 3 points exist and ds2 >= ds1, extract p1-p2 as a cycle if stack length is > 3,
          // or as a half-cycle/full cycle depending on boundary
          const minStress = Math.min(p1, p2);
          const maxStress = Math.max(p1, p2);
          const range = ds1;
          const mean = (p1 + p2) / 2;
          const amp = range / 2;
          const R = maxStress !== 0 ? minStress / maxStress : 0;

          // Remove p2 and p1 (or move p3 down)
          if (stack.length === 3) {
            // First segment half-cycle / full-cycle
            cycles.push({
              cycleId: `CYC-RF-${cycleCounter++}`,
              stressRangePa: range,
              meanStressPa: mean,
              stressAmpPa: amp,
              minStressPa: minStress,
              maxStressPa: maxStress,
              loadRatioR: R,
              count: 0.5,
              startIdx: i - 2,
              endIdx: i - 1,
            });
            stack.shift(); // Remove p1
            break;
          } else {
            cycles.push({
              cycleId: `CYC-RF-${cycleCounter++}`,
              stressRangePa: range,
              meanStressPa: mean,
              stressAmpPa: amp,
              minStressPa: minStress,
              maxStressPa: maxStress,
              loadRatioR: R,
              count: 1.0, // Full inner cycle extracted
              startIdx: i - 2,
              endIdx: i - 1,
            });
            // Remove p2 and p1 from stack
            stack.splice(stack.length - 3, 2);
          }
        } else {
          break; // Move to next point
        }
      }
    }

    // Unprocessed residuals on stack treated as half-cycles (reversals)
    for (let i = 0; i < stack.length - 1; i++) {
      const p1 = stack[i];
      const p2 = stack[i + 1];
      const range = Math.abs(p2 - p1);
      if (range > 1e-6) {
        const minStress = Math.min(p1, p2);
        const maxStress = Math.max(p1, p2);
        const mean = (p1 + p2) / 2;
        const amp = range / 2;
        const R = maxStress !== 0 ? minStress / maxStress : 0;

        cycles.push({
          cycleId: `CYC-RF-RES-${cycleCounter++}`,
          stressRangePa: range,
          meanStressPa: mean,
          stressAmpPa: amp,
          minStressPa: minStress,
          maxStressPa: maxStress,
          loadRatioR: R,
          count: 0.5,
          startIdx: i,
          endIdx: i + 1,
        });
      }
    }

    return cycles;
  }

  /**
   * Group Rainflow cycles into histogram bins for spectrum visualization and damage summation.
   */
  public static createHistogramBins(
    cycles: RainflowCycle[],
    numBins: number = 5,
    temperatureK: number = 293.15
  ): RainflowHistogramBin[] {
    if (cycles.length === 0) return [];

    let minRange = Infinity;
    let maxRange = -Infinity;

    for (const c of cycles) {
      if (c.stressRangePa < minRange) minRange = c.stressRangePa;
      if (c.stressRangePa > maxRange) maxRange = c.stressRangePa;
    }

    if (minRange === maxRange) {
      maxRange = minRange + 1e6; // Prevent zero division
    }

    const step = (maxRange - minRange) / numBins;
    const bins: RainflowHistogramBin[] = [];

    for (let b = 0; b < numBins; b++) {
      const binMin = minRange + b * step;
      const binMax = minRange + (b + 1) * step;
      let countSum = 0;
      let meanSum = 0;

      for (const c of cycles) {
        if (
          c.stressRangePa >= binMin &&
          (b === numBins - 1 ? c.stressRangePa <= binMax : c.stressRangePa < binMax)
        ) {
          countSum += c.count;
          meanSum += c.meanStressPa * c.count;
        }
      }

      const meanStress = countSum > 0 ? meanSum / countSum : (binMin + binMax) / 2 / 2;

      bins.push({
        binId: `BIN-${b + 1}`,
        minRangePa: binMin,
        maxRangePa: binMax,
        meanStressPa: meanStress,
        cycleCount: countSum,
        temperatureK,
      });
    }

    return bins;
  }
}
