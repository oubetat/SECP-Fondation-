/**
 * TelemetryNormalizer: Converts raw telemetry packets into canonical IndustrialTelemetryEvents
 * Supports:
 * - Full pipeline integration: Schema Validation -> Timestamp Validation -> Sequence Validation
 * - Physical unit canonicalization (e.g. °F -> °C, PSI -> kPa, rad/s -> RPM, in/s -> mm/s)
 * - Quality status assignment (GOOD, UNCERTAIN, BAD, STALE, INVALID)
 * - Deterministic SHA-256 cryptographic provenance ID generation
 */

import {
  RawTelemetryPacket,
  IndustrialTelemetryEvent,
  EngineeringUnit,
  SignalType,
  TelemetryDataQuality
} from '../IndustrialTelemetryTypes';
import { SchemaValidator } from './SchemaValidator';
import { TimestampValidator } from './TimestampValidator';
import { SequenceValidator } from './SequenceValidator';
import { TelemetryHasher } from '../TelemetryHasher';

export class TelemetryNormalizer {
  private timestampValidator: TimestampValidator;
  private sequenceValidator: SequenceValidator;

  constructor(timestampValidator?: TimestampValidator, sequenceValidator?: SequenceValidator) {
    this.timestampValidator = timestampValidator || new TimestampValidator();
    this.sequenceValidator = sequenceValidator || new SequenceValidator();
  }

  /**
   * Normalizes a raw packet into a canonical IndustrialTelemetryEvent
   */
  public normalize(packet: RawTelemetryPacket): {
    event?: IndustrialTelemetryEvent;
    rejected?: boolean;
    rejectReason?: string;
    rejectCode?: any;
  } {
    // 1. Schema Validation
    const schemaRes = SchemaValidator.validate(packet);
    if (!schemaRes.isValid) {
      return {
        rejected: true,
        rejectCode: schemaRes.errorCode || 'INVALID_SCHEMA',
        rejectReason: schemaRes.errorMessage || 'Schema validation failed'
      };
    }

    const payload = typeof packet.rawPayload === 'object' ? packet.rawPayload : {};
    const deviceId = (payload as any).deviceId;
    const signalType = (payload as any).signalType as SignalType;
    const rawUnit = (payload as any).unit as EngineeringUnit | string;
    const rawVal = (payload as any).value;
    const sourceTimestamp = (payload as any).timestamp;
    const seq = (payload as any).sequenceNumber || 1;

    const streamKey = `${deviceId}:${signalType}`;

    // 2. Timestamp Validation
    const tsRes = this.timestampValidator.evaluate(sourceTimestamp, packet.receivedAtMs, streamKey);
    if (!tsRes.isAcceptable) {
      return {
        rejected: true,
        rejectCode: tsRes.classification === 'CLOCK_DRIFT' ? 'AUTHENTICATION_FAILURE' : (tsRes.classification === 'STALE' ? 'AUTHENTICATION_FAILURE' : 'INVALID_SCHEMA'),
        rejectReason: tsRes.reason || `Timestamp rejected: ${tsRes.classification}`
      };
    }

    // 3. Sequence Validation
    const seqRes = this.sequenceValidator.evaluate(streamKey, seq);
    if (!seqRes.isAcceptable && seqRes.status === 'DUPLICATE') {
      return {
        rejected: true,
        rejectCode: 'DUPLICATE',
        rejectReason: `Duplicate sequence ${seq} for stream ${streamKey}`
      };
    }

    // 4. Engineering Unit Canonicalization
    const { canonicalValue, canonicalUnit } = this.canonicalizeUnit(signalType, rawUnit, rawVal);

    // 5. Determine Final Quality Status
    let quality: TelemetryDataQuality = (payload as any).quality || 'GOOD';
    if (tsRes.classification === 'LATE' || tsRes.classification === 'OUT_OF_ORDER') {
      if (quality === 'GOOD') quality = 'UNCERTAIN';
    }
    if (tsRes.classification === 'STALE') {
      quality = 'STALE';
    }
    if (seqRes.status === 'GAP_DETECTED') {
      if (quality === 'GOOD') quality = 'UNCERTAIN';
    }

    const sourceTimestampMs = Date.parse(sourceTimestamp);
    const receivedAtIso = new Date(packet.receivedAtMs).toISOString();

    // 6. Cryptographic Provenance Generation
    const rawPayloadDigest = TelemetryHasher.hashString(
      `${packet.connectorId}:${deviceId}:${packet.protocol}:${seq}:${sourceTimestamp}:${canonicalValue}:${canonicalUnit}:${packet.source}`
    );

    const provenanceId = TelemetryHasher.hashString(
      `PROV-079:${packet.packetId}:${rawPayloadDigest}:${receivedAtIso}`
    );

    const event: IndustrialTelemetryEvent = {
      eventId: packet.packetId,
      deviceId,
      connectorId: packet.connectorId,
      protocol: packet.protocol,
      timestamp: sourceTimestamp,
      sourceTimestampMs,
      receivedAt: receivedAtIso,
      ingestTimestampMs: packet.receivedAtMs,
      sequenceNumber: seq,
      signalType,
      value: canonicalValue,
      unit: canonicalUnit,
      quality,
      source: packet.source,
      calibrationVersion: (payload as any).calibrationVersion || '1.0.0',
      schemaVersion: (payload as any).schemaVersion || '1.0.0',
      provenanceId,
      metadata: (payload as any).metadata
    };

    return { event };
  }

