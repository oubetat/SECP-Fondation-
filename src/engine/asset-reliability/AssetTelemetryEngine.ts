import { TelemetryReading } from './AssetReliabilityTypes';

export class AssetTelemetryEngine {
  public static validateReading(params: {
    timestamp: string;
    sensorId: string;
    metricName: string;
    value: number;
    unit: string;
    isValid?: boolean;
  }): TelemetryReading {
    // Normal operation check to override or validate
    const isWithinRange = params.value >= -40 && params.value <= 150;
    return {
      timestamp: params.timestamp,
      sensorId: params.sensorId,
      metricName: params.metricName,
      value: params.value,
      unit: params.unit,
      isValid: isWithinRange
    };
  }
}
