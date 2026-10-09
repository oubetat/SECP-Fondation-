import { createHash } from 'crypto';
import { FailureMode, Cause, FaultTree, ReliabilityModel, FailureGovernanceState } from './types';

export class FailureRegistry {
  private failureModes: Map<string, FailureMode> = new Map();
  private faultTrees: Map<string, FaultTree> = new Map();
  private reliabilityModels: Map<string, ReliabilityModel> = new Map();

  // --- Failure Mode Management ---
  public registerFailureMode(fm: FailureMode): void {
    if (this.failureModes.has(fm.failureModeId)) {
      throw new Error(`DUPLICATE_FAILURE_MODE: Failure mode '${fm.failureModeId}' already exists.`);
    }
    if (!fm.failureModeId || fm.failureModeId.startsWith('FORGED') || fm.failureModeId.includes('FAKE')) {
      throw new Error(`INVALID_IDENTITY: Failure Mode ID '${fm.failureModeId}' is invalid or unverified.`);
    }
    if (!fm.elementId) {
      throw new Error(`UNBOUND_ELEMENT: Failure mode must be bound to a canonical element ID.`);
    }
    if (!fm.configurationId) {
      throw new Error(`CONFIGURATION_CONTEXT_REQUIRED: Failure mode is missing configuration scope.`);
    }

    // Bounds Validation for RPN inputs (1 to 10)
    if (fm.severity < 1 || fm.severity > 10 || fm.occurrence < 1 || fm.occurrence > 10 || fm.detectability < 1 || fm.detectability > 10) {
      throw new Error(`INVALID_RPN_BOUNDS: Severity, Occurrence, and Detectability must be integers between 1 and 10.`);
    }

    // Authoritative calculation of Criticality
    fm.criticality = fm.severity * fm.occurrence;

    this.failureModes.set(fm.failureModeId, fm);
  }

  public getFailureMode(fmId: string): FailureMode | undefined {
    return this.failureModes.get(fmId);
  }

  public getAllFailureModes(): FailureMode[] {
    return Array.from(this.failureModes.values());
  }

  // --- Fault Tree Management ---
  public registerFaultTree(ft: FaultTree): void {
    if (this.faultTrees.has(ft.treeId)) {
      throw new Error(`DUPLICATE_FAULT_TREE: Fault Tree '${ft.treeId}' already exists.`);
    }
    if (!ft.treeId || ft.treeId.startsWith('FORGED')) {
      throw new Error(`INVALID_IDENTITY: Fault Tree ID '${ft.treeId}' is invalid.`);
    }
    if (!ft.configurationId) {
      throw new Error(`CONFIGURATION_CONTEXT_REQUIRED: Fault Tree is missing configuration scope.`);
    }

    // Detect circular dependency in gates
    this.detectCircularDependencies(ft);

    this.faultTrees.set(ft.treeId, ft);
  }

  public getFaultTree(treeId: string): FaultTree | undefined {
    return this.faultTrees.get(treeId);
  }

  public getAllFaultTrees(): FaultTree[] {
    return Array.from(this.faultTrees.values());
  }

  private detectCircularDependencies(ft: FaultTree): void {
    const adj = new Map<string, string[]>();
    // FTA gate output depends on its input events
    for (const gate of ft.gates) {
      adj.set(gate.outputEventId, gate.inputEventIds);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (eventId: string): boolean => {
      visited.add(eventId);
      recStack.add(eventId);

      const neighbors = adj.get(eventId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true; // Cycle detected
        }
      }

      recStack.delete(eventId);
      return false;
    };

    const allOutputEvents = ft.gates.map(g => g.outputEventId);
    for (const eventId of allOutputEvents) {
      if (!visited.has(eventId)) {
        if (dfs(eventId)) {
          throw new Error(`CIRCULAR_DEPENDENCY_DETECTED: Loop found in Fault Tree gates involving event '${eventId}'.`);
        }
      }
    }
  }

  // --- Reliability Model Management ---
  public registerReliabilityModel(model: ReliabilityModel): void {
    if (this.reliabilityModels.has(model.modelId)) {
      throw new Error(`DUPLICATE_RELIABILITY_MODEL: Reliability Model '${model.modelId}' already exists.`);
    }
    if (model.MTBFHours < 0 || model.MTTRHours < 0) {
      throw new Error(`INVALID_RELIABILITY_INPUTS: MTBF and MTTR hours cannot be negative.`);
    }

    // Enforce math constraints for availability: Availability = MTBF / (MTBF + MTTR)
    const expectedAvail = model.MTBFHours === 0 && model.MTTRHours === 0 
      ? 0 
      : model.MTBFHours / (model.MTBFHours + model.MTTRHours);
    
    if (Math.abs(model.availability - expectedAvail) > 1e-4) {
      throw new Error(`INVALID_AVAILABILITY_CALCULATION: Expected availability is ${expectedAvail}, received ${model.availability}.`);
    }

    this.reliabilityModels.set(model.modelId, model);
  }

  public getReliabilityModel(modelId: string): ReliabilityModel | undefined {
    return this.reliabilityModels.get(modelId);
  }

  public getAllReliabilityModels(): ReliabilityModel[] {
    return Array.from(this.reliabilityModels.values());
  }

  // --- Contextual Queries (Gate 06/07) ---
  public getFailureModesByContext(revisionId: string, configurationId: string): FailureMode[] {
    return Array.from(this.failureModes.values()).filter(fm => 
      fm.revisionId === revisionId && fm.configurationId === configurationId
    );
  }

  public getFaultTreesByContext(revisionId: string, configurationId: string): FaultTree[] {
    return Array.from(this.faultTrees.values()).filter(ft => 
      ft.revisionId === revisionId && ft.configurationId === configurationId
    );
  }

  public getReliabilityModelsByContext(revisionId: string, configurationId: string): ReliabilityModel[] {
    return Array.from(this.reliabilityModels.values()).filter(rm => 
      rm.revisionId === revisionId && rm.configurationId === configurationId
    );
  }

  public clear(): void {
    this.failureModes.clear();
    this.faultTrees.clear();
    this.reliabilityModels.clear();
  }
}
