/**
 * SECP086TelemetryIntegrity.test.ts
 *
 * Validates TelemetryNormalizer, SchemaValidator, TimestampValidator, SequenceValidator,
 * physical unit canonicalization, and SHA-256 cryptographic provenance generation.
 */

import { TelemetryNormalizer } from '../ingestion/TelemetryNormalizer';
import { RawTelemetryPacket } from '../IndustrialTelemetryTypes';

export class SECP086TelemetryIntegrityTestSuite {
  public static async runTests(): Promise<{
    passed: boolean;
    total: number;
    passedCount: number;
    failedCount: number;
    details: Array<{ name: string; success: boolean; error?: string }>;
  }> {
    const results: Array<{ name: string; success: boolean; error?: string }> = [];
    const normalizer = new TelemetryNormalizer();

    // Test 1: Unit Canonicalization Fahrenheit -> Celsius
    try {
      const now = Date.now();
      const raw: RawTelemetryPacket = {
        packetId: 'PKT-TEMP-01',
        connectorId: 'CONN-01',
        protocol: 'MQTT',
        source: 'LIVE',
        receivedAtMs: now,
        rawPayload: {
          deviceId: 'PUMP-01',
          signalType: 'TEMPERATURE',
          value: 212.0, // 212°F = 100°C
          unit: 'FAHRENHEIT',
          timestamp: new Date(now).toISOString(),
          sequenceNumber: 1
        }
      };

      const res = normalizer.normalize(raw);
      if (res.event && res.event.value === 100.0 && res.event.unit === 'CELSIUS') {
        results.push({ name: 'Unit Canonicalization °F -> °C', success: true });
      } else {
        results.push({ name: 'Unit Canonicalization °F -> °C', success: false, error: `Expected 100.0 CELSIUS, got ${res.event?.value} ${res.event?.unit}` });
      }
    } catch (err: any) {
      results.push({ name: 'Unit Canonicalization °F -> °C', success: false, error: err.message });
    }

    // Test 2: Unit Canonicalization PSI -> kPa
    try {
      const now = Date.now();
      const raw: RawTelemetryPacket = {
        packetId: 'PKT-PRESS-01',
        connectorId: 'CONN-01',
        protocol: 'MODBUS_TCP',
        source: 'LIVE',
        receivedAtMs: now,
        rawPayload: {
          deviceId: 'PUMP-01',
          signalType: 'PRESSURE',
          value: 100.0, // 100 PSI = ~689.476 kPa
          unit: 'PSI',
          timestamp: new Date(now).toISOString(),
          sequenceNumber: 2
        }
      };

      const res = normalizer.normalize(raw);
      if (res.event && (res.event.value as number) > 689.0 && res.event.unit === 'KPA') {
        results.push({ name: 'Unit Canonicalization PSI -> kPa', success: true });
      } else {
        results.push({ name: 'Unit Canonicalization PSI -> kPa', success: false, error: `Expected ~689.5 KPA, got ${res.event?.value} ${res.event?.unit}` });
      }
    } catch (err: any) {
      results.push({ name: 'Unit Canonicalization PSI -> kPa', success: false, error: err.message });
    }

    // Test 3: Duplicate Sequence Rejection
    try {
      const now = Date.now();
      const raw1: RawTelemetryPacket = {
        packetId: 'PKT-SEQ-01',
        connectorId: 'CONN-01',
        protocol: 'MQTT',
        source: 'LIVE',
        receivedAtMs: now,
        rawPayload: { deviceId: 'PUMP-02', signalType: 'RPM', value: 3200, unit: 'RPM', timestamp: new Date(now).toISOString(), sequenceNumber: 10 }
      };

      const rawDup: RawTelemetryPacket = {
        packetId: 'PKT-SEQ-01-DUP',
        connectorId: 'CONN-01',
        protocol: 'MQTT',
        source: 'LIVE',
        receivedAtMs: now + 5,
        rawPayload: { deviceId: 'PUMP-02', signalType: 'RPM', value: 3200, unit: 'RPM', timestamp: new Date(now).toISOString(), sequenceNumber: 10 }
      };

      normalizer.normalize(raw1);
      const dupRes = normalizer.normalize(rawDup);

      if (dupRes.rejected && dupRes.rejectCode === 'DUPLICATE') {
        results.push({ name: 'Duplicate Sequence Rejection', success: true });
      } else {
        results.push({ name: 'Duplicate Sequence Rejection', success: false, error: 'Failed to reject duplicate sequence' });
      }
    } catch (err: any) {
      results.push({ name: 'Duplicate Sequence Rejection', success: false, error: err.message });
    }

    // Test 4: Cryptographic Provenance SHA-256 Generation
    try {
      const now = Date.now();
      const raw: RawTelemetryPacket = {
        packetId: 'PKT-PROV-01',
        connectorId: 'CONN-01',
        protocol: 'OPC_UA',
        source: 'LIVE',
        receivedAtMs: now,
        rawPayload: { deviceId: 'CNC-01', signalType: 'VIBRATION', value: 1.85, unit: 'MM_S', timestamp: new Date(now).toISOString(), sequenceNumber: 1 }
      };

      const res = normalizer.normalize(raw);
      if (res.event && res.event.provenanceId && res.event.provenanceId.length === 64) {
        results.push({ name: 'Cryptographic SHA-256 Provenance ID Generation', success: true });
      } else {
        results.push({ name: 'Cryptographic SHA-256 Provenance ID Generation', success: false, error: 'Provenance hash invalid or missing' });
      }
    } catch (err: any) {
      results.push({ name: 'Cryptographic SHA-256 Provenance ID Generation', success: false, error: err.message });
    }

    const passedCount = results.filter(r => r.success).length;
    const failedCount = results.length - passedCount;

    return {
      passed: failedCount === 0,
      total: results.length,
      passedCount,
      failedCount,
      details: results
    };
  }
}
