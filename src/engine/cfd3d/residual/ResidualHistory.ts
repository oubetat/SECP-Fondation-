/**
 * SECP Industrial OS v2 — Residual Framework
 * PATCH-056: Residual History Tracker
 */

import { ResidualSample, ResidualEquation } from './ResidualTypes';

export class ResidualHistory {
  private readonly samples: Map<ResidualEquation, ResidualSample[]> = new Map();

  public addSample(sample: ResidualSample): void {
    if (!this.samples.has(sample.equation)) {
      this.samples.set(sample.equation, []);
    }
    const history = this.samples.get(sample.equation)!;
    
    // Ensure chronological order (based on iteration)
    // We don't sort here for performance, but we expect iterations to be sequential.
    // However, the policy forbids deleting bad iterations.
    history.push(sample);
  }

  public getHistory(equation: ResidualEquation): ResidualSample[] {
    return this.samples.get(equation) ?? [];
  }

  public getLatest(equation: ResidualEquation): ResidualSample | null {
    const history = this.getHistory(equation);
    return history.length > 0 ? history[history.length - 1] : null;
  }

  public getAllEquations(): ResidualEquation[] {
    return Array.from(this.samples.keys());
  }

  /**
   * Generates a hash of the entire history for a specific equation
   */
  public hash(equation: ResidualEquation): string {
    const history = this.getHistory(equation);
    if (history.length === 0) return 'empty-history';

    let h = 0;
    for (const sample of history) {
      const data = `${sample.iteration}-${sample.absoluteResidual.l2}-${sample.stateHash}`;
      for (let i = 0; i < data.length; i++) {
        h = (h << 5) - h + data.charCodeAt(i);
        h |= 0;
      }
    }
    return `rh-hash-${Math.abs(h).toString(16)}`;
  }

  public clear(): void {
    this.samples.clear();
  }
}
