import { EngineeringAIModel, EngineeringAIModelStatus } from './types';
import { CanonicalAISerializer } from './CanonicalAISerializer';

export interface QualificationEvidence {
  validationScore: number; // e.g. R^2 or accuracy
  benchmarkPassed: boolean;
  physicsResidualOk: boolean;
  reproducibilityPassed: boolean;
}

export class EngineeringAIModelRegistry {
  private models: Map<string, EngineeringAIModel> = new Map();
  private deployments: Map<string, string> = new Map(); // modelId -> active version

  private getModelKey(modelId: string, version: string): string {
    return `${modelId}@${version}`;
  }

  public register(model: EngineeringAIModel): EngineeringAIModel {
    const key = this.getModelKey(model.modelId, model.version);
    if (this.models.has(key)) {
      throw new Error(`Model ${model.modelId} version ${model.version} already exists in registry.`);
    }

    // Ensure modelHash is computed correctly
    const computedHash = CanonicalAISerializer.computeModelHash(model);
    const registeredModel: EngineeringAIModel = {
      ...model,
      modelHash: computedHash
    };

    this.models.set(key, registeredModel);
    return registeredModel;
  }

  public get(modelId: string, version: string): EngineeringAIModel | undefined {
    return this.models.get(this.getModelKey(modelId, version));
  }

  public qualify(modelId: string, version: string, evidence: QualificationEvidence): EngineeringAIModel {
    const model = this.get(modelId, version);
    if (!model) {
      throw new Error(`Model ${modelId}@${version} not found.`);
    }

    if (!evidence.benchmarkPassed || !evidence.physicsResidualOk || !evidence.reproducibilityPassed || evidence.validationScore < 0.85) {
      throw new Error(`Qualification failed for ${modelId}@${version}: insufficient qualification evidence.`);
    }

    model.status = 'QUALIFIED';
    return model;
  }

  public activate(modelId: string, version: string): EngineeringAIModel {
    const model = this.get(modelId, version);
    if (!model) {
      throw new Error(`Model ${modelId}@${version} not found.`);
    }

    if (model.status !== 'QUALIFIED' && model.status !== 'DEPRECATED') {
      throw new Error(`Cannot activate model ${modelId}@${version} from status ${model.status}. Model must be QUALIFIED.`);
    }

    model.status = 'ACTIVE';
    this.deployments.set(modelId, version);
    return model;
  }

  public deprecate(modelId: string, version: string): EngineeringAIModel {
    const model = this.get(modelId, version);
    if (!model) throw new Error(`Model ${modelId}@${version} not found.`);
    model.status = 'DEPRECATED';
    return model;
  }

  public retire(modelId: string, version: string): EngineeringAIModel {
    const model = this.get(modelId, version);
    if (!model) throw new Error(`Model ${modelId}@${version} not found.`);
    model.status = 'RETIRED';
    return model;
  }

  public quarantine(modelId: string, version: string, reason: string): EngineeringAIModel {
    const model = this.get(modelId, version);
    if (!model) throw new Error(`Model ${modelId}@${version} not found.`);
    model.status = 'QUARANTINED';
    return model;
  }

  public verifyArtifact(modelId: string, version: string): boolean {
    const model = this.get(modelId, version);
    if (!model) return false;
    const computedHash = CanonicalAISerializer.computeModelHash(model);
    return computedHash === model.modelHash;
  }

  public isRegistered(modelId: string, version: string): boolean {
    return this.models.has(this.getModelKey(modelId, version));
  }

  public verifyModelIntegrity(model: EngineeringAIModel): { valid: boolean; details: string; computedModelHash: string } {
    const computedHash = CanonicalAISerializer.computeModelHash(model);
    if (computedHash !== model.modelHash) {
      return {
        valid: false,
        details: `MODEL_HASH_MISMATCH: Stored hash (${model.modelHash}) does not match computed hash (${computedHash})`,
        computedModelHash: computedHash
      };
    }
    return {
      valid: true,
      details: 'MODEL_INTEGRITY_VERIFIED',
      computedModelHash: computedHash
    };
  }

  public detectSubstitution(
    registeredModelId: string,
    version: string,
    candidateModel: EngineeringAIModel
  ): { isSubstituted: boolean; reason: string } {
    const registered = this.get(registeredModelId, version);
    if (!registered) {
      return { isSubstituted: true, reason: `MODEL_NOT_FOUND: ${registeredModelId}@${version} is not in registry` };
    }

    if (candidateModel.modelId !== registered.modelId) {
      return { isSubstituted: true, reason: `MODEL_ID_MISMATCH: expected ${registered.modelId}, got ${candidateModel.modelId}` };
    }

    if (candidateModel.version !== registered.version) {
      return { isSubstituted: true, reason: `VERSION_MISMATCH: expected ${registered.version}, got ${candidateModel.version}` };
    }

    const candidateComputedHash = CanonicalAISerializer.computeModelHash(candidateModel);
    if (candidateComputedHash !== registered.modelHash) {
      return {
        isSubstituted: true,
        reason: `MODEL_ARTIFACT_SUBSTITUTION: Candidate model hash (${candidateComputedHash}) does not match registered model hash (${registered.modelHash})`
      };
    }

    return { isSubstituted: false, reason: 'MODEL_IDENTITY_AUTHENTIC' };
  }

  public compareVersions(modelId: string, v1: string, v2: string) {
    const m1 = this.get(modelId, v1);
    const m2 = this.get(modelId, v2);

    if (!m1 || !m2) throw new Error(`Models for comparison not found: ${v1}, ${v2}`);

    return {
      modelId,
      v1,
      v2,
      hashMatch: m1.modelHash === m2.modelHash,
      statusV1: m1.status,
      statusV2: m2.status,
      architectureChanged: m1.architecture !== m2.architecture
    };
  }
}
