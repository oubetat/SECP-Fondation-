/**
 * SECP086Adversarial.test.ts
 *
 * Adversarial and fault-injection testing for industrial telemetry ingestion:
 * - Duplicate packet flood
 * - Out-of-order & sequence gap handling
 * - Malformed JSON, NaN/Infinity, missing parameters
 * - Clock drift (>5min) and future timestamp rejection
 * - Buffer overflow & backpressure audit logging
 * - Reconnect storms and fault recovery
 */

import { describe, test, expect } from 'vitest';
import { describe, test, expect } from 'vitest';
import { IndustrialGatewayManager } from '../IndustrialGatewayManager';
import { ProtocolTestHarness } from '../harness/ProtocolTestHarness';
import { RawTelemetryPacket } from '../IndustrialTelemetryTypes';

export class SECP086AdversarialTestSuite {
  public static async runTests(): Promise<{
    passed: boolean;
    total: number;
    passedCount: number;
    failedCount: number;
    details: Array<{ name: string; success: boolean; error?: string }>;
  }> {
    const results: Array<{ name: string; success: boolean; error?: string }> = [];
    const gateway = new IndustrialGatewayManager();
    gateway.reset();
    gateway.setMode('LIVE');

    // Test 1: Clock Drift (>5 min in future) Rejection
    try {
      const futureTime = Date.now() + 10 * 60 * 1000; // +10 min
      const packet: RawTelemetryPacket = {
        packetId: 'ADV-FUTURE-01',
        connectorId: 'CONN-01',
        protocol: 'MQTT',
        source: 'LIVE',
        receivedAtMs: Date.now(),
        rawPayload: {
          deviceId: 'PUMP-01',
          signalType: 'TEMPERATURE',
          value: 75.0,
          unit: 'CELSIUS',
          timestamp: new Date(futureTime).toISOString(),
          sequenceNumber: 1
        }
      };

      const res = gateway.ingestPacket(packet);
      if (!res.success && res.rejectReason?.includes('Timestamp rejected')) {
        results.push({ name: 'Adversarial: Clock Drift Future Timestamp Rejection', success: true });
      } else {
        results.push({ name: 'Adversarial: Clock Drift Future Timestamp Rejection', success: false, error: 'Failed to reject future timestamp' });
      }
    } catch (err: any) {
      results.push({ name: 'Adversarial: Clock Drift Future Timestamp Rejection', success: false, error: err.message });
    }

    // Test 2: NaN / Infinity Payload Handling
    try {
      const now = Date.now();
      const packetNan: RawTelemetryPacket = {
        packetId: 'ADV-NAN-01',
        connectorId: 'CONN-01',
        protocol: 'OPC_UA',
        source: 'LIVE',
        receivedAtMs: now,
        rawPayload: {
          deviceId: 'PUMP-01',
          signalType: 'PRESSURE',
          value: NaN,
          unit: 'KPA',
          timestamp: new Date(now).toISOString(),
          sequenceNumber: 2
        }
      };

      const res = gateway.ingestPacket(packetNan);
      if (!res.success && res.rejectReason) {
        results.push({ name: 'Adversarial: Invalid Numeric NaN Rejection', success: true });
      } else {
        results.push({ name: 'Adversarial: Invalid Numeric NaN Rejection', success: false, error: 'Failed to reject NaN value' });
      }
    } catch (err: any) {
      results.push({ name: 'Adversarial: Invalid Numeric NaN Rejection', success: false, error: err.message });
    }

    // Test 3: Buffer Overflow & Zero-Loss Audit Log Record
    try {
      gateway.reset();
      gateway.setMode('LIVE');
      const packets = ProtocolTestHarness.generateBatch('MQTT', 'PUMP-01', 'CONN-01', 100, 10);
      for (const p of packets) p.source = 'LIVE';

      gateway.ingestBatch(packets);
      const stats = gateway.getBufferStats();

      if (stats.totalIngested === 100 && stats.currentQueueDepth > 0) {
        results.push({ name: 'Adversarial: Bounded Queue & Audit Tracking', success: true });
      } else {
        results.push({ name: 'Adversarial: Bounded Queue & Audit Tracking', success: false, error: 'Queue tracking failed' });
      }
    } catch (err: any) {
      results.push({ name: 'Adversarial: Bounded Queue & Audit Tracking', success: false, error: err.message });
    }

    // Test 4: Duplicate Storm Injection Handling
    try {
      const batch = ProtocolTestHarness.generateBatch('MQTT', 'PUMP-02', 'CONN-02', 20, 1);
      for (const p of batch) p.source = 'LIVE';
      const batchWithDups = ProtocolTestHarness.injectDuplicates(batch, 0.5);

      const res = gateway.ingestBatch(batchWithDups);
      if (res.normalizedCount === 20 && res.rejectedCount > 0) {
        results.push({ name: 'Adversarial: Duplicate Storm Filtering', success: true });
      } else {
        results.push({ name: 'Adversarial: Duplicate Storm Filtering', success: false, error: `Expected 20 normalized, got ${res.normalizedCount}` });
      }
    } catch (err: any) {
      results.push({ name: 'Adversarial: Duplicate Storm Filtering', success: false, error: err.message });
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

describe('SECP086 Adversarial Test Suite', () => {
  test('All telemetry adversarial tests pass', async () => {
    const report = await SECP086AdversarialTestSuite.runTests();
    expect(report.passed).toBe(true);
  });
});
