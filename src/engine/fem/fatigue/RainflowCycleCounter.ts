import { ExtractedCycle } from "./types";

export class RainflowCycleCounter {
  /**
   * Extracts turning points (peaks and valleys) from a stress time series.
   * Removes flat or strictly monotonic intermediate points.
   */
  public static extractTurningPoints(series: number[]): number[] {
    if (series.length < 2) return [...series];

    const turningPoints: number[] = [series[0]];

    for (let i = 1; i < series.length - 1; i++) {
      const prev = series[i - 1];
      const curr = series[i];
      const next = series[i + 1];

      const diff1 = curr - prev;
      const diff2 = next - curr;

      // Local peak or valley if slope changes sign or zero slope transition
      if ((diff1 > 0 && diff2 < 0) || (diff1 < 0 && diff2 > 0)) {
        turningPoints.push(curr);
      } else if (diff1 === 0 && diff2 !== 0) {
        // Handle step changes cleanly
        turningPoints.push(curr);
      }
    }

    turningPoints.push(series[series.length - 1]);
    return turningPoints;
  }

  /**
   * Performs ASTM E1049-85 compliant 3-point Rainflow Cycle Counting on a stress history.
   * Returns array of ExtractedCycle objects with range, amplitude, mean, stress ratio R, and cycle count.
   */
  public static countCycles(stressHistory: number[]): ExtractedCycle[] {
    if (!stressHistory || stressHistory.length < 2) {
      return [];
    }

    const turningPoints = this.extractTurningPoints(stressHistory);
    if (turningPoints.length < 2) return [];

    const cycles: ExtractedCycle[] = [];
    const stack: number[] = [];
    let cycleId = 1;

    for (let i = 0; i < turningPoints.length; i++) {
      stack.push(turningPoints[i]);

      while (stack.length >= 3) {
        const p1 = stack[stack.length - 3];
        const p2 = stack[stack.length - 2];
        const p3 = stack[stack.length - 1];

        const Y = Math.abs(p2 - p1);
        const X = Math.abs(p3 - p2);

        if (X >= Y) {
          // Closed full cycle extracted between p1 and p2
          const maxStress = Math.max(p1, p2);
          const minStress = Math.min(p1, p2);
          const range = Y;
          const amplitude = range / 2.0;
          const mean = (p1 + p2) / 2.0;
          const stressRatio = maxStress !== 0 ? minStress / maxStress : (minStress === 0 ? 1 : -Infinity);

          cycles.push({
            cycleId: cycleId++,
            count: 1.0,
            range,
            amplitude,
            mean,
            stressRatio,
            maxStress,
            minStress
          });

          // Remove p1 and p2 from stack (pop p3, pop p2, pop p1, push p3 back)
          stack.splice(stack.length - 3, 2);
        } else {
          break;
        }
      }
    }

    // Process remaining residual stack as half-cycles (count = 0.5)
    for (let i = 0; i < stack.length - 1; i++) {
      const p1 = stack[i];
      const p2 = stack[i + 1];

      const range = Math.abs(p2 - p1);
      if (range <= 1e-12) continue; // Ignore zero range noise

      const maxStress = Math.max(p1, p2);
      const minStress = Math.min(p1, p2);
      const amplitude = range / 2.0;
      const mean = (p1 + p2) / 2.0;
      const stressRatio = maxStress !== 0 ? minStress / maxStress : (minStress === 0 ? 1 : -Infinity);

      cycles.push({
        cycleId: cycleId++,
        count: 0.5,
        range,
        amplitude,
        mean,
        stressRatio,
        maxStress,
        minStress
      });
    }

    return cycles;
  }

  /**
   * Helper for constant-amplitude sinusoidal or block loading cycles.
   */
  public static extractConstantAmplitudeCycles(
    amplitude: number,
    mean: number,
    numCycles: number
  ): ExtractedCycle[] {
    const range = 2.0 * amplitude;
    const maxStress = mean + amplitude;
    const minStress = mean - amplitude;
    const stressRatio = maxStress !== 0 ? minStress / maxStress : (minStress === 0 ? 1 : -Infinity);

    return [
      {
        cycleId: 1,
        count: numCycles,
        range,
        amplitude,
        mean,
        stressRatio,
        maxStress,
        minStress
      }
    ];
  }
}
