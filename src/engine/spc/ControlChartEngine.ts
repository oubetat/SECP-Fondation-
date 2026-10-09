/**
 * PATCH-SECP-062: Control Chart Engine
 * Maps individual process points into statistical zones (Zone A/B/C) based on standard 3-sigma
 * control limits to feed visual control charts.
 */

import { SPCObservation, ProcessBaseline } from './SPCTypes';

export interface ControlChartPoint {
  observationId: string;
  partSerial: string;
  value: number;
  mean: number;
  ucl: number;
  lcl: number;
  
  // Statistical Zones (for Western Electric rules and chart display)
  zoneAUpper: number; // cl + 2 sigma to cl + 3 sigma
  zoneBUpper: number; // cl + 1 sigma to cl + 2 sigma
  zoneCUpper: number; // cl to cl + 1 sigma
  zoneCLower: number; // cl - 1 sigma to cl
  zoneBLower: number; // cl - 2 sigma to cl - 1 sigma
  zoneALower: number; // cl - 3 sigma to cl - 2 sigma
  
  isOutOfLimits: boolean;
  timestamp: string;
}

export class ControlChartEngine {
  /**
   * Translates a series of observations into fully qualified control chart points
   */
  public static generateChartPoints(
    observations: SPCObservation[],
    baseline: ProcessBaseline
  ): ControlChartPoint[] {
    const cl = baseline.controlLimits.cl;
    const sigma = baseline.controlLimits.sigma;
    const ucl = baseline.controlLimits.ucl;
    const lcl = baseline.controlLimits.lcl;

    return observations.map(obs => {
      const value = obs.measured;
      const isOutOfLimits = value > ucl || value < lcl;

      return {
        observationId: obs.observationId,
        partSerial: obs.partSerial,
        value,
        mean: cl,
        ucl,
        lcl,
        zoneAUpper: cl + 3 * sigma,
        zoneBUpper: cl + 2 * sigma,
        zoneCUpper: cl + 1 * sigma,
        zoneCLower: cl - 1 * sigma,
        zoneBLower: cl - 2 * sigma,
        zoneALower: cl - 3 * sigma,
        isOutOfLimits,
        timestamp: obs.timestamp
      };
    });
  }
}
