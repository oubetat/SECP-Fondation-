/**
 * SchemaValidator: Validates that incoming telemetry events strictly conform
 * to the canonical schema, contain valid identities, supported units, and obey physical bounds.
 */

import { RawTelemetryPacket, SchemaValidationResult, SignalType, EngineeringUnit } from '../IndustrialTelemetryTypes';

export class SchemaValidator {
  private static readonly VALID_SIGNAL_TYPES: Set<SignalType> = new Set([
    'TEMPERATURE', 'PRESSURE', 'RPM', 'VIBRATION', 'CURRENT', 'FLOW', 
    'STATE', 'LOAD', 'POSITION', 'POWER', 'VOLTAGE', 'TORQUE', 'HUMIDITY',
    'EXECUTION_STATE', 'ALARM', 'CUSTOM'
  ]);

  private static readonly VALID_UNITS: Set<EngineeringUnit | string> = new Set([
    'CELSIUS', 'FAHRENHEIT', 'KELVIN', 'KPA', 'BAR', 'PSI', 'RPM', 'RAD_S',
    'MM_S', 'IN_S', 'AMPERE', 'MILLIAMPERE', 'VOLT', 'WATT', 'KILOWATT',
    'NM', 'L_MIN', 'GPM', 'M3_H', 'PERCENT', 'STATUS_CODE', 'NONE',
    'degC', 'C', 'kPa', 'bar', 'psi', 'rpm', 'mm/s', 'A', 'L/min', '%'
  ]);

  /**
   * Validates raw telemetry packet before normalization
   */
  public static validate(packet: RawTelemetryPacket): SchemaValidationResult {
    if (!packet || typeof packet !== 'object') {
      return { isValid: false, errorCode: 'INVALID_PACKET_FORMAT', errorMessage: 'Packet is not a valid object' };
    }

    const payload = typeof packet.rawPayload === 'object' ? packet.rawPayload : {};
    const deviceId = (payload as any).deviceId || '';
    const timestamp = (payload as any).timestamp || '';
    const signalType = (payload as any).signalType as SignalType;
    const unit = (payload as any).unit as string;
    const value = (payload as any).value;

    const hasValidDevice = typeof deviceId === 'string' && deviceId.trim().length >= 3;
    const hasValidTimestamp = typeof timestamp === 'string' && timestamp.length > 0 && !isNaN(Date.parse(timestamp));
    const hasValidSignalType = this.VALID_SIGNAL_TYPES.has(signalType);
    const hasValidUnit = unit !== undefined && this.VALID_UNITS.has(unit);
    const hasValidProvenance = typeof packet.packetId === 'string' && packet.packetId.length > 0;

    let withinPhysicalBounds = true;
    let boundsError: string | undefined;

    if (typeof value === 'number') {
      if (isNaN(value) || !isFinite(value)) {
        withinPhysicalBounds = false;
        boundsError = 'Numeric value is NaN or Infinite';
      } else {
        const boundsCheck = this.checkPhysicalSanity(signalType, unit, value);
        if (!boundsCheck.valid) {
          withinPhysicalBounds = false;
          boundsError = boundsCheck.error;
        }
      }
    }

    const isValid = hasValidDevice && hasValidTimestamp && hasValidSignalType && hasValidUnit && hasValidProvenance && withinPhysicalBounds;

    let errorMessage: string | undefined;
    let errorCode: string | undefined;

    if (!hasValidDevice) {
      errorCode = 'INVALID_DEVICE_IDENTITY';
      errorMessage = 'Missing or invalid device ID';
    } else if (!hasValidTimestamp) {
      errorCode = 'INVALID_TIMESTAMP_FORMAT';
      errorMessage = 'Timestamp is missing or cannot be parsed';
    } else if (!hasValidSignalType) {
      errorCode = 'INVALID_SIGNAL_TYPE';
      errorMessage = `Unsupported signal type: ${signalType}`;
    } else if (!hasValidUnit) {
      errorCode = 'INVALID_PHYSICAL_UNIT';
      errorMessage = `Unrecognized engineering unit: ${unit}`;
    } else if (!withinPhysicalBounds) {
      errorCode = 'OUT_OF_PHYSICAL_BOUNDS';
      errorMessage = boundsError || 'Value violates physical thermodynamic/kinematic bounds';
    }

    return {
      isValid,
      errorCode,
      errorMessage,
      validatedFields: {
        hasValidDevice,
        hasValidTimestamp,
        hasValidSignalType,
        hasValidUnit,
        hasValidProvenance,
        withinPhysicalBounds
      }
    };
  }

  /**
   * Enforces physical sanity bounds to reject corrupted telemetry
   */
  private static checkPhysicalSanity(signalType: SignalType, unit: string, val: number): { valid: boolean; error?: string } {
    switch (signalType) {
      case 'TEMPERATURE': {
        // Range: -273.15 °C to +2500 °C
        if (unit === 'FAHRENHEIT') {
          if (val < -459.67 || val > 4500) return { valid: false, error: `Temperature ${val}°F violates physical limits` };
        } else if (unit === 'KELVIN') {
          if (val < 0 || val > 3000) return { valid: false, error: `Temperature ${val}K violates absolute zero` };
        } else {
          if (val < -273.15 || val > 2500) return { valid: false, error: `Temperature ${val}°C violates thermodynamic limit` };
        }
        break;
      }
      case 'PRESSURE': {
        // Range: 0 to 50,000 kPa (500 bar)
        if (val < 0 || val > 500000) return { valid: false, error: `Pressure ${val} kPa is unphysical` };
        break;
      }
      case 'RPM': {
        // Range: 0 to 120,000 RPM
        if (val < 0 || val > 120000) return { valid: false, error: `RPM ${val} exceeds physical rotation limits` };
        break;
      }
      case 'VIBRATION': {
        // Range: 0 to 500 mm/s
        if (val < 0 || val > 500) return { valid: false, error: `Vibration ${val} mm/s exceeds sensor range` };
        break;
      }
      case 'CURRENT': {
        // Range: 0 to 2000 A
        if (val < 0 || val > 2000) return { valid: false, error: `Current ${val} A exceeds electrical circuit limit` };
        break;
      }
      case 'FLOW': {
        // Range: 0 to 5000 L/min
        if (val < 0 || val > 5000) return { valid: false, error: `Flow rate ${val} L/min exceeds physical conduit` };
        break;
      }
    }
    return { valid: true };
  }
}
