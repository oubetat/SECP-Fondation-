/**
 * SECP Industrial OS v2 — Residual History
 * PATCH-049: Numerical Convergence Framework
 */

import { IterationRecord, ResidualValue } from "./ConvergenceTypes";
import * as crypto from "crypto";

export class ResidualHistory {
  private records: IterationRecord[] = [];
  private errors: string[] = [];
  private valid: boolean = true;
  private allowSubIterations: boolean = false;

  constructor(records?: IterationRecord[], allowSubIterations = false) {
    this.allowSubIterations = allowSubIterations;
    if (records && Array.isArray(records)) {
      for (const rec of records) {
        this.append(rec);
      }
    }
  }

  public append(record: IterationRecord): void {
    if (!record) {
      this.markInvalid("Attempted to append null or undefined record");
      return;
    }

    // 1. Iteration Number Check
    if (record.iteration === undefined || record.iteration === null || isNaN(record.iteration)) {
      this.markInvalid("Iteration record has missing or NaN iteration number");
      return;
    }

    if (record.iteration <= 0) {
      this.markInvalid(`Iteration number must be positive integer, got: ${record.iteration}`);
      return;
    }

    if (this.records.length > 0) {
      const lastIter = this.records[this.records.length - 1].iteration;
      if (record.iteration === lastIter && !this.allowSubIterations) {
        this.markInvalid(`Duplicate iteration detected: ${record.iteration}`);
        return;
      }
      if (record.iteration < lastIter) {
        this.markInvalid(`Out-of-order iteration sequence detected: ${record.iteration} after ${lastIter}`);
        return;
      }
    }

    // 2. Residual Values Check
    if (!record.residuals || !Array.isArray(record.residuals) || record.residuals.length === 0) {
      this.markInvalid(`Iteration ${record.iteration} contains no residuals array`);
      return;
    }

    for (const res of record.residuals) {
      if (!res.quantity || res.quantity.trim() === "") {
        this.markInvalid(`Iteration ${record.iteration} has residual with missing quantity name`);
        return;
      }

      if (res.value === undefined || res.value === null || isNaN(res.value)) {
        this.markInvalid(`Iteration ${record.iteration} quantity '${res.quantity}' has invalid value: ${res.value}`);
        return;
      }

      if (!isFinite(res.value)) {
        this.markInvalid(`Iteration ${record.iteration} quantity '${res.quantity}' has Infinite value: ${res.value}`);
        return;
      }

      if (res.value < 0) {
        this.markInvalid(`Iteration ${record.iteration} quantity '${res.quantity}' has negative residual value: ${res.value}`);
        return;
      }
    }

    this.records.push(record);
  }

  private markInvalid(errorMsg: string): void {
    this.valid = false;
    this.errors.push(errorMsg);
  }

  public isValid(): boolean {
    return this.valid;
  }

  public getValidationErrors(): string[] {
    return [...this.errors];
  }

  public length(): number {
    return this.records.length;
  }

  public getRecords(): IterationRecord[] {
    return [...this.records];
  }

  public first(): IterationRecord | undefined {
    return this.records.length > 0 ? this.records[0] : undefined;
  }

  public latest(): IterationRecord | undefined {
    return this.records.length > 0 ? this.records[this.records.length - 1] : undefined;
  }

  public min(quantity?: string): number | undefined {
    if (this.records.length === 0) return undefined;
    let minVal: number | undefined;

    for (const rec of this.records) {
      for (const res of rec.residuals) {
        if (!quantity || res.quantity === quantity) {
          if (minVal === undefined || res.value < minVal) {
            minVal = res.value;
          }
        }
      }
    }
    return minVal;
  }

  public max(quantity?: string): number | undefined {
    if (this.records.length === 0) return undefined;
    let maxVal: number | undefined;

    for (const rec of this.records) {
      for (const res of rec.residuals) {
        if (!quantity || res.quantity === quantity) {
          if (maxVal === undefined || res.value > maxVal) {
            maxVal = res.value;
          }
        }
      }
    }
    return maxVal;
  }

  public calculateCanonicalHash(): string {
    // Deterministic serialization of numerical records ignoring wall-clock timestamps
    const canonicalPayload = this.records.map(r => ({
      iteration: r.iteration,
      simulationTime: r.simulationTime ?? 0,
      residuals: r.residuals.map(res => ({
        quantity: res.quantity,
        value: res.value,
        normalized: res.normalized ?? 0
      })).sort((a, b) => a.quantity.localeCompare(b.quantity)),
      absoluteError: r.absoluteError ?? null,
      relativeError: r.relativeError ?? null,
      nonlinearNorm: r.nonlinearNorm ?? null
    }));

    const serialized = JSON.stringify(canonicalPayload);
    return crypto.createHash("sha256").update(serialized).digest("hex");
  }
}
