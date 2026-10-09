/**
 * ProtocolTestHarness: High-speed multi-protocol industrial telemetry generator
 * 
 * ARCHITECTURAL DECLARATION:
 * This is an explicit Protocol Test Harness designed for reproducible local protocol
 * verification, stress testing (10k-50k events/sec), burst testing, and mutation injection.
 * It is clearly designated as 'TEST-HARNESS' and not claimed as physical Hardware-in-the-Loop.
 */

import {
  RawTelemetryPacket,
  IndustrialProtocol,
  SignalType,
  EngineeringUnit
} from '../IndustrialTelemetryTypes';
import { TelemetryHasher } from '../TelemetryHasher';

export interface HarnessScenarioConfig {
  protocol: IndustrialProtocol;
  deviceId: string;
  connectorId: string;
  ratePerSec: number;
  totalEvents: number;
  burstMultiplier?: number;
  duplicateRate?: number;
  outOfOrderRate?: number;
  clockDriftMs?: number;
  corruptPayloadRate?: number;
}

export class ProtocolTestHarness {
  /**
   * Generates a batch of high-speed deterministic test packets across industrial protocols
   */
  public static generateBatch(
    protocol: IndustrialProtocol,
    deviceId: string,
    connectorId: string,
    count: number,
    startSeq: number = 1,
    baseTimestampMs: number = Date.now()
  ): RawTelemetryPacket[] {
    const packets: RawTelemetryPacket[] = [];

    const signals: Array<{ type: SignalType; unit: EngineeringUnit; min: number; max: number }> = [
      { type: 'TEMPERATURE', unit: 'CELSIUS', min: 45.0, max: 78.0 },
      { type: 'PRESSURE', unit: 'KPA', min: 350.0, max: 520.0 },
      { type: 'RPM', unit: 'RPM', min: 2800, max: 3600 },
      { type: 'VIBRATION', unit: 'MM_S', min: 0.8, max: 2.8 },
      { type: 'CURRENT', unit: 'AMPERE', min: 25.0, max: 48.0 },
      { type: 'FLOW', unit: 'L_MIN', min: 65.0, max: 95.0 }
    ];

    for (let i = 0; i < count; i++) {
      const seq = startSeq + i;
      const sig = signals[i % signals.length];
      const timeMs = baseTimestampMs + i * 2; // 2ms step
      const isoTime = new Date(timeMs).toISOString();

      // Deterministic pseudo-random variation
      const pseudoRand = Math.sin(seq * 0.17 + i) * 0.5 + 0.5;
      const val = parseFloat((sig.min + (sig.max - sig.min) * pseudoRand).toFixed(2));

      const packetId = TelemetryHasher.generateEventId(connectorId, deviceId, seq, timeMs);

      let rawPayload: Record<string, any>;

      switch (protocol) {
        case 'MQTT':
          rawPayload = {
            deviceId,
            timestamp: isoTime,
            sequenceNumber: seq,
            signalType: sig.type,
            value: val,
            unit: sig.unit,
            topic: `factory/line1/${deviceId}/${sig.type.toLowerCase()}`
          };
          break;

        case 'OPC_UA':
          rawPayload = {
            nodeId: `ns=2;s=${deviceId}.${sig.type}`,
            displayName: `${sig.type} Sensor`,
            deviceId,
            signalType: sig.type,
            value: val,
            unit: sig.unit,
            statusCode: 0x00000000, // Good
            timestamp: isoTime,
            serverTimestamp: isoTime,
            sequenceNumber: seq
          };
          break;

        case 'MODBUS_TCP':
        case 'MODBUS_RTU':
          rawPayload = {
            registerAddress: 40001 + (i % signals.length),
            registerType: 'HOLDING_REGISTER',
            dataType: 'FLOAT32_BE',
            deviceId,
            signalType: sig.type,
            value: val,
            unit: sig.unit,
            timestamp: isoTime,
            sequenceNumber: seq
          };
          break;

        case 'MTCONNECT':
          rawPayload = {
            deviceId,
            dataItemId: `item_${sig.type.toLowerCase()}`,
            name: sig.type,
            signalType: sig.type,
            value: val,
            unit: sig.unit,
            timestamp: isoTime,
            sequenceNumber: seq
          };
          break;

        default:
          rawPayload = {
            deviceId,
            timestamp: isoTime,
            sequenceNumber: seq,
            signalType: sig.type,
            value: val,
            unit: sig.unit
          };
      }

      packets.push({
        packetId,
        connectorId,
        protocol,
        source: 'TEST-HARNESS',
        rawPayload,
        receivedAtMs: timeMs + 1
      });
    }

    return packets;
  }

  /**
   * Simulates a duplicate storm for stress testing
   */
  public static injectDuplicates(packets: RawTelemetryPacket[], duplicateRatio: number = 0.2): RawTelemetryPacket[] {
    const output: RawTelemetryPacket[] = [];
    for (const p of packets) {
      output.push(p);
      if (Math.random() < duplicateRatio) {
        output.push({ ...p, packetId: `${p.packetId}-DUP` }); // Re-emit identical sequence
      }
    }
    return output;
  }

  /**
   * Simulates out-of-order packets for stress testing
   */
  public static shuffleOutOfOrder(packets: RawTelemetryPacket[], shuffleWindow: number = 10): RawTelemetryPacket[] {
    const copy = [...packets];
    for (let i = 0; i < copy.length - shuffleWindow; i += shuffleWindow) {
      // Reverse small windows
      const sub = copy.slice(i, i + shuffleWindow).reverse();
      copy.splice(i, shuffleWindow, ...sub);
    }
    return copy;
  }
}
