import { Material } from './materials';

export interface TelemetryReading {
  timestamp: string;
  temperatureC: number;   // Normal: 25 - 75 °C
  pressureKPa: number;    // Normal: 100 - 800 kPa
  rpm: number;            // Normal: 1000 - 6000 RPM
  vibrationMmS: number;   // Normal: 0.5 - 4.5 mm/s
  currentAmp: number;     // Normal: 10 - 80 A
  flowLMin: number;       // Normal: 20 - 150 L/min
}

export type MachineHealthStatus = 'OPTIMAL' | 'WARNING' | 'CRITICAL_ANOMALY';

export interface AnomalyAlert {
  id: string;
  timestamp: string;
  metric: keyof Omit<TelemetryReading, 'timestamp'>;
  severity: 'WARNING' | 'CRITICAL';
  currentValue: number;
  thresholdValue: number;
  message: string;
  recommendedAction: string;
}

export interface DigitalTwinState {
  machineId: string;
  machineName: string;
  healthScore: number; // 0 - 100 %
  status: MachineHealthStatus;
  currentTelemetry: TelemetryReading;
  telemetryHistory: TelemetryReading[];
  alerts: AnomalyAlert[];
  operatingHours: number;
  estimatedRulHours: number; // Remaining Useful Life
  cadThermalColorMapHex: string;
  cadDisplacementScale: number;
}

export class DigitalTwinEngine {
  private static mockTelemetryBase: TelemetryReading = {
    timestamp: new Date().toISOString(),
    temperatureC: 62.4,
    pressureKPa: 420.5,
    rpm: 3450,
    vibrationMmS: 1.85,
    currentAmp: 42.1,
    flowLMin: 85.0,
  };

  /**
   * Generates next telemetry tick with dynamic physics perturbation & anomaly injection capability
   */
  public static generateTelemetryTick(
    previous: TelemetryReading,
    anomalyType?: 'OVERHEAT' | 'OVERPRESSURE' | 'BEARING_VIBRATION' | 'CAVITATION'
  ): TelemetryReading {
    const timeStr = new Date().toLocaleTimeString();

    let temp = previous.temperatureC + (Math.random() - 0.48) * 0.8;
    let press = previous.pressureKPa + (Math.random() - 0.5) * 4.0;
    let rpm = previous.rpm + Math.round((Math.random() - 0.5) * 25);
    let vib = previous.vibrationMmS + (Math.random() - 0.5) * 0.12;
    let curr = previous.currentAmp + (Math.random() - 0.5) * 0.6;
    let flow = previous.flowLMin + (Math.random() - 0.5) * 0.8;

    // Inject deliberate anomaly spike if triggered
    if (anomalyType === 'OVERHEAT') {
      temp += 8.5;
      curr += 4.2;
    } else if (anomalyType === 'OVERPRESSURE') {
      press += 45.0;
      flow -= 6.0;
    } else if (anomalyType === 'BEARING_VIBRATION') {
      vib += 1.4;
      rpm += (Math.random() - 0.5) * 120;
    } else if (anomalyType === 'CAVITATION') {
      flow -= 12.0;
      press -= 30.0;
      vib += 0.9;
    }

    // Clamp physics bounds
    temp = Math.max(20, Math.min(130, temp));
    press = Math.max(50, Math.min(1500, press));
    rpm = Math.max(0, Math.min(9000, rpm));
    vib = Math.max(0.1, Math.min(25, vib));
    curr = Math.max(0, Math.min(180, curr));
    flow = Math.max(0, Math.min(300, flow));

    return {
      timestamp: timeStr,
      temperatureC: parseFloat(temp.toFixed(1)),
      pressureKPa: parseFloat(press.toFixed(1)),
      rpm: Math.round(rpm),
      vibrationMmS: parseFloat(vib.toFixed(2)),
      currentAmp: parseFloat(curr.toFixed(1)),
      flowLMin: parseFloat(flow.toFixed(1)),
    };
  }

