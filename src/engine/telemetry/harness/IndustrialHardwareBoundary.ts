/**
 * IndustrialHardwareBoundary: Interface contract for future Physical Hardware-in-the-Loop
 * 
 * BOUNDARY CLARIFICATION:
 * Defines the strict interface and protocol boundary required for physical field hardware:
 * - PLC (Siemens S7-1500, Allen-Bradley ControlLogix, Beckhoff TwinCAT ADS)
 * - CNC Controllers (Fanuc, Siemens Sinumerik, Heidenhain MTConnect/OPC-UA)
 * - Vibration Transducers (IEPE Accelerometers, Eddy-Current Proximity Probes)
 * - Thermocouples / PT100 RTDs
 * - 4-20 mA Loop Transmitters
 */

import { IndustrialProtocol, SignalType, EngineeringUnit, TelemetryDataQuality } from '../IndustrialTelemetryTypes';

export interface IHardwareSensorSpecification {
  sensorId: string;
  hardwareType: 'ACCELEROMETER' | 'RTD_THERMOCOUPLE' | 'PRESSURE_TRANSDUCER' | 'ENCODER' | 'CURRENT_TRANSFORMER' | 'FLOW_METER';
  physicalInterface: '4-20mA' | '0-10V' | 'IEPE' | 'RS485_MODBUS' | 'ETHERNET_IP' | 'PROFINET';
  samplingFrequencyHz: number;
  measurementRange: { min: number; max: number; unit: EngineeringUnit };
  calibrationCertificate: string;
  calibrationExpiry: string;
}

export interface IIndustrialHardwareBoundary {
  boundaryId: string;
  gatewayHost: string;
  supportedProtocols: IndustrialProtocol[];
  connectedSensors: IHardwareSensorSpecification[];
  hardwareInTheLoopCertified: boolean;
  isolationStandard: 'IEC-62443-4-2' | 'NIST-SP-800-82';

  pingHardware(): Promise<{ reachable: boolean; rttMs: number }>;
  readRawSensorBuffer(sensorId: string, count: number): Promise<{
    timestamps: number[];
    values: number[];
    quality: TelemetryDataQuality;
  }>;
}
