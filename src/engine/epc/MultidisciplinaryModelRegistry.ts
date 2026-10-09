/**
 * SECP Industrial OS — EPC-006: Multidisciplinary Model Registry
 */

import { 
  MultidisciplinaryModel, 
  ModelType, 
  ModelLifecycleStatus, 
  CompatibilityStatus,
  ModelSnapshot,
  ModelRegistryIntegrityReport,
  CompatibilityValidation,
  ModelProvenance
} from './MultidisciplinaryModelTypes';
import { EngineeringHashChain } from '../evidence/EngineeringHashChain';
import { RequirementTraceabilityEngine } from './RequirementTraceabilityEngine';
import { ProductConfigurationData } from './ProductConfigurationTypes';

export class MultidisciplinaryModelRegistry {
  private readonly modelsMap: Map<string, MultidisciplinaryModel[]> = new Map();

  /**
   * Registers a new multidisciplinary model.
   */
  public registerModel(model: MultidisciplinaryModel): void {
    this.validateModelInput(model);

    const existingRevisions = this.modelsMap.get(model.modelId) || [];
    
    // Check if revision already exists
    if (existingRevisions.some(r => r.modelRevision === model.modelRevision)) {
      const existing = existingRevisions.find(r => r.modelRevision === model.modelRevision)!;
      // If released, prevent silent mutation
      if (existing.lifecycleStatus === 'RELEASED') {
        throw new Error(`Cannot mutate released model ${model.modelId} REV ${model.modelRevision}`);
      }
    }

    // Integrity check
    const computedHash = EngineeringHashChain.computeCanonicalHash(this.stripTransientFields(model)).canonicalHash;
    if (model.contentHash !== computedHash) {
      throw new Error(`Content hash mismatch for model ${model.modelId}. Provided: ${model.contentHash}, Computed: ${computedHash}`);
    }

    const revisions = [...existingRevisions.filter(r => r.modelRevision !== model.modelRevision), model];
    this.modelsMap.set(model.modelId, revisions);
  }

  /**
   * Retrieves a model by ID and optionally revision.
   */
  public getModel(modelId: string, revision?: string): MultidisciplinaryModel | undefined {
    const revisions = this.modelsMap.get(modelId);
    if (!revisions) return undefined;
    if (revision) return revisions.find(r => r.modelRevision === revision);
    // Return latest by default (simplified for registry logic)
    return revisions[revisions.length - 1];
  }

  /**
   * Gets all models for a specific configuration.
   */
  public getModelsByConfiguration(configurationId: string): MultidisciplinaryModel[] {
    const result: MultidisciplinaryModel[] = [];
    for (const revisions of this.modelsMap.values()) {
      for (const model of revisions) {
        if (model.configurationId === configurationId) {
          result.push(model);
        }
      }
    }
    return result;
  }

  /**
   * Validates compatibility between two models.
   */
  public validateCompatibility(modelA: MultidisciplinaryModel, modelB: MultidisciplinaryModel): CompatibilityValidation {
    // Check revision staleness first
    if (modelA.dependencyIds.includes(modelB.modelId)) {
      if (modelA.provenance.dependencies.includes(`${modelB.modelId}@${modelB.modelRevision}`)) {
        return {
          modelId: modelA.modelId,
          targetModelId: modelB.modelId,
          status: 'VALID'
        };
      } else {
        return {
          modelId: modelA.modelId,
          targetModelId: modelB.modelId,
          status: 'STALE',
          reason: `Model ${modelA.modelId} depends on a different revision of ${modelB.modelId}`
        };
      }
    }

    // Domain-specific rules
    if (modelA.modelType === ModelType.FEA && modelB.modelType === ModelType.CAD) {
      if (modelA.geometryReference && modelA.geometryReference !== modelB.artifactReference) {
        return {
          modelId: modelA.modelId,
          targetModelId: modelB.modelId,
          status: 'INCOMPATIBLE',
          reason: 'FEA geometry reference does not match CAD artifact reference'
        };
      }
    }

    return {
      modelId: modelA.modelId,
      targetModelId: modelB.modelId,
      status: 'UNKNOWN'
    };
  }

