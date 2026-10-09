import { isAIActor } from '../p9/CommunicationGovernanceEngine';
import { SensorRegistry } from './SensorRegistry';
import { Sensor, CalibrationCertificate } from './types';

export class SensorGovernanceEngine {
  private registry: SensorRegistry;

  constructor(registry: SensorRegistry) {
    this.registry = registry;
  }

  /**
   * Enforces strict human engineering authorization boundaries.
   * AI cannot authorize, publish, or certify measurement calibration.
   */
  public authorizeCalibration(cert: CalibrationCertificate, actor: string): void {
    if (isAIActor(actor) || actor === 'AI_SYNTHETIC_AGENT') {
      throw new Error(
        `AI_GOVERNANCE_VIOLATION: AI agent '${actor}' is unauthorized to sign or authorize Calibration Certificates. Human validation required.`
      );
    }
    
    this.registry.registerCalibrationCertificate(cert);
  }

  /**
   * Prevents UI bypasses or unapproved direct modifications to Sensor model attributes.
   */
  public mutateSensorCanonicalState(params: {
    sensorId: string;
    newAccuracy: number;
    actor: string;
  }): void {
    if (isAIActor(params.actor) || params.actor === 'AI_SYNTHETIC_AGENT') {
      throw new Error(
        `AI_GOVERNANCE_VIOLATION: AI agent '${params.actor}' cannot directly mutate canonical sensor engineering properties.`
      );
    }

    const sensor = this.registry.getSensor(params.sensorId);
    if (!sensor) {
      throw new Error(`SENSOR_NOT_FOUND: Sensor '${params.sensorId}' does not exist.`);
    }

    // Prohibit direct mutation without proper engineering request or revision
    if (params.newAccuracy <= 0) {
      throw new Error(`INVALID_MUTATION: Accuracy bounds must be strictly positive.`);
    }

    sensor.accuracy = params.newAccuracy;
    sensor.provenance.updatedAt = new Date().toISOString();
  }
}
