import { IndustrialGatewayManager } from '../telemetry/IndustrialGatewayManager';
import { MQTTConnector } from '../telemetry/connectors/MQTTConnector';
import { OPCUAConnector } from '../telemetry/connectors/OPCUAConnector';
import { ProtocolTestHarness } from '../telemetry/harness/ProtocolTestHarness';
import { VerificationResult } from './VerificationResult';

export class SECP086ProtocolIntegrationTestSuite {
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

    // Test 1: Full Multi-Protocol Gateway Initialization
    try {
      const mqtt = new MQTTConnector({
        connectorId: 'GW-MQTT-01',
        brokerUrl: 'mqtts://broker.secp.industrial:8883',
        clientId: 'gw-mqtt-client',
        topicSubscriptions: [{ topic: 'factory/line1/+/telemetry', qos: 1, signalType: 'TEMPERATURE', unit: 'CELSIUS', deviceId: 'CNC-01' }],
        tlsEnabled: true,
        keepAliveSec: 60,
        reconnectBackoffMs: 1000,
        maxReconnectAttempts: 5,
        deduplicationWindowMs: 50
      });

      const opcua = new OPCUAConnector({
        connectorId: 'GW-OPCUA-01',
        endpointUrl: 'opc.tcp://gateway.secp.industrial:4840',
        securityMode: 'SignAndEncrypt',
        securityPolicy: 'Basic256Sha256',
        nodeMappings: [{ nodeId: 'ns=2;s=Spindle.Temp', displayName: 'Temp', signalType: 'TEMPERATURE', unit: 'CELSIUS', deviceId: 'CNC-01', samplingIntervalMs: 1000, queueSize: 10 }],
        authType: 'Anonymous',
        timeoutMs: 5000,
        autoReconnect: true
      });

      await mqtt.connect();
      await opcua.connect();

      gateway.registerConnector(mqtt);
      gateway.registerConnector(opcua);

      const statuses = gateway.getAllConnectorStatuses();
      if (statuses.length === 2 && statuses.every(s => s.connected)) {
        results.push({ name: 'Multi-Protocol Gateway Initialization & Connector Registration', success: true });
      } else {
        results.push({ name: 'Multi-Protocol Gateway Initialization & Connector Registration', success: false, error: 'Connectors not active' });
      }
    } catch (err: any) {
      results.push({ name: 'Multi-Protocol Gateway Initialization & Connector Registration', success: false, error: err.message });
    }

    // Test 2: Ingestion to Digital Twin State Propagation
    try {
      const packets = ProtocolTestHarness.generateBatch('MQTT', 'SECP-TWIN-9000', 'GW-MQTT-01', 10, 1);
      for (const p of packets) {
        p.source = 'LIVE'; // Ensure LIVE source match
      }

      const ingRes = gateway.ingestBatch(packets);
      const twinState = gateway.getDigitalTwinState();

      if (ingRes.normalizedCount === 10 && twinState.telemetryHistory.length > 1) {
        results.push({ name: 'End-to-End Ingestion -> Digital Twin Propagation', success: true });
      } else {
        results.push({ name: 'End-to-End Ingestion -> Digital Twin Propagation', success: false, error: `Normalized ${ingRes.normalizedCount}/10` });
      }
    } catch (err: any) {
      results.push({ name: 'End-to-End Ingestion -> Digital Twin Propagation', success: false, error: err.message });
    }

    // Test 3: Anomaly & RUL Engine Cryptographic Inference Logging
    try {
      const anomalies = gateway.getAnomalyInferences();
      const ruls = gateway.getRulPredictions();

      if (anomalies.length > 0 && ruls.length > 0 && anomalies[0].provenanceHash && ruls[0].provenanceHash) {
        results.push({ name: 'Anomaly & RUL Cryptographic Inference Logging', success: true });
      } else {
        results.push({ name: 'Anomaly & RUL Cryptographic Inference Logging', success: false, error: 'Missing inferences or provenance hashes' });
      }
    } catch (err: any) {
      results.push({ name: 'Anomaly & RUL Cryptographic Inference Logging', success: false, error: err.message });
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
