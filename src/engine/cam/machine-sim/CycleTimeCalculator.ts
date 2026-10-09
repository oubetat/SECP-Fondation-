/**
 * SECP Industrial OS - PATCH-264: Machine Simulation Engine
 * Cycle Time Calculator: Comprehensive Manufacturing Time Breakdown & Utilization
 */

import { CycleTimeBreakdown, MachineDefinition } from './MachineSimulationTypes';

export class CycleTimeCalculator {
  private definition: MachineDefinition;
  private rapidTimeSec: number = 0;
  private cuttingTimeSec: number = 0;
  private toolChangeTimeSec: number = 0;
  private auxiliaryTimeSec: number = 0;
  private idleTimeSec: number = 0;

  constructor(definition: MachineDefinition) {
    this.definition = definition;
  }

  public reset(): void {
    this.rapidTimeSec = 0;
    this.cuttingTimeSec = 0;
    this.toolChangeTimeSec = 0;
    this.auxiliaryTimeSec = 0;
    this.idleTimeSec = 0;
  }

  public addRapidTime(durationSec: number): void {
    this.rapidTimeSec += durationSec;
  }

  public addCuttingTime(durationSec: number): void {
    this.cuttingTimeSec += durationSec;
  }

  public addToolChange(): void {
    const tcTime = this.definition.toolChanger?.toolChangeTimeSec || 4.5;
    this.toolChangeTimeSec += tcTime;
  }

  public addAuxiliaryTime(dwellSec: number): void {
    this.auxiliaryTimeSec += dwellSec;
  }

  public addSpindleRampTime(): void {
    const ramp = this.definition.spindle?.accelerationTimeSec || 1.2;
    this.auxiliaryTimeSec += ramp;
  }

  public computeBreakdown(): CycleTimeBreakdown {
    const totalTimeSec = this.rapidTimeSec + this.cuttingTimeSec + this.toolChangeTimeSec + this.auxiliaryTimeSec + this.idleTimeSec;
    const safeTotal = totalTimeSec > 0 ? totalTimeSec : 0.001;

    return {
      rapidTimeSec: this.rapidTimeSec,
      cuttingTimeSec: this.cuttingTimeSec,
      toolChangeTimeSec: this.toolChangeTimeSec,
      auxiliaryTimeSec: this.auxiliaryTimeSec,
      idleTimeSec: this.idleTimeSec,
      totalTimeSec,
      cuttingPercentage: (this.cuttingTimeSec / safeTotal) * 100.0,
      rapidPercentage: (this.rapidTimeSec / safeTotal) * 100.0,
      toolChangePercentage: (this.toolChangeTimeSec / safeTotal) * 100.0,
    };
  }
}
