import { ContactDiagnosticRecord } from "./types";

export class ContactDiagnostics {
  private records: ContactDiagnosticRecord[] = [];

  recordIteration(record: ContactDiagnosticRecord): void {
    this.records.push({ ...record });
  }

  getRecords(): ContactDiagnosticRecord[] {
    return [...this.records];
  }

  getLatestRecord(): ContactDiagnosticRecord | undefined {
    return this.records[this.records.length - 1];
  }

  getSummary(): {
    totalIterations: number;
    maxPenetrationOverall: number;
    avgSearchTimeMs: number;
    activeContactsPeak: number;
  } {
    if (this.records.length === 0) {
      return {
        totalIterations: 0,
        maxPenetrationOverall: 0,
        avgSearchTimeMs: 0,
        activeContactsPeak: 0
      };
    }

    let maxPen = 0;
    let totalSearchTime = 0;
    let peakActive = 0;

    for (const r of this.records) {
      if (r.maxPenetration > maxPen) maxPen = r.maxPenetration;
      totalSearchTime += r.searchTimeMs;
      if (r.activeCount > peakActive) peakActive = r.activeCount;
    }

    return {
      totalIterations: this.records.length,
      maxPenetrationOverall: maxPen,
      avgSearchTimeMs: totalSearchTime / this.records.length,
      activeContactsPeak: peakActive
    };
  }

  clear(): void {
    this.records = [];
  }
}
