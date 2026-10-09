export interface TelemetryReading {
  temperatureC: number;
  pressureKPa: number;
  rpm: number;
  vibrationMmS: number;
  currentAmp: number;
  flowLMin: number;
}

export interface DigitalTwinAlert {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  timestamp: string;
  message: string;
}

export interface DigitalTwinState {
  currentTelemetry: TelemetryReading;
  alerts: DigitalTwinAlert[];
  healthScore: number;
  cadThermalColorMapHex: string;
  status: 'NOMINAL' | 'WARNING' | 'CRITICAL';
  operatingHours: number;
  estimatedRulHours: number;
  telemetryHistory: TelemetryReading[];
  machineId: string;
}

export class DigitalTwinEngine {
  public static createInitialState(): DigitalTwinState {
    return {
      currentTelemetry: {
        temperatureC: 22.0,
        pressureKPa: 101.3,
        rpm: 0,
        vibrationMmS: 0.0,
        currentAmp: 0.0,
        flowLMin: 0.0,
      },
      alerts: [],
      healthScore: 100.0,
      cadThermalColorMapHex: '#10b981',
      status: 'NOMINAL',
      operatingHours: 0.0,
      estimatedRulHours: 10000.0,
      telemetryHistory: [],
      machineId: 'SECP-TWIN-9000',
    };
  }

  public static generateTelemetryTick(prev: TelemetryReading, anomaly: string): TelemetryReading {
    const next = { ...prev };
    next.rpm = 3000 + (Math.random() - 0.5) * 50;
    
    if (anomaly === 'OVERHEAT') {
      next.temperatureC += 1.5;
    } else {
      next.temperatureC += (45 - next.temperatureC) * 0.05 + (Math.random() - 0.5);
    }
    
    if (anomaly === 'OVERPRESSURE') {
      next.pressureKPa += 50;
    } else {
      next.pressureKPa += (800 - next.pressureKPa) * 0.1 + (Math.random() - 0.5) * 10;
    }

    if (anomaly === 'BEARING_VIBRATION') {
      next.vibrationMmS += 1.2;
    } else {
      next.vibrationMmS = 2.0 + (Math.random() - 0.5);
    }

    next.currentAmp = 15.0 + (Math.random() - 0.5);
    next.flowLMin = 120.0 + (Math.random() - 0.5) * 2;
    
    return next;
  }

  public static evaluateHealth(telemetry: TelemetryReading): { healthScore: number, status: 'NOMINAL' | 'WARNING' | 'CRITICAL', newAlerts: DigitalTwinAlert[], cadColorHex: string } {
    let health = 100;
    let status: 'NOMINAL' | 'WARNING' | 'CRITICAL' = 'NOMINAL';
    const alerts: DigitalTwinAlert[] = [];

    if (telemetry.temperatureC > 85) {
      health -= 20;
      status = 'WARNING';
    }
    if (telemetry.temperatureC > 105) {
      health -= 40;
      status = 'CRITICAL';
      alerts.push({ id: `ALT-${Date.now()}`, severity: 'CRITICAL', timestamp: new Date().toISOString(), message: 'Thermal overload detected.' });
    }

    if (telemetry.pressureKPa > 950) {
      health -= 20;
      status = status === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
    }
    
    if (telemetry.vibrationMmS > 9) {
      health -= 25;
      status = 'CRITICAL';
      alerts.push({ id: `ALT-${Date.now()}-2`, severity: 'CRITICAL', timestamp: new Date().toISOString(), message: 'Severe vibration detected.' });
    }

    return {
      healthScore: Math.max(0, health),
      status,
      newAlerts: alerts,
      cadColorHex: status === 'CRITICAL' ? '#ef4444' : status === 'WARNING' ? '#f59e0b' : '#10b981'
    };
  }

  public static syncTelemetry(data: any) {
    return { status: 'SYNCED', timestamp: new Date().toISOString(), data };
  }
}

