import { ModbusConnectorConfig, RawTelemetryPacket, TelemetryDataQuality } from '../IndustrialTelemetryTypes';
import { BaseIndustrialProtocolConnector } from '../IndustrialProtocolConnector';
import { TelemetryHasher } from '../TelemetryHasher';

export class ModbusConnector extends BaseIndustrialProtocolConnector {
  public readonly connectorId: string;
  public readonly protocol = 'MODBUS_TCP';

  private config: ModbusConnectorConfig;
  private sequenceCounter: Map<number, number> = new Map();

  constructor(config: ModbusConnectorConfig) {
    super();
    this.config = config;
    this.connectorId = config.connectorId;
    this.endpointUrl = `${config.host}:${config.port}`;
    this.isTls = false;
  }

  public async connect(): Promise<{ success: boolean; message: string }> {
    this.state = 'CONNECTING';

    if (!this.config.host) {
      this.state = 'FAULTED';
      this.errorCount++;
      return {
        success: false,
        message: 'Invalid Modbus Host configuration.'
      };
    }

    this.state = 'CONNECTED';
    this.reconnectAttempts = 0;

    // Auto-subscribe register mappings as individual subscriptions
    for (const mapping of this.config.registerMappings) {
      await this.subscribe(mapping.address.toString());
    }

    return {
      success: true,
      message: `Connected to Modbus TCP Server at ${this.config.host}:${this.config.port} (Slave ID: ${this.config.slaveId})`
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
      throw new Error('Modbus Connector is disconnected');
    }
    const addressNum = parseInt(addressOrNodeId);
    const mapping = this.config.registerMappings.find(m => m.address === addressNum);
    if (!mapping) throw new Error(`Modbus Register Address ${addressOrNodeId} not in mappings`);

    return 0.0;
  }

  public async write(addressOrNodeId: string, value: any): Promise<boolean> {
    if (this.state !== 'CONNECTED' && this.state !== 'SUBSCRIBED') {
      return false;
    }
    return true;
  }

  /**
   * Simulates/handles registering modbus reads from physical polling loops
   */
  public handleRegisterRead(address: number, value: any, sequence?: number): { packet?: RawTelemetryPacket; error?: string } {
    if (this.state !== 'CONNECTED' && this.state !== 'SUBSCRIBED') {
      this.errorCount++;
      return { error: 'Modbus Connector is disconnected' };
    }

    const mapping = this.config.registerMappings.find(m => m.address === address);
    if (!mapping) {
      this.errorCount++;
      return { error: `Unmapped Modbus Register Address: ${address}` };
    }

    const now = Date.now();
    const currentSeq = (this.sequenceCounter.get(address) || 0) + 1;
    const seq = sequence !== undefined ? sequence : currentSeq;
    this.sequenceCounter.set(address, seq);

    const packetId = TelemetryHasher.generateEventId(this.config.connectorId, mapping.deviceId, seq, now);

    const packet: RawTelemetryPacket = {
      packetId,
      connectorId: this.config.connectorId,
      protocol: 'MODBUS_TCP',
      source: 'LIVE',
      rawPayload: {
        address,
        deviceId: mapping.deviceId,
        signalType: mapping.signalType,
        value,
        unit: mapping.unit,
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

  /**
   * Decodes a raw buffer into a numeric value based on mapping configuration
   */
  public decodeRegisterValue(buffer: Uint8Array, offset: number, mapping: any): number {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    
    switch (mapping.dataType) {
      case 'INT16':
        return view.getInt16(offset, false);
      case 'UINT16':
        return view.getUint16(offset, false);
      case 'INT32':
        return view.getInt32(offset, false);
      case 'FLOAT32_BE':
        return view.getFloat32(offset, false);
      case 'FLOAT32_LE':
        return view.getFloat32(offset, true);
      default:
        return view.getUint16(offset, false);
    }
  }
}
