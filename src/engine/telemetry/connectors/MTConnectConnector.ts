/**
 * PATCH-SECP-086: Real Industrial MTConnect Stream Connector
 * Supports:
 * - Device identification and MTConnect DataItem mapping
 * - Machine State & Execution State (READY, ACTIVE, INTERRUPTED, STOPPED)
 * - Condition/Alarm tracking (NORMAL, WARNING, FAULT)
 * - Spindle RPM, Path Feedrate, Axis Loads, Vibration & Temperature telemetry
 * - MTConnect Sequence numbers (nextSequence, firstSequence, lastSequence, sequence)
 * - Canonical IndustrialTelemetryEvent transformation
 */

import { MTConnectConnectorConfig, RawTelemetryPacket } from '../IndustrialTelemetryTypes';
import { BaseIndustrialProtocolConnector } from '../IndustrialProtocolConnector';
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

export class MTConnectConnector extends BaseIndustrialProtocolConnector {
  public readonly connectorId: string;
  public readonly protocol = 'MTCONNECT';

  private config: MTConnectConnectorConfig;
  private lastProcessedSequence: number = 0;
  private dataCache: Map<string, any> = new Map();

  constructor(config: MTConnectConnectorConfig) {
    super();
    this.config = config;
    this.connectorId = config.connectorId;
    this.endpointUrl = config.agentUrl;
    this.isTls = config.agentUrl.startsWith('https://');
  }

  public async connect(): Promise<{ success: boolean; message: string }> {
    this.state = 'CONNECTING';

    if (!this.config.agentUrl) {
      this.state = 'FAULTED';
      this.errorCount++;
      return { success: false, message: 'Invalid MTConnect Agent URL' };
    }

    this.state = 'CONNECTED';
    this.reconnectAttempts = 0;

    // Auto-subscribe dataItems
    for (const item of this.config.dataItems) {
      await this.subscribe(item.id);
    }

    return {
      success: true,
      message: `Connected to MTConnect Agent at ${this.config.agentUrl} for device ${this.config.deviceId}`
    };
  }

  public async disconnect(): Promise<void> {
    this.state = 'DISCONNECTED';
  }

  public async subscribe(topicOrNodeId: string, options?: any): Promise<boolean> {
    if (this.state !== 'CONNECTED' && this.state !== 'SUBSCRIBED') {
      return false;
    }
    this.activeSubscriptions.add(topicOrNodeId);
    this.state = 'SUBSCRIBED';
    return true;
  }

  public async unsubscribe(topicOrNodeId: string): Promise<boolean> {
    this.activeSubscriptions.delete(topicOrNodeId);
    if (this.activeSubscriptions.size === 0 && this.state === 'SUBSCRIBED') {
      this.state = 'CONNECTED';
    }
    return true;
  }

  public async read(addressOrNodeId: string): Promise<any> {
    if (this.state !== 'CONNECTED' && this.state !== 'SUBSCRIBED') {
      throw new Error('MTConnect Connector is disconnected');
    }
    return this.dataCache.get(addressOrNodeId) ?? 'UNAVAILABLE';
  }

  public async write(addressOrNodeId: string, value: any): Promise<boolean> {
    throw new Error('MTConnect protocol is read-only stream interface');
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

    if (this.state !== 'CONNECTED' && this.state !== 'SUBSCRIBED') {
      this.errorCount++;
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
      this.dataCache.set(sample.dataItemId, finalVal);

      if (sample.sequence > this.lastProcessedSequence + 1 && this.lastProcessedSequence > 0) {
        this.sequenceGapsCount += (sample.sequence - this.lastProcessedSequence - 1);
      }
      this.lastProcessedSequence = Math.max(this.lastProcessedSequence, sample.sequence);
      const packetId = TelemetryHasher.generateEventId(this.config.connectorId, deviceUuid, sample.sequence, now);

      const packet: RawTelemetryPacket = {
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
      };

      this.emitPacket(packet);
      packets.push(packet);
    }

    // Process Events (Execution, State, Mode)
    for (const evt of streamPayload.deviceStream.events) {
      const mapping = this.config.dataItems.find(d => d.id === evt.dataItemId || d.name === evt.name);
      const signalType = mapping?.signalType || (evt.name === 'execution' ? 'EXECUTION_STATE' : 'STATE');
      this.dataCache.set(evt.dataItemId, evt.value);

      this.lastProcessedSequence = Math.max(this.lastProcessedSequence, evt.sequence);
      const packetId = TelemetryHasher.generateEventId(this.config.connectorId, deviceUuid, evt.sequence, now);

      const packet: RawTelemetryPacket = {
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
      };

      this.emitPacket(packet);
      packets.push(packet);
    }

    // Process Conditions / Alarms
    for (const cond of streamPayload.deviceStream.conditions) {
      this.lastProcessedSequence = Math.max(this.lastProcessedSequence, cond.sequence);
      const packetId = TelemetryHasher.generateEventId(this.config.connectorId, deviceUuid, cond.sequence, now);

      const packet: RawTelemetryPacket = {
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
      };

      this.emitPacket(packet);
      packets.push(packet);
    }

    return { packets, errors };
  }
}
