import { MaterialStateData, MaterialStatus } from "./types";
import { MaterialStateHasher } from "./MaterialStateHasher";

export class MaterialState implements MaterialStateData {
  stress: number[];
  totalStrain: number[];
  elasticStrain: number[];
  plasticStrain: number[];
  equivalentPlasticStrain: number;
  plasticDissipation: number;
  elasticEnergy: number;
  internalVariables: Record<string, number>;
  materialStatus: MaterialStatus;
  stepId: number;
  incrementId: number;
  stateHash?: string;
  version: string;

  constructor(data: MaterialStateData) {
    this.stress = [...data.stress];
    this.totalStrain = [...data.totalStrain];
    this.elasticStrain = [...data.elasticStrain];
    this.plasticStrain = [...data.plasticStrain];
    this.equivalentPlasticStrain = data.equivalentPlasticStrain;
    this.plasticDissipation = data.plasticDissipation;
    this.elasticEnergy = data.elasticEnergy;
    this.internalVariables = { ...(data.internalVariables || {}) };
    this.materialStatus = data.materialStatus;
    this.stepId = data.stepId;
    this.incrementId = data.incrementId;
    this.version = data.version || "2.0.0";
    this.stateHash = data.stateHash || MaterialStateHasher.hashState(this);
  }

  static createInitial(dim: number = 6, stepId: number = 0, incrementId: number = 0): MaterialState {
    const data: MaterialStateData = {
      stress: new Array(dim).fill(0),
      totalStrain: new Array(dim).fill(0),
      elasticStrain: new Array(dim).fill(0),
      plasticStrain: new Array(dim).fill(0),
      equivalentPlasticStrain: 0.0,
      plasticDissipation: 0.0,
      elasticEnergy: 0.0,
      internalVariables: { backstress_norm: 0.0, yield_radius: 0.0 },
      materialStatus: 'ELASTIC',
      stepId,
      incrementId,
      version: "2.0.0"
    };
    return new MaterialState(data);
  }

  clone(): MaterialState {
    const data: MaterialStateData = {
      stress: [...this.stress],
      totalStrain: [...this.totalStrain],
      elasticStrain: [...this.elasticStrain],
      plasticStrain: [...this.plasticStrain],
      equivalentPlasticStrain: this.equivalentPlasticStrain,
      plasticDissipation: this.plasticDissipation,
      elasticEnergy: this.elasticEnergy,
      internalVariables: { ...this.internalVariables },
      materialStatus: this.materialStatus,
      stepId: this.stepId,
      incrementId: this.incrementId,
      stateHash: this.stateHash,
      version: this.version
    };
    return new MaterialState(data);
  }

  updateHash(): string {
    this.stateHash = MaterialStateHasher.hashState(this);
    return this.stateHash;
  }
}

export class MaterialPoint {
  readonly elementId: string;
  readonly pointIndex: number;
  readonly coordinates: number[];
  readonly weight: number;
  readonly detJ: number;

  private committedState: MaterialState;
  private trialState: MaterialState;
  private history: MaterialState[] = [];

  constructor(
    elementId: string,
    pointIndex: number,
    coordinates: number[],
    weight: number,
    detJ: number,
    initialState: MaterialState
  ) {
    this.elementId = elementId;
    this.pointIndex = pointIndex;
    this.coordinates = [...coordinates];
    this.weight = weight;
    this.detJ = detJ;
    this.committedState = initialState.clone();
    this.trialState = initialState.clone();
    this.history.push(this.committedState.clone());
  }

  getCommittedState(): Readonly<MaterialState> {
    return this.committedState;
  }

  getTrialState(): Readonly<MaterialState> {
    return this.trialState;
  }

  setTrialState(state: MaterialState): void {
    this.trialState = state.clone();
    this.trialState.updateHash();
  }

  commit(): void {
    this.committedState = this.trialState.clone();
    this.committedState.updateHash();
    this.history.push(this.committedState.clone());
  }

  revert(): void {
    this.trialState = this.committedState.clone();
    this.trialState.updateHash();
  }

  getHistory(): ReadonlyArray<MaterialState> {
    return this.history;
  }

  /**
   * Verifies complete isolation — returns a deep clone ensuring no shared mutable state.
   */
  isolate(): MaterialPoint {
    const point = new MaterialPoint(
      this.elementId,
      this.pointIndex,
      [...this.coordinates],
      this.weight,
      this.detJ,
      this.committedState.clone()
    );
    point.trialState = this.trialState.clone();
    return point;
  }
}
