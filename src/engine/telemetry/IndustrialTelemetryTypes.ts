/**
 * PATCH-SECP-079: Industrial Edge Telemetry & Hardware Protocol Types
 * Defines the canonical telemetry schema, protocol connector contracts,
 * timestamp/sequence classifications, data quality policies, and drop reasons.
 */

export type IndustrialProtocol = 
  | 'MQTT'
  | 'OPC_UA'
  | 'MODBUS_TCP'
  | 'MODBUS_RTU'
  | 'MTCONNECT'
  | 'REST_EDGE';

export type TelemetryDataSource = 
  | 'LIVE'
  | 'TEST-HARNESS'
  | 'SIMULATED'
  | 'OFFLINE';

export type TelemetryDataQuality = 
  | 'GOOD'
  | 'UNCERTAIN'
  | 'BAD'
  | 'STALE'
  | 'INVALID';

export type TimestampClassification = 
  | 'VALID'
  | 'LATE'
  | 'OUT_OF_ORDER'
  | 'STALE'
  | 'CLOCK_DRIFT'
  | 'INVALID';

export type DropReason = 
  | 'BUFFER_OVERFLOW'
  | 'INVALID_SCHEMA'
  | 'DUPLICATE'
  | 'OUT_OF_ORDER'
  | 'NETWORK_FAILURE'
  | 'AUTHENTICATION_FAILURE'
  | 'CHECKSUM_FAILURE'
  | 'UNAUTHORIZED_DEVICE'
  | 'PHYSICAL_BOUNDS_VIOLATED'
  | 'CHANNEL_ISOLATION_VIOLATION'
  | 'SECURITY_VIOLATION'
  | 'UNKNOWN';

export type SignalType = 
  | 'TEMPERATURE'
  | 'PRESSURE'
  | 'RPM'
  | 'VIBRATION'
  | 'CURRENT'
  | 'FLOW'
  | 'STATE'
  | 'LOAD'
  | 'POSITION'
  | 'POWER'
  | 'VOLTAGE'
  | 'TORQUE'
  | 'HUMIDITY'
  | 'EXECUTION_STATE'
  | 'ALARM'
  | 'CUSTOM';

export type EngineeringUnit = 
  | 'CELSIUS'
  | 'FAHRENHEIT'
  | 'KELVIN'
  | 'KPA'
  | 'BAR'
  | 'PSI'
  | 'RPM'
  | 'RAD_S'
  | 'MM_S'
  | 'IN_S'
  | 'AMPERE'
  | 'MILLIAMPERE'
  | 'VOLT'
  | 'WATT'
  | 'KILOWATT'
  | 'NM'
  | 'L_MIN'
  | 'GPM'
  | 'M3_H'
  | 'PERCENT'
  | 'STATUS_CODE'
  | 'NONE';

/**
 * Section 7: Canonical Telemetry Schema
 * Protocol-independent unified schema.
 */
export interface IndustrialTelemetryEvent {
  eventId: string;
  deviceId: string;
  connectorId: string;
  protocol: IndustrialProtocol;
  timestamp: string;               // ISO-8601 source timestamp
  sourceTimestampMs: number;
  receivedAt: string;              // ISO-8601 ingestion timestamp
  ingestTimestampMs: number;
  sequenceNumber: number;
  signalType: SignalType;
  value: number | string | boolean;
  unit: EngineeringUnit | string;
  quality: TelemetryDataQuality;
  source: TelemetryDataSource;
  calibrationVersion: string;
  schemaVersion: string;
  provenanceId: string;            // SHA-256 cryptographic provenance digest
  metadata?: Record<string, any>;
}

/**
 * Raw unvalidated telemetry packet entering ingestion layer
 */
export interface RawTelemetryPacket {
  packetId: string;
  connectorId: string;
  protocol: IndustrialProtocol;
  source: TelemetryDataSource;
  rawPayload: string | Uint8Array | Record<string, any>;
  receivedAtMs: number;
  transportMeta?: {
    topic?: string;
    nodeId?: string;
    registerAddress?: number;
    slaveId?: number;
    mtconnectSequence?: number;
    qos?: number;
    crcValid?: boolean;
    tlsVerified?: boolean;
    authToken?: string;
    clientIp?: string;
  };
}

/**
 * Schema Validation Result
 */
export interface SchemaValidationResult {
  isValid: boolean;
  errorCode?: string;
  errorMessage?: string;
  validatedFields?: {
    hasValidDevice: boolean;
    hasValidTimestamp: boolean;
    hasValidSignalType: boolean;
    hasValidUnit: boolean;
    hasValidProvenance: boolean;
    withinPhysicalBounds: boolean;
  };
}

/**
 * Timestamp Validation Result
 */
export interface TimestampValidationResult {
  classification: TimestampClassification;
  driftMs: number;
  isAcceptable: boolean;
  reason?: string;
}

/**
 * Sequence Integrity Result
 */
