import { MQTTConnector } from '../telemetry/connectors/MQTTConnector';
import { OPCUAConnector } from '../telemetry/connectors/OPCUAConnector';
import { ModbusConnector } from '../telemetry/connectors/ModbusConnector';
import { MTConnectConnector } from '../telemetry/connectors/MTConnectConnector';
import { VerificationResult } from './VerificationResult';

export class SECP086IndustrialConnectivityTestSuite {
  public static async runTests(): Promise<{
    passed: boolean;
    total: number;
    passedCount: number;
    failedCount: number;
    details: Array<{ name: string; success: boolean; error?: string }>;
  }> {
    const results: Array<{ name: string; success: boolean; error?: string }> = [];

    // Test 1: MQTT Connector Lifecycle & TLS Verification
    try {
      const mqtt = new MQTTConnector({
        connectorId: 'CONN-MQTT-TEST',
        brokerUrl: 'mqtts://factory-broker.secp.industrial:8883',
        clientId: 'secp-client-01',
        topicSubscriptions: [{ topic: 'factory/line1/+/vibration', qos: 1, signalType: 'VIBRATION', unit: 'MM_S', deviceId: 'CNC-01' }],
        tlsEnabled: true,
        keepAliveSec: 60,
        reconnectBackoffMs: 1000,
        maxReconnectAttempts: 5,
        deduplicationWindowMs: 100
      });

      const connRes = await mqtt.connect();
      const health = mqtt.health();
      if (connRes.success && health.connected && health.isTlsVerified && mqtt.getState() === 'SUBSCRIBED') {
        results.push({ name: 'MQTT Connector Lifecycle & TLS Verification', success: true });
      } else {
        results.push({ name: 'MQTT Connector Lifecycle & TLS Verification', success: false, error: 'MQTT failed connecting/subscribing' });
      }
      await mqtt.disconnect();
    } catch (err: any) {
      results.push({ name: 'MQTT Connector Lifecycle & TLS Verification', success: false, error: err.message });
    }

    // Test 2: OPC-UA Gateway Boundary & Node Read/Subscription
    try {
      const opcua = new OPCUAConnector({
        connectorId: 'CONN-OPCUA-TEST',
        endpointUrl: 'opc.tcp://edge-gateway.secp.internal:4840',
        securityMode: 'SignAndEncrypt',
        securityPolicy: 'Basic256Sha256',
        authType: 'Anonymous',
        nodeMappings: [
          { nodeId: 'ns=2;s=Spindle.Vibration', displayName: 'Spindle Vib', signalType: 'VIBRATION', unit: 'MM_S', deviceId: 'CNC-01', samplingIntervalMs: 100, queueSize: 10 }
        ],
        timeoutMs: 5000,
        autoReconnect: true
      });

      const connRes = await opcua.connect();
      const health = opcua.health();
      if (connRes.success && health.connected && connRes.architectureBoundary.includes('SECP-EDGE-OPCUA-GATEWAY-V1')) {
        results.push({ name: 'OPC-UA Gateway Boundary & Node Mapping', success: true });
      } else {
        results.push({ name: 'OPC-UA Gateway Boundary & Node Mapping', success: false, error: 'OPC-UA boundary check failed' });
      }
      await opcua.disconnect();
    } catch (err: any) {
      results.push({ name: 'OPC-UA Gateway Boundary & Node Mapping', success: false, error: err.message });
    }

    // Test 3: Modbus TCP/RTU Register Decoding & Endianness
    try {
      const modbus = new ModbusConnector({
        connectorId: 'CONN-MODBUS-TEST',
        mode: 'TCP',
        host: '192.168.1.100',
        port: 502,
        slaveId: 1,
        pollIntervalMs: 500,
        timeoutMs: 5000,
        crcValidation: true,
        registerMappings: [
          { address: 40001, registerType: 'HOLDING_REGISTER', dataType: 'FLOAT32_BE', scale: 1.0, offset: 0, signalType: 'PRESSURE', unit: 'KPA', deviceId: 'PUMP-01', description: 'Outlet Pressure' }
        ]
      });

      await modbus.connect();
      // Decode Float32 Big Endian 420.5 (Hex: 0x43D24000)
      const testBuffer = new Uint8Array([0x43, 0xD2, 0x40, 0x00]);
      const decodedVal = modbus.decodeRegisterValue(testBuffer, 0, {
        address: 40001,
        registerType: 'HOLDING_REGISTER',
        dataType: 'FLOAT32_BE',
        scale: 1.0,
        offset: 0,
        signalType: 'PRESSURE',
        unit: 'KPA',
        deviceId: 'PUMP-01',
        description: 'Outlet Pressure'
      });

      if (Math.abs((decodedVal as number) - 420.5) < 0.01) {
        results.push({ name: 'Modbus Float32_BE Register Decoding', success: true });
      } else {
        results.push({ name: 'Modbus Float32_BE Register Decoding', success: false, error: `Expected 420.5, got ${decodedVal}` });
      }
      await modbus.disconnect();
    } catch (err: any) {
      results.push({ name: 'Modbus Float32_BE Register Decoding', success: false, error: err.message });
    }

    // Test 4: MTConnect Machine Stream & Condition Ingestion
    try {
      const mtconnect = new MTConnectConnector({
        connectorId: 'CONN-MTC-TEST',
        agentUrl: 'https://cnc-agent.secp.factory:5000',
        deviceId: 'MILL-5AXIS-01',
        dataItems: [
          { id: 'spindle_speed', signalType: 'RPM', unit: 'RPM', name: 'Sspeed', type: 'SAMPLE', category: 'SAMPLE' }
        ],
        pollingIntervalMs: 1000,
        sampleBufferLength: 1000,
        timeoutMs: 5000
      });

      await mtconnect.connect();
      const res = mtconnect.handleStreamPayload({
        header: { creationTime: new Date().toISOString(), sender: 'AGENT', instanceId: 1, version: '2.0', bufferSize: 1000, nextSequence: 10, firstSequence: 1, lastSequence: 9 },
        deviceStream: {
          name: 'MILL-5AXIS-01',
          uuid: 'UUID-5AXIS-01',
          samples: [{ dataItemId: 'spindle_speed', name: 'Sspeed', timestamp: new Date().toISOString(), sequence: 5, value: 3450 }],
          events: [],
          conditions: []
        }
      });

      if (res.packets.length === 1 && (res.packets[0].rawPayload as any).value === 3450) {
        results.push({ name: 'MTConnect Stream Ingestion & Conversion', success: true });
      } else {
        results.push({ name: 'MTConnect Stream Ingestion & Conversion', success: false, error: 'MTConnect sample decoding failed' });
      }
      await mtconnect.disconnect();
    } catch (err: any) {
      results.push({ name: 'MTConnect Stream Ingestion & Conversion', success: false, error: err.message });
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

  public static async verify(): Promise<VerificationResult> {
    const raw = await this.runTests();
    return {
      status: raw.passed ? 'PASS' : 'FAIL',
      metrics: {
        totalChecks: raw.total,
        passedChecks: raw.passedCount,
        failedChecks: raw.failedCount
      },
      violations: raw.details.filter(d => !d.success).map(d => `${d.name}: ${d.error}`),
      evidence: raw.details.map(d => `${d.name}: ${d.success ? 'OK' : d.error}`)
    };
  }
}
