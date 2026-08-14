/**
 * PATCH-SECP-065: Asset Telemetry Engine
 * Processes and validates sensor data streams for manufacturing assets.
 */

import { TelemetryReading } from './AssetReliabilityTypes';

export class AssetTelemetryEngine {
  public static validateReading(reading: TelemetryReading): TelemetryReading {
    const isValid = reading.value !== undefined && !isNaN(reading.value);
    
    // Boundary checks for typical industrial sensors
    const inRange = reading.value >= -100 && reading.value <= 5000;

    return {
      ...reading,
      isValid: isValid && inRange
    };
  }

  public static processBatch(readings: TelemetryReading[]): TelemetryReading[] {
    return readings.map(r => this.validateReading(r));
  }
}