  /**
   * Converts engineering units to standard canonical units:
   * Temperature -> CELSIUS
   * Pressure -> KPA
   * RPM -> RPM
   * Vibration -> MM_S
   * Current -> AMPERE
   * Flow -> L_MIN
   */
  private canonicalizeUnit(
    signalType: SignalType,
    unit: EngineeringUnit | string,
    val: any
  ): { canonicalValue: any; canonicalUnit: EngineeringUnit | string } {
    if (typeof val !== 'number') {
      return { canonicalValue: val, canonicalUnit: unit };
    }

    switch (signalType) {
      case 'TEMPERATURE': {
        if (unit === 'FAHRENHEIT' || unit === 'degF') {
          return { canonicalValue: parseFloat(((val - 32) * 5 / 9).toFixed(3)), canonicalUnit: 'CELSIUS' };
        }
        if (unit === 'KELVIN' || unit === 'K') {
          return { canonicalValue: parseFloat((val - 273.15).toFixed(3)), canonicalUnit: 'CELSIUS' };
        }
        return { canonicalValue: val, canonicalUnit: 'CELSIUS' };
      }
      case 'PRESSURE': {
        if (unit === 'BAR' || unit === 'bar') {
          return { canonicalValue: parseFloat((val * 100).toFixed(3)), canonicalUnit: 'KPA' };
        }
        if (unit === 'PSI' || unit === 'psi') {
          return { canonicalValue: parseFloat((val * 6.89476).toFixed(3)), canonicalUnit: 'KPA' };
        }
        return { canonicalValue: val, canonicalUnit: 'KPA' };
      }
      case 'RPM': {
        if (unit === 'RAD_S') {
          return { canonicalValue: Math.round(val * 60 / (2 * Math.PI)), canonicalUnit: 'RPM' };
        }
        return { canonicalValue: Math.round(val), canonicalUnit: 'RPM' };
      }
      case 'VIBRATION': {
        if (unit === 'IN_S') {
          return { canonicalValue: parseFloat((val * 25.4).toFixed(4)), canonicalUnit: 'MM_S' };
        }
        return { canonicalValue: parseFloat(val.toFixed(4)), canonicalUnit: 'MM_S' };
      }
      case 'CURRENT': {
        if (unit === 'MILLIAMPERE') {
          return { canonicalValue: parseFloat((val / 1000).toFixed(4)), canonicalUnit: 'AMPERE' };
        }
        return { canonicalValue: parseFloat(val.toFixed(3)), canonicalUnit: 'AMPERE' };
      }
      case 'FLOW': {
        if (unit === 'GPM') {
          return { canonicalValue: parseFloat((val * 3.78541).toFixed(3)), canonicalUnit: 'L_MIN' };
        }
        if (unit === 'M3_H') {
          return { canonicalValue: parseFloat((val * 1000 / 60).toFixed(3)), canonicalUnit: 'L_MIN' };
        }
        return { canonicalValue: parseFloat(val.toFixed(3)), canonicalUnit: 'L_MIN' };
      }
      default:
        return { canonicalValue: val, canonicalUnit: unit };
    }
  }
}
