import { SensorRegistry } from './SensorRegistry';
import { MeasurementEngine } from './MeasurementEngine';
import { SensorGovernanceEngine } from './SensorGovernanceEngine';
import { SensorPersistenceEngine } from './SensorPersistenceEngine';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { DigitalThreadRegistry } from '../p4/DigitalThreadRegistry';

export class ADSEP10Engine {
  private static instance: ADSEP10Engine | null = null;

  public registry: SensorRegistry;
  public measurement: MeasurementEngine;
  public governance: SensorGovernanceEngine;
  public persistence: SensorPersistenceEngine;

  constructor(revisionEngine: RevisionEngine, digitalThread: DigitalThreadRegistry) {
    this.registry = new SensorRegistry();
    this.measurement = new MeasurementEngine(this.registry, digitalThread);
    this.governance = new SensorGovernanceEngine(this.registry);
    this.persistence = new SensorPersistenceEngine(this.registry);
  }

  public static getInstance(revisionEngine: RevisionEngine, digitalThread: DigitalThreadRegistry): ADSEP10Engine {
    if (!this.instance) {
      this.instance = new ADSEP10Engine(revisionEngine, digitalThread);
    }
    return this.instance;
  }

  public static resetInstance(): void {
    this.instance = null;
  }
}
