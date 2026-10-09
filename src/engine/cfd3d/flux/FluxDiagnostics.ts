/**
 * SECP Industrial OS v2 — Flux Diagnostics
 * PATCH-053: Flux Framework
 */

import { FluxDiagnostic } from './FluxTypes';

export class FluxDiagnosticsHelper {
  public static isFiniteNumber(val: number): boolean {
    return typeof val === 'number' && Number.isFinite(val);
  }

  public static isFiniteVector3(v: [number, number, number]): boolean {
    return this.isFiniteNumber(v[0]) && this.isFiniteNumber(v[1]) && this.isFiniteNumber(v[2]);
  }

  public static vectorLength(v: [number, number, number]): number {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  }

  public static normalizeVector(v: [number, number, number]): [number, number, number] | null {
    const len = this.vectorLength(v);
    if (!this.isFiniteNumber(len) || len <= 1e-15) {
      return null;
    }
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  public static formatDiagnostics(diagnostics: FluxDiagnostic[]): string {
    if (diagnostics.length === 0) return 'NONE';
    return diagnostics.join(', ');
  }
}
