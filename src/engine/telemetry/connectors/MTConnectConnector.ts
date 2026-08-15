/**
 * MTConnectConnector: Adapter for CNC & Machine Tool MTConnect Streams
 * Supports:
 * - Device identification and MTConnect DataItem mapping
 * - Machine State & Execution State (READY, ACTIVE, INTERRUPTED, STOPPED)
 * - Condition/Alarm tracking (NORMAL, WARNING, FAULT)
 * - Spindle RPM, Path Feedrate, Axis Loads, Vibration & Temperature telemetry
 * - MTConnect Sequence numbers (nextSequence, firstSequence, lastSequence, sequence)
 * - Canonical IndustrialTelemetryEvent transformation
 */

import { MTConnectConnectorConfig, RawTelemetryPacket } from '../IndustrialTelemetryTypes';
import { TelemetryHasher } from '../TelemetryHasher';

export interface MTConnectSampleItem {
  dataItemId: string;
  name?: string;
  timestamp: string;
  sequence: number;
  value: string | number;
  subType?: string;
}

export interface MTConnectConditionItem {
  dataItemId: string;
  type: string;
  level: 'NORMAL' | 'WARNING' | 'FAULT' | 'UNAVAILABLE';
  timestamp: string;
  sequence: number;
  qualifier?: string;
  nativeCode?: string;
  message?: string;
}

export interface MTConnectStreamPayload {
  header: {
    creationTime: string;
    sender: string;
    instanceId: number;
    version: string;
    bufferSize: number;
    nextSequence: number;
    firstSequence: number;
    lastSequence: number;
  };
  deviceStream: {
    name: string;
    uuid: string;
    samples: MTConnectSampleItem[];
    events: MTConnectSampleItem[];
    conditions: MTConnectConditionItem[];
  };
}

export class MTConnectConnector {
  private config: MTConnectConnectorConfig;
  private isConnected: boolean = false;
  private lastProcessedSequence: number = 0;

  constructor(config: MTConnectConnectorConfig) {
    this.config = config;
  }

  public async connect(): Promise<{ success: boolean; message: string }> {
    if (!this.config.agentUrl) {
      return { success: false, message: 'Invalid MTConnect Agent URL' };
    }
    this.isConnected = true;
    return {
      success: true,
      message: `Connected to MTConnect Agent at ${this.config.agentUrl} for device ${this.config.deviceId}`
    };
  }

  public disconnect(): void {
    this.isConnected = false;
  }

  public getStatus(): {
    connected: boolean;
    agentUrl: string;
    deviceId: string;
    dataItemsCount: number;
    lastSequence: number;
  } {
    return {
      connected: this.isConnected,
      agentUrl: this.config.agentUrl,
      deviceId: this.config.deviceId,
      dataItemsCount: this.config.dataItems.length,
      lastSequence: this.lastProcessedSequence
    };
  }

  /**
   * Transforms an incoming MTConnect Stream payload into canonical RawTelemetryPackets
   */
  public handleStreamPayload(streamPayload: MTConnectStreamPayload): {
    packets: RawTelemetryPacket[];
    errors: string[];
  } {
    const packets: RawTelemetryPacket[] = [];
    const errors: string[] = [];

    if (!this.isConnected) {
      errors.push('MTConnect Connector is disconnected');
      return { packets, errors };
    }

    const now = Date.now();
    const deviceUuid = streamPayload.deviceStream.uuid || this.config.deviceId;

    // Process Samples
    for (const sample of streamPayload.deviceStream.samples) {
      const mapping = this.config.dataItems.find(d => d.id === sample.dataItemId || d.name === sample.name);
      const signalType = mapping?.signalType || 'CUSTOM';
      const unit = mapping?.unit || 'NONE';

      const numVal = typeof sample.value === 'number' ? sample.value : parseFloat(sample.value);
      const finalVal = isNaN(numVal) ? sample.value : numVal;

      this.lastProcessedSequence = Math.max(this.lastProcessedSequence, sample.sequence);
      const packetId = TelemetryHasher.generateEventId(this.config.connectorId, deviceUuid, sample.sequence, now);

      packets.push({
        packetId,
        connectorId: this.config.connectorId,
        protocol: 'MTCONNECT',
        source: 'LIVE',
        rawPayload: {
          deviceId: deviceUuid,
          dataItemId: sample.dataItemId,
          name: sample.name || mapping?.name,
          signalType,
          value: finalVal,
          unit,
          timestamp: sample.timestamp,
          sequenceNumber: sample.sequence,
          calibrationVersion: 'MTC-CAL-1.0',
          schemaVersion: '1.0.0'
        },
        receivedAtMs: now,
        transportMeta: {
          mtconnectSequence: sample.sequence
        }
      });
    }

    // Process Events (Execution, State, Mode)
    for (const evt of streamPayload.deviceStream.events) {
      const mapping = this.config.dataItems.find(d => d.id === evt.dataItemId || d.name === evt.name);
      const signalType = mapping?.signalType || (evt.name === 'execution' ? 'EXECUTION_STATE' : 'STATE');

      this.lastProcessedSequence = Math.max(this.lastProcessedSequence, evt.sequence);
      const packetId = TelemetryHasher.generateEventId(this.config.connectorId, deviceUuid, evt.sequence, now);

      packets.push({
        packetId,
        connectorId: this.config.connectorId,
        protocol: 'MTCONNECT',
        source: 'LIVE',
        rawPayload: {
          deviceId: deviceUuid,
          dataItemId: evt.dataItemId,
          name: evt.name,
          signalType,
          value: evt.value,
          unit: 'STATUS_CODE',
          timestamp: evt.timestamp,
          sequenceNumber: evt.sequence,
          calibrationVersion: 'MTC-CAL-1.0',
          schemaVersion: '1.0.0'
        },
        receivedAtMs: now,
        transportMeta: {
          mtconnectSequence: evt.sequence
        }
      });
    }

    // Process Conditions / Alarms
    for (const cond of streamPayload.deviceStream.conditions) {
      this.lastProcessedSequence = Math.max(this.lastProcessedSequence, cond.sequence);
      const packetId = TelemetryHasher.generateEventId(this.config.connectorId, deviceUuid, cond.sequence, now);

      packets.push({
        packetId,
        connectorId: this.config.connectorId,
        protocol: 'MTCONNECT',
        source: 'LIVE',
        rawPayload: {
          deviceId: deviceUuid,
          dataItemId: cond.dataItemId,
          signalType: 'ALARM',
          value: cond.level,
          unit: 'NONE',
          timestamp: cond.timestamp,
          sequenceNumber: cond.sequence,
          metadata: {
            qualifier: cond.qualifier,
            nativeCode: cond.nativeCode,
            message: cond.message
          },
          calibrationVersion: 'MTC-CAL-1.0',
          schemaVersion: '1.0.0'
        },
        receivedAtMs: now,
        transportMeta: {
          mtconnectSequence: cond.sequence
        }
      });
    }

    return { packets, errors };
  }
}
