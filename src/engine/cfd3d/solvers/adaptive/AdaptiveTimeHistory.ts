/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-068: Adaptive Timestep History Manager
 */

import { AdaptiveTimeRecord } from './AdaptiveTypes';

export class AdaptiveTimeHistory {
  private records: AdaptiveTimeRecord[] = [];

  public append(record: AdaptiveTimeRecord): void {
    this.records.push(record);
  }

  public getRecords(): readonly AdaptiveTimeRecord[] {
    return this.records;
  }

  public clear(): void {
    this.records = [];
  }
}
