import { MQTTConnectorConfig, RawTelemetryPacket, TelemetryDataQuality } from '../IndustrialTelemetryTypes';
import { BaseIndustrialProtocolConnector } from '../IndustrialProtocolConnector';
import { TelemetryHasher } from '../TelemetryHasher';

export class MQTTConnector extends BaseIndustrialProtocolConnector {
  public readonly connectorId: string;
  public readonly protocol = 'MQTT';

  private config: MQTTConnectorConfig;
  private sequenceCounter: Map<string, number> = new Map();

  constructor(config: MQTTConnectorConfig) {
    super();
    this.config = config;
    this.connectorId = config.connectorId;
    this.endpointUrl = config.brokerUrl;
    this.isTls = config.tlsEnabled;
  }

  public async connect(): Promise<{ success: boolean; message: string }> {
    this.state = 'CONNECTING';
    
    if (!this.config.brokerUrl.startsWith('mqtt://') && !this.config.brokerUrl.startsWith('mqtts://') && !this.config.brokerUrl.startsWith('wss://') && !this.config.brokerUrl.startsWith('ws://')) {
      this.state = 'FAULTED';
      this.errorCount++;
      return {
        success: false,
        message: 'Invalid MQTT Broker URL. Must start with mqtt://, mqtts://, ws://, or wss://.'
      };
    }

    this.state = 'CONNECTED';
    this.reconnectAttempts = 0;

    // Auto-subscribe
    for (const sub of this.config.topicSubscriptions) {
      await this.subscribe(sub.topic);
    }

    return {
      success: true,
      message: `Connected to MQTT Broker ${this.config.brokerUrl} as ${this.config.clientId}`
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
    throw new Error('MQTT protocol does not support direct synchronous read operation');
  }

  public async write(addressOrNodeId: string, value: any): Promise<boolean> {
    if (this.state !== 'CONNECTED' && this.state !== 'SUBSCRIBED') {
      return false;
    }
    return true;
  }

  /**
   * Processes incoming MQTT message packet
   */
  public handleMessage(topic: string, payload: any, sequence?: number): { packet?: RawTelemetryPacket; error?: string } {
    if (this.state !== 'CONNECTED' && this.state !== 'SUBSCRIBED') {
      this.errorCount++;
      return { error: 'MQTT Connector is disconnected' };
    }

    const sub = this.config.topicSubscriptions.find(s => s.topic === topic);
    if (!sub) {
      this.errorCount++;
      return { error: `Topic subscription not found: ${topic}` };
    }

    const now = Date.now();
    const currentSeq = (this.sequenceCounter.get(topic) || 0) + 1;
    const seq = sequence !== undefined ? sequence : currentSeq;
    this.sequenceCounter.set(topic, seq);

    const packetId = TelemetryHasher.generateEventId(this.config.connectorId, sub.deviceId, seq, now);

    const packet: RawTelemetryPacket = {
      packetId,
      connectorId: this.config.connectorId,
      protocol: 'MQTT',
      source: 'LIVE',
      rawPayload: {
        topic,
        deviceId: sub.deviceId,
        signalType: sub.signalType,
        value,
        unit: sub.unit,
        quality: 'GOOD',
        timestamp: new Date(now).toISOString(),
        sequenceNumber: seq,
        schemaVersion: '1.0.0'
      },
      receivedAtMs: now
    };

    this.emitPacket(packet);
    return { packet };
  }
}
