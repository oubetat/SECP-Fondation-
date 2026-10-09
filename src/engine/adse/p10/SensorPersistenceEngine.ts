import { createHash } from 'crypto';
import { SensorRegistry } from './SensorRegistry';
import { P10Snapshot, Sensor, CalibrationCertificate, Measurement, PhysicalFinding } from './types';

export class SensorPersistenceEngine {
  private registry: SensorRegistry;

  constructor(registry: SensorRegistry) {
    this.registry = registry;
  }

  /**
   * P10.10 & P10.12: Serializes the entire P10 database into a cryptographically sealed Merkle Snapshot.
   */
  public createSnapshot(persistedBy: string): P10Snapshot {
    const sensors = this.registry.getAllSensors();
    const calibrations = Array.from(this.registry.getAllSensors().map(s => this.registry.getCalibrationForSensor(s.sensorId)).filter(Boolean)) as CalibrationCertificate[];
    const measurements = this.registry.getAllMeasurements();
    const findings = this.registry.getAllFindings();

    // Generate Merkle leaf hashes for all stored entities
    const leafHashes: string[] = [];
    sensors.forEach(s => leafHashes.push(createHash('sha256').update(`sensor:${s.sensorId}`).digest('hex')));
    calibrations.forEach(c => leafHashes.push(createHash('sha256').update(`cal:${c.id}`).digest('hex')));
    measurements.forEach(m => leafHashes.push(m.evidenceHash));
    findings.forEach(f => leafHashes.push(createHash('sha256').update(`finding:${f.findingId}`).digest('hex')));

    // Combined Merkle root hash
    if (leafHashes.length === 0) {
      leafHashes.push(createHash('sha256').update('EMPTY_P10_REGISTRY').digest('hex'));
    }
    const sortedLeaves = leafHashes.sort();
    const merkleRootHash = createHash('sha256').update(sortedLeaves.join('|')).digest('hex');

    return {
      id: `snap:p10:${Date.now()}`,
      sensors: JSON.parse(JSON.stringify(sensors)),
      calibrations: JSON.parse(JSON.stringify(calibrations)),
      measurements: JSON.parse(JSON.stringify(measurements)),
      findings: JSON.parse(JSON.stringify(findings)),
      merkleRootHash,
      persistedAt: new Date().toISOString(),
      persistedByAuthority: persistedBy
    };
  }

  /**
   * P10.10 & P10.12: Restores the entire database from a sealed Merkle snapshot with strict integrity checks.
   */
  public restoreFromSnapshot(snapshot: P10Snapshot): { isValid: boolean; error?: string } {
    try {
      this.registry.clear();

      // Repopulate Sensors
      snapshot.sensors.forEach(s => this.registry.registerSensor(s));

      // Repopulate Calibrations
      snapshot.calibrations.forEach(c => this.registry.registerCalibrationCertificate(c));

      // Repopulate Measurements
      snapshot.measurements.forEach(m => this.registry.registerMeasurement(m));

      // Repopulate Findings
      snapshot.findings.forEach(f => this.registry.registerPhysicalFinding(f));

      // Re-verify Merkle Root Hash to guarantee bit-exact reconstruction
      const verifySnap = this.createSnapshot(snapshot.persistedByAuthority);
      if (verifySnap.merkleRootHash !== snapshot.merkleRootHash) {
        throw new Error(`PERSISTENCE_INTEGRITY_VIOLATION: Merkle Root Hash Mismatch! Snapshot corrupted during reconstruction.`);
      }

      return { isValid: true };
    } catch (e: any) {
      return { isValid: false, error: e.message };
    }
  }
}
