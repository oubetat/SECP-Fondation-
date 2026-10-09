export type IndustrialProtocol = 'MQTT' | 'OPC_UA' | 'MODBUS_TCP' | 'MTCONNECT';
export type TelemetryDataSource = 'LIVE' | 'TEST-HARNESS' | 'SIMULATED' | 'OFFLINE';
export type TelemetryDataQuality = 'GOOD' | 'UNCERTAIN' | 'BAD';

export type SignalType = 
  | 'TEMPERATURE' 
  | 'VIBRATION' 
  | 'PRESSURE' 
  | 'ROTARY_VELOCITY' 
  | 'CURRENT' 
  | 'VOLTAGE' 
  | 'ACCELERATION';

export type EngineeringUnit = 
  | 'CELSIUS' 
  | 'MM_S' 
  | 'KPA' 
  | 'RPM' 
  | 'AMPERES' 
  | 'VOLTS' 
  | 'G_ACCEL';

export interface RawTelemetryPacket {
  packetId: string;
  connectorId: string;
  protocol: IndustrialProtocol;
  source: TelemetryDataSource;
  rawPayload: {
    nodeId?: string;
    topic?: string;
    address?: number;
    displayName?: string;
    deviceId: string;
    signalType: string;
    value: any;
    unit: string;
    quality?: TelemetryDataQuality;
    statusCode?: number;
    timestamp: string;
    serverTimestamp?: string;
    sequenceNumber: number;
    calibrationVersion?: string;
    schemaVersion?: string;
  };
  receivedAtMs: number;
  transportMeta?: any;
}

export interface IndustrialTelemetryEvent {
  eventId: string;
  packetId?: string;
  connectorId: string;
  deviceId: string;
  signalType: SignalType;
  value: number | any;
  unit: EngineeringUnit | string;
  quality: TelemetryDataQuality | string;
  timestamp?: string;
  timestampIso?: string;
  sourceTimestampMs?: number;
  receivedAt?: string;
  receivedAtMs?: number;
  ingestTimestampMs?: number;
  sequenceNumber: number;
  source?: TelemetryDataSource;
  sourceChannel?: TelemetryDataSource;
  calibrationVersion?: string;
  schemaVersion?: string;
  provenanceId?: string;
  metadata?: Record<string, any>;
}

export interface OPCUAConnectorConfig {
  connectorId: string;
  endpointUrl: string;
  securityMode: 'None' | 'Sign' | 'SignAndEncrypt';
  securityPolicy: string;
  authType: 'Anonymous' | 'UserPassword' | 'Certificate';
  nodeMappings: Array<{
    nodeId: string;
    displayName: string;
    deviceId: string;
    signalType: string;
    unit: string;
    samplingIntervalMs: number;
    queueSize: number;
  }>;
  timeoutMs: number;
  autoReconnect: boolean;
}

export interface MQTTConnectorConfig {
  connectorId: string;
  brokerUrl: string;
  clientId: string;
  tlsEnabled: boolean;
  tlsCaCert?: string;
  topicSubscriptions: Array<{
    topic: string;
    qos: number;
    signalType: string;
    unit: string;
    deviceId: string;
  }>;
  keepAliveSec: number;
  reconnectBackoffMs: number;
  maxReconnectAttempts: number;
  deduplicationWindowMs: number;
}

export interface ModbusConnectorConfig {
  connectorId: string;
  mode: 'TCP' | 'RTU';
  host: string;
  port: number;
  slaveId: number;
  registerMappings: Array<{
    address: number;
    registerType: 'COIL' | 'DISCRETE_INPUT' | 'INPUT_REGISTER' | 'HOLDING_REGISTER';
    dataType: 'INT16' | 'UINT16' | 'INT32' | 'FLOAT32_BE' | 'FLOAT32_LE';
    scale: number;
    offset: number;
    deviceId: string;
    signalType: string;
    unit: string;
    description?: string;
  }>;
  pollIntervalMs: number;
  timeoutMs: number;
  crcValidation: boolean;
}

export interface MTConnectConnectorConfig {
  connectorId: string;
  agentUrl: string;
  deviceId: string;
  dataItems: Array<{
    id: string;
    name: string;
    type: string;
    category: string;
    signalType: string;
    unit: string;
  }>;
  pollingIntervalMs: number;
  sampleBufferLength: number;
  timeoutMs: number;
}

export interface SequenceValidationResult {
  isValid: boolean;
  expectedSequence: number;
  actualSequence: number;
  gapDetected: boolean;
  gapSize: number;
  isDuplicate: boolean;
  isOutofOrder: boolean;
}

export type DropReason = 
  | 'BUFFER_OVERFLOW' 
  | 'SCHEMA_VIOLATION' 
  | 'OUT_OF_BOUNDS' 
  | 'INVALID_TIMESTAMP' 
  | 'CLOCK_DRIFT_EXCEEDED' 
  | 'BAD_QUALITY_GATE';

export interface DroppedTelemetryRecord {
  droppedAtMs: number;
  packetId: string;
  connectorId: string;
  deviceId: string;
  reason: DropReason;
  rawPayload: any;
  details: string;
}

export type TimestampClassification = 'VALID' | 'LATE' | 'OUT_OF_ORDER' | 'STALE' | 'CLOCK_DRIFT' | 'FUTURE';

export interface TimestampValidationResult {
  classification: TimestampClassification;
  driftMs: number;
  driftThresholdMs: number;
  isValid: boolean;
}

export interface SchemaValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface RulPredictionProvenance {
  predictionId: string;
  deviceId: string;
  estimatedRulHours: number;
  lowerBoundHours: number;
  upperBoundHours: number;
  confidenceInterval: number;
  computedAtMs: number;
  inputTelemetryDigest: string;
  modelHash: string;
  provenanceHash?: string;
}

export interface TelemetryStreamMetrics {
  totalEventsAudited: number;
  clockDriftViolations: number;
  silentDropDetected: boolean;
  calculatedLossRate: number;
}
