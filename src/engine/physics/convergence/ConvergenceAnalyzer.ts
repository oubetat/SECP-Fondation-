/**
 * SECP Industrial OS v2 — Convergence Analyzer
 * PATCH-049: Numerical Convergence Framework
 */

import { ResidualHistory } from "./ResidualHistory";
import { MonotonicityTrend, DivergenceReason } from "./ConvergenceTypes";

export interface DivergenceCheckResult {
  diverged: boolean;
  reason?: DivergenceReason;
  diagnostic?: string;
}

export interface StagnationCheckResult {
  stagnated: boolean;
  diagnostic?: string;
}

export class ConvergenceAnalyzer {

  public static analyzeMonotonicity(history: ResidualHistory, quantity?: string): MonotonicityTrend {
    const records = history.getRecords();
    if (records.length < 2) return "INSUFFICIENT_DATA";

    let increases = 0;
    let decreases = 0;

    for (let i = 1; i < records.length; i++) {
      const prevVal = this.getResidualValue(records[i - 1], quantity);
      const currVal = this.getResidualValue(records[i], quantity);

      if (prevVal === undefined || currVal === undefined) continue;

      if (currVal < prevVal) decreases++;
      else if (currVal > prevVal) increases++;
    }

    if (decreases > 0 && increases === 0) return "MONOTONIC_DECREASE";
    if (increases > 0 && decreases === 0) return "MONOTONIC_INCREASE";
    return "NON_MONOTONIC";
  }

  public static detectDivergence(history: ResidualHistory, quantity?: string): DivergenceCheckResult {
    if (!history.isValid()) {
      return {
        diverged: true,
        reason: "INVALID_VALUE",
        diagnostic: `Invalid history data: ${history.getValidationErrors().join("; ")}`
      };
    }

    const records = history.getRecords();
    if (records.length === 0) {
      return { diverged: false };
    }

    const latestVal = this.getResidualValue(records[records.length - 1], quantity);
    if (latestVal === undefined || isNaN(latestVal) || !isFinite(latestVal)) {
      return {
        diverged: true,
        reason: "INVALID_VALUE",
        diagnostic: `Latest residual value is invalid: ${latestVal}`
      };
    }

    // 1. Numerical Overflow Check (e.g., > 1e10)
    if (latestVal > 1e10) {
      return {
        diverged: true,
        reason: "NUMERICAL_OVERFLOW",
        diagnostic: `Residual exceeded numerical overflow threshold (value: ${latestVal})`
      };
    }

    // 2. Residual Growth Check (5 consecutive increasing iterations by factor > 1.05)
    if (records.length >= 5) {
      let consecutiveIncreases = 0;
      for (let i = records.length - 4; i < records.length; i++) {
        const prev = this.getResidualValue(records[i - 1], quantity);
        const curr = this.getResidualValue(records[i], quantity);
        if (prev !== undefined && curr !== undefined && curr > prev * 1.05) {
          consecutiveIncreases++;
        }
      }

      if (consecutiveIncreases >= 4) {
        return {
          diverged: true,
          reason: "DIVERGENCE_RESIDUAL_GROWTH",
          diagnostic: "Residual exhibits continuous monotonic exponential growth"
        };
      }
    }

    return { diverged: false };
  }

  public static detectStagnation(
    history: ResidualHistory,
    tolerance: number,
    window = 5,
    quantity?: string
  ): StagnationCheckResult {
    const records = history.getRecords();
    if (records.length < window) {
      return { stagnated: false };
    }

    const recentRecords = records.slice(records.length - window);
    const recentValues = recentRecords
      .map(r => this.getResidualValue(r, quantity))
      .filter((v): v is number => v !== undefined);

    if (recentValues.length < window) return { stagnated: false };

    // Check if ALL recent values are above tolerance
    const allAboveTol = recentValues.every(v => v > tolerance);
    if (!allAboveTol) return { stagnated: false };

    // Check if changes between consecutive iterations in window are smaller than 0.1% relative change
    let maxRelChange = 0;
    for (let i = 1; i < recentValues.length; i++) {
      const prev = recentValues[i - 1];
      const curr = recentValues[i];
      const relChange = Math.abs(curr - prev) / (curr > 1e-15 ? curr : 1e-15);
      if (relChange > maxRelChange) maxRelChange = relChange;
    }

    if (maxRelChange < 1e-3) {
      return {
        stagnated: true,
        diagnostic: `Residuals stagnated above tolerance (${tolerance}) with max relative change ${maxRelChange.toExponential(2)}`
      };
    }

    return { stagnated: false };
  }

  public static calculateRelativeResidual(
    currentResidual: number,
    referenceResidual: number,
    floor = 1e-15
  ): number | undefined {
    if (isNaN(currentResidual) || isNaN(referenceResidual)) return undefined;
    const effectiveRef = Math.max(Math.abs(referenceResidual), floor);
    return Math.abs(currentResidual) / effectiveRef;
  }

  private static getResidualValue(record: any, quantity?: string): number | undefined {
    if (!record || !record.residuals) return undefined;
    if (quantity) {
      const found = record.residuals.find((r: any) => r.quantity === quantity);
      return found ? found.value : undefined;
    }
    // Return max residual across all quantities
    return Math.max(...record.residuals.map((r: any) => r.value));
  }
}