  /**
   * Evaluates machine health status and generates automated anomaly diagnostic alerts
   */
  public static evaluateHealth(reading: TelemetryReading): {
    healthScore: number;
    status: MachineHealthStatus;
    newAlerts: AnomalyAlert[];
    cadColorHex: string;
  } {
    const alerts: AnomalyAlert[] = [];
    let score = 100;

    // Temperature checks (Threshold: > 85°C Warning, > 105°C Critical)
    if (reading.temperatureC > 105) {
      score -= 35;
      alerts.push({
        id: `ALT-TEMP-${Date.now()}`,
        timestamp: reading.timestamp,
        metric: 'temperatureC',
        severity: 'CRITICAL',
        currentValue: reading.temperatureC,
        thresholdValue: 105,
        message: `Critical Overheating: ${reading.temperatureC}°C exceeds safe thermal limit!`,
        recommendedAction: 'Reduce motor load immediately & verify coolant fluid pump flow.',
      });
    } else if (reading.temperatureC > 85) {
      score -= 15;
      alerts.push({
        id: `ALT-TEMP-${Date.now()}`,
        timestamp: reading.timestamp,
        metric: 'temperatureC',
        severity: 'WARNING',
        currentValue: reading.temperatureC,
        thresholdValue: 85,
        message: `High Temperature Alert: Operating at ${reading.temperatureC}°C.`,
        recommendedAction: 'Inspect heat exchanger fins for thermal accumulation.',
      });
    }

    // Pressure checks (Threshold: > 700 kPa Warning, > 950 kPa Critical)
    if (reading.pressureKPa > 950) {
      score -= 35;
      alerts.push({
        id: `ALT-PRESS-${Date.now()}`,
        timestamp: reading.timestamp,
        metric: 'pressureKPa',
        severity: 'CRITICAL',
        currentValue: reading.pressureKPa,
        thresholdValue: 950,
        message: `Severe Overpressure: ${reading.pressureKPa} kPa risks pipe burst!`,
        recommendedAction: 'Open main pressure relief bypass valve immediately.',
      });
    } else if (reading.pressureKPa > 700) {
      score -= 12;
      alerts.push({
        id: `ALT-PRESS-${Date.now()}`,
        timestamp: reading.timestamp,
        metric: 'pressureKPa',
        severity: 'WARNING',
        currentValue: reading.pressureKPa,
        thresholdValue: 700,
        message: `Pressure Elevation: ${reading.pressureKPa} kPa exceeds nominal target.`,
        recommendedAction: 'Check downstream throttle valve restriction.',
      });
    }

    // Vibration checks (Threshold: > 5.0 mm/s Warning, > 9.0 mm/s Critical)
    if (reading.vibrationMmS > 9.0) {
      score -= 30;
      alerts.push({
        id: `ALT-VIB-${Date.now()}`,
        timestamp: reading.timestamp,
        metric: 'vibrationMmS',
        severity: 'CRITICAL',
        currentValue: reading.vibrationMmS,
        thresholdValue: 9.0,
        message: `Bearing Mechanical Failure: Vibration ${reading.vibrationMmS} mm/s!`,
        recommendedAction: 'Shutdown drive shaft & align coupling bearings.',
      });
    } else if (reading.vibrationMmS > 5.0) {
      score -= 10;
      alerts.push({
        id: `ALT-VIB-${Date.now()}`,
        timestamp: reading.timestamp,
        metric: 'vibrationMmS',
        severity: 'WARNING',
        currentValue: reading.vibrationMmS,
        thresholdValue: 5.0,
        message: `Elevated Shaft Vibration: ${reading.vibrationMmS} mm/s detected.`,
        recommendedAction: 'Schedule dynamic rotor balancing inspection.',
      });
    }

    score = Math.max(0, Math.min(100, score));

    let status: MachineHealthStatus = 'OPTIMAL';
    let cadColorHex = '#38bdf8'; // Sky blue for optimal

    if (score < 50 || alerts.some(a => a.severity === 'CRITICAL')) {
      status = 'CRITICAL_ANOMALY';
      cadColorHex = '#ef4444'; // Red alert
    } else if (score < 85 || alerts.some(a => a.severity === 'WARNING')) {
      status = 'WARNING';
      cadColorHex = '#f59e0b'; // Amber warning
    }

    return { healthScore: score, status, newAlerts: alerts, cadColorHex };
  }

  /**
   * Initializes default Digital Twin state for SECP Turbo Pump Assembly
   */
  public static createInitialState(): DigitalTwinState {
    const initialTelemetry: TelemetryReading = {
      timestamp: new Date().toLocaleTimeString(),
      temperatureC: 58.2,
      pressureKPa: 380.0,
      rpm: 3200,
      vibrationMmS: 1.4,
      currentAmp: 38.5,
      flowLMin: 92.4,
    };

    return {
      machineId: 'SECP-TWIN-9000',
      machineName: 'SECP High-Pressure Hydraulic Turbo Pump',
      healthScore: 98,
      status: 'OPTIMAL',
      currentTelemetry: initialTelemetry,
      telemetryHistory: [initialTelemetry],
      alerts: [],
      operatingHours: 1420,
      estimatedRulHours: 8580,
      cadThermalColorMapHex: '#38bdf8',
      cadDisplacementScale: 1.0,
    };
  }
}