  /**
   * Detects configuration drift.
   */
  public detectDrift(configuration: ProductConfigurationData): string[] {
    const registryModels = this.getModelsByConfiguration(configuration.configurationId);
    const drift: string[] = [];

    // Compare with configuration baseline if available
    if (configuration.baseline) {
      const baseline = configuration.baseline;
      // CAD Drift
      const cadModel = registryModels.find(m => m.modelType === ModelType.CAD);
      if (cadModel && cadModel.contentHash !== baseline.cad.geometryHash) {
        drift.push('CAD Geometry Drift');
      }
      // Simulation Drift
      baseline.simulationModels.forEach(sim => {
        const model = registryModels.find(m => m.modelId === sim.modelId);
        if (!model) {
          drift.push(`Simulation Model ${sim.modelId} missing from registry`);
        } else if (model.modelRevision !== sim.revision) {
          drift.push(`Simulation Model ${sim.modelId} revision drift: expected ${sim.revision}, found ${model.modelRevision}`);
        }
      });
    }

    return drift;
  }

  /**
   * Generates a deterministic snapshot.
   */
  public createSnapshot(modelId: string, revision: string): ModelSnapshot {
    const model = this.getModel(modelId, revision);
    if (!model) throw new Error(`Model ${modelId} REV ${revision} not found`);

    const upstream = model.dependencyIds.map(id => {
      const dep = this.getModel(id);
      if (!dep) throw new Error(`Dependency ${id} for model ${modelId} not found`);
      return dep;
    });

    const downstream: MultidisciplinaryModel[] = [];
    for (const revisions of this.modelsMap.values()) {
      for (const m of revisions) {
        if (m.dependencyIds.includes(modelId)) {
          downstream.push(m);
        }
      }
    }

    const snapshotHash = EngineeringHashChain.computeCanonicalHash({
      model: this.stripTransientFields(model),
      upstream: upstream.map(u => this.stripTransientFields(u)),
      downstream: downstream.map(d => this.stripTransientFields(d))
    }).canonicalHash;

    return {
      model,
      upstreamDependencies: upstream,
      downstreamDependencies: downstream,
      snapshotHash,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validates registry integrity.
   */
  public validateRegistryIntegrity(): ModelRegistryIntegrityReport {
    const errors: string[] = [];
    const checks = {
      uniqueIdentity: true,
      validModelType: true,
      validRevision: true,
      validConfiguration: true,
      validDependencies: true,
      validHashes: true,
      noCycles: true
    };

    for (const [modelId, revisions] of this.modelsMap.entries()) {
      const seenRevisions = new Set<string>();
      for (const model of revisions) {
        // Unique identity and revision
        if (seenRevisions.has(model.modelRevision)) {
          checks.validRevision = false;
          errors.push(`Duplicate revision ${model.modelRevision} for model ${modelId}`);
        }
        seenRevisions.add(model.modelRevision);

        // Valid dependencies
        for (const depId of model.dependencyIds) {
          if (!this.modelsMap.has(depId)) {
            checks.validDependencies = false;
            errors.push(`Model ${modelId} depends on non-existent model ${depId}`);
          }
        }

        // Integrity hash
        const computedHash = EngineeringHashChain.computeCanonicalHash(this.stripTransientFields(model)).canonicalHash;
        if (model.contentHash !== computedHash) {
          checks.validHashes = false;
          errors.push(`Hash corruption detected in model ${modelId} REV ${model.modelRevision}`);
        }
      }
    }

    // Cycle detection
    if (this.hasCycles()) {
      checks.noCycles = false;
      errors.push('Circular dependencies detected in model registry');
    }

    return {
      valid: errors.length === 0,
      checks,
      errors
    };
  }

  private hasCycles(): boolean {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const check = (id: string): boolean => {
      visited.add(id);
      stack.add(id);

      const latest = this.getModel(id);
      if (latest) {
        for (const depId of latest.dependencyIds) {
          if (!visited.has(depId)) {
            if (check(depId)) return true;
          } else if (stack.has(depId)) {
            return true;
          }
        }
      }

      stack.delete(id);
      return false;
    };

    for (const id of this.modelsMap.keys()) {
      if (!visited.has(id)) {
        if (check(id)) return true;
      }
    }

    return false;
  }

  private validateModelInput(model: MultidisciplinaryModel): void {
    if (!model.modelId) throw new Error('Missing modelId');
    if (!model.modelType || !Object.values(ModelType).includes(model.modelType)) throw new Error('Invalid modelType');
    if (!model.modelRevision) throw new Error('Missing modelRevision');
    if (!model.configurationId) throw new Error('Missing configurationId');
  }

  private stripTransientFields(model: MultidisciplinaryModel): any {
    const { createdAt, createdBy, contentHash, provenance, ...rest } = model;
    return rest;
  }
}
