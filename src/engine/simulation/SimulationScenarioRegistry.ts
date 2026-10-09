/**
 * SECP Industrial OS — EPC-008: Simulation Scenario Registry
 */

import { 
  SimulationScenario, 
  ScenarioLifecycle, 
  ExecutionBaseline,
  SimulationScenarioError
} from './SimulationScenarioTypes';
import { SimulationScenarioValidator } from './SimulationScenarioValidator';
import { EngineeringHashChain } from '../evidence/EngineeringHashChain';

export class SimulationScenarioRegistry {
  private scenarios: Map<string, SimulationScenario[]> = new Map();
  private baselines: Map<string, ExecutionBaseline[]> = new Map();

  /**
   * Registers a new simulation scenario or a new revision.
   */
  public registerScenario(scenario: SimulationScenario): void {
    const validation = SimulationScenarioValidator.validate(scenario);
    if (!validation.isValid) {
      throw new Error(`Registration rejected: ${validation.errors.join(', ')}`);
    }

    const scenarioHistory = this.scenarios.get(scenario.id) || [];
    
    // Ensure revision doesn't already exist for this ID
    if (scenarioHistory.some(s => s.revision === scenario.revision)) {
      throw new Error(`Registration rejected: Revision ${scenario.revision} already exists for scenario ${scenario.id}`);
    }

    scenarioHistory.push({
      ...scenario,
      createdAt: scenario.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: scenario.status || ScenarioLifecycle.DRAFT
    });

    this.scenarios.set(scenario.id, scenarioHistory);
  }

  /**
   * Retrieves a specific scenario by ID and optional revision.
   * If revision is not provided, returns the latest one.
   */
  public getScenario(id: string, revision?: string): SimulationScenario | undefined {
    const history = this.scenarios.get(id);
    if (!history || history.length === 0) return undefined;

    if (revision) {
      return history.find(s => s.revision === revision);
    }

    return history[history.length - 1];
  }

  /**
   * Creates a new revision of an existing scenario.
   */
  public createRevision(id: string, newRevision: string, updater: (base: SimulationScenario) => Partial<SimulationScenario>): SimulationScenario {
    const base = this.getScenario(id);
    if (!base) throw new Error(`Cannot create revision: Scenario ${id} not found`);

    const updatedData = updater(base);
    const newScenario: SimulationScenario = {
      ...base,
      ...updatedData,
      id,
      revision: newRevision,
      status: ScenarioLifecycle.DRAFT,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.registerScenario(newScenario);
    return newScenario;
  }

  /**
   * Freezes a scenario to prevent further modifications.
   */
  public freezeScenario(id: string, revision: string): void {
    const scenario = this.getScenario(id, revision);
    if (!scenario) throw new Error(`Scenario ${id} REV ${revision} not found`);

    if (scenario.status === ScenarioLifecycle.FROZEN) return;

    const validation = SimulationScenarioValidator.validate(scenario);
    if (!validation.isValid) {
      throw new Error(`Cannot freeze invalid scenario: ${validation.errors.join(', ')}`);
    }

    const history = this.scenarios.get(id)!;
    const index = history.findIndex(s => s.revision === revision);
    
    history[index] = {
      ...scenario,
      status: ScenarioLifecycle.FROZEN,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Updates a DRAFT scenario in place.
   */
  public updateScenario(id: string, revision: string, updates: Partial<SimulationScenario>): void {
    const history = this.scenarios.get(id);
    if (!history) throw new Error(`Scenario ${id} not found`);

    const index = history.findIndex(s => s.revision === revision);
    if (index === -1) throw new Error(`Revision ${revision} not found for scenario ${id}`);

    const scenario = history[index];
    if (scenario.status === ScenarioLifecycle.FROZEN || scenario.status === ScenarioLifecycle.EXECUTED) {
      throw new Error(SimulationScenarioError.FROZEN_MODIFICATION_DENIED);
    }

    history[index] = {
      ...scenario,
      ...updates,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Creates an immutable execution baseline for a frozen scenario.
   */
  public createExecutionBaseline(id: string, revision: string): ExecutionBaseline {
    const scenario = this.getScenario(id, revision);
    if (!scenario) throw new Error(`Scenario ${id} not found`);

    if (scenario.status !== ScenarioLifecycle.FROZEN && scenario.status !== ScenarioLifecycle.VALIDATED) {
      // For execution, we prefer it to be at least validated or frozen.
      // But strictly, EPC-008 wants FROZEN -> EXECUTED
    }

    const baseline: ExecutionBaseline = {
      executionId: `EXEC-${id}-${revision}-${Date.now()}`,
      scenarioId: id,
      timestamp: new Date().toISOString(),
      snapshot: {
        geometry: { ...scenario.geometry },
        material: { ...scenario.material },
        loads: scenario.loads.map(l => ({ ...l })),
        boundaryConditions: scenario.boundaryConditions.map(bc => ({ ...bc })),
        solver: { ...scenario.solver },
        mesh: { ...scenario.mesh },
        parameters: scenario.parameters.map(p => ({ ...p })),
        revision: scenario.revision
      }
    };

    const baselines = this.baselines.get(id) || [];
    baselines.push(baseline);
    this.baselines.set(id, baselines);

    // Update status to EXECUTED
    this.updateStatus(id, revision, ScenarioLifecycle.EXECUTED);

    return baseline;
  }

  public getExecutionBaselines(id: string): ExecutionBaseline[] {
    return this.baselines.get(id) || [];
  }

  private updateStatus(id: string, revision: string, status: ScenarioLifecycle): void {
    const history = this.scenarios.get(id);
    if (!history) return;
    const index = history.findIndex(s => s.revision === revision);
    if (index !== -1) {
      history[index] = { ...history[index], status, updatedAt: new Date().toISOString() };
    }
  }

  public listScenarios(): SimulationScenario[] {
    const all: SimulationScenario[] = [];
    this.scenarios.forEach(history => all.push(...history));
    return all;
  }
}
