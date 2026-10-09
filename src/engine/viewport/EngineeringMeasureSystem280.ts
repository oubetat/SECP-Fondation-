import { MeasurementState280, MeasurementResult280, MeasurementType280 } from './MeasurementTypes280';
import { PersistentEntityId } from './ViewportTypes276';

export class EngineeringMeasureSystem {
  private state: MeasurementState280;

  constructor(revision: string) {
    this.state = {
      activeMeasurements: [],
      selectedType: 'DISTANCE',
      unitSystem: 'METRIC',
      precision: 3,
      modelRevision: revision
    };
  }

  public getState(): MeasurementState280 {
    return this.state;
  }

  public measure(type: MeasurementType280, entities: PersistentEntityId[]) {
    // Stub
  }

  public removeMeasurement(id: string) {
    // Stub
  }

  public clearAll() {
    // Stub
  }
}
