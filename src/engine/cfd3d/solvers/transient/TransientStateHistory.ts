/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-067: Transient State History Manager
 */

import { TransientStateRecord } from './TransientTypes';

export class TransientStateHistory {
  private history: TransientStateRecord[] = [];

  public append(record: TransientStateRecord): void {
    this.history.push(record);
  }

  public getHistory(): readonly TransientStateRecord[] {
    return this.history;
  }

  public rollbackTo(timestepIndex: number): void {
    const originalLen = this.history.length;
    this.history = this.history.filter(r => r.timestepIndex <= timestepIndex);
    if (this.history.length === originalLen) {
      throw new Error(`ROLLBACK_CORRUPTION: Timestep index ${timestepIndex} is invalid for history rollback`);
    }
  }

  public clear(): void {
    this.history = [];
  }
}