export interface SequenceValidationResult {
  status: 'IN_ORDER' | 'DUPLICATE' | 'GAP_DETECTED' | 'REORDERED' | 'RESET';
  expectedSequence: number;
  receivedSequence: number;
  gapSize?: number;
  isAcceptable: boolean;
}

/**
 * Dropped Event Record
 */
export interface DroppedTelemetryRecord {
  dropId: string;
  timestamp: string;
  timestampMs: number;
  deviceId?: string;
  connectorId: string;
  protocol: IndustrialProtocol;
  sequenceNumber?: number;
  reason: DropReason;
  details: string;
  rawPayloadSnippet: string;
}

/**
 * Telemetry Stream Statistics
 */
export interface TelemetryStreamMetrics {
  totalIngested: number;
  totalValidated: number;
  totalNormalized: number;
  totalTwinUpdates: number;
  totalDropped: number;
  totalDuplicates: number;
  totalGaps: number;
  totalReordered: number;
  totalClockDrifts: number;
  dropRate: number;
  duplicateRate: number;
  packetLossRate: number;
  meanIngestLatencyMs: number;
  p95IngestLatencyMs: number;
  p99IngestLatencyMs: number;
  throughputEventsPerSec: number;
  queueDepth: number;
  memoryUsageMb: number;
}

/**
 * Connector Configurations
 */
export interface MQTTConnectorConfig {
  connectorId: string;
  protocol?: IndustrialProtocol;
  brokerUrl: string;
  clientId: string;
  username?: string;
  password?: string;
  authToken?: string;
  tlsEnabled?: boolean;
  tlsCaCert?: string;
  topicSubscriptions: Array<{
    topic: string;
    qos: 0 | 1 | 2;
    signalType?: SignalType;
    unit?: EngineeringUnit;
    deviceId?: string;
  }>;
  keepAliveSec?: number;
  reconnectBackoffMs?: number;
  maxReconnectAttempts?: number;
  deduplicationWindowMs?: number;
}

export interface OPCUAConnectorConfig {
  connectorId: string;
  protocol?: IndustrialProtocol;
  endpointUrl: string;
  securityMode?: 'None' | 'Sign' | 'SignAndEncrypt';
  securityPolicy?: 'None' | 'Basic256Sha256' | 'Aes128_Sha256_RsaOaep';
  authType?: 'Anonymous' | 'UserPassword' | 'Certificate';
  username?: string;
  password?: string;
  nodeMappings: Array<{
    nodeId: string;
    displayName: string;
    deviceId: string;
    signalType: SignalType;
    unit: EngineeringUnit;
    samplingIntervalMs?: number;
    queueSize?: number;
  }>;
  timeoutMs?: number;
  autoReconnect?: boolean;
}

export interface ModbusRegisterMapping {
  address: number;
  registerType: 'HOLDING_REGISTER' | 'INPUT_REGISTER' | 'COIL' | 'DISCRETE_INPUT';
  dataType: 'INT16' | 'UINT16' | 'INT32' | 'UINT32' | 'FLOAT32_BE' | 'FLOAT32_LE' | 'FLOAT32_CDAB';
  scale: number;
  offset: number;
  deviceId: string;
  signalType: SignalType;
  unit: EngineeringUnit;
  description: string;
}

export interface ModbusConnectorConfig {
  connectorId: string;
  protocol?: IndustrialProtocol;
  mode: 'TCP' | 'RTU';
  host?: string;
  port?: number;
  serialPort?: string;
  baudRate?: number;
  slaveId: number;
  registerMappings: ModbusRegisterMapping[];
  pollIntervalMs?: number;
  pollingIntervalMs?: number;
  timeoutMs?: number;
  crcValidation?: boolean;
}

export interface MTConnectConnectorConfig {
  connectorId: string;
  protocol?: IndustrialProtocol;
  agentUrl: string;
  deviceId: string;
  dataItems: Array<{
    id: string;
    name?: string;
    type?: string;
    subType?: string;
    category?: 'SAMPLE' | 'EVENT' | 'CONDITION';
    signalType?: SignalType;
    unit?: EngineeringUnit;
  }>;
  pollingIntervalMs?: number;
  sampleBufferLength?: number;
  timeoutMs?: number;
}

/**
 * Anomaly Provenance Record
 */
export interface AnomalyInferenceProvenance {
  inferenceId: string;
  inputTelemetryHash: string;
  modelVersion: string;
  inferenceTimestamp: string;
  anomalyScore: number;
  threshold: number;
  decision: 'NORMAL' | 'WARNING' | 'CRITICAL_ANOMALY';
  affectedMetric: string;
  provenanceHash: string;
}

/**
 * RUL Prediction Provenance Record
 */
export interface RulPredictionProvenance {
  predictionId: string;
  deviceId: string;
  modelVersion: string;
  featureSet: string[];
  inputWindowHash: string;
  windowSize: number;
  estimatedRulHours: number;
  confidence: number;
  predictionTimestamp: string;
  provenanceHash: string;
}
