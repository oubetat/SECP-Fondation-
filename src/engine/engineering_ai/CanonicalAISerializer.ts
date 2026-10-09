import * as crypto from 'crypto';
import { EngineeringAIModel, EngineeringAIContext, FeatureVector } from './types';

export class CanonicalAISerializer {
  public static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  /**
   * Deterministic recursive JSON canonicalizer.
   * Guarantees identical byte output regardless of object key insertion order at any depth.
   */
  public static canonicalJson(val: any): string {
    if (val === null || val === undefined) return 'null';
    if (typeof val !== 'object') return JSON.stringify(val);
    if (Array.isArray(val)) {
      return '[' + val.map((v) => CanonicalAISerializer.canonicalJson(v)).join(',') + ']';
    }
    const keys = Object.keys(val).sort();
    return '{' + keys.map((k) => `${JSON.stringify(k)}:${CanonicalAISerializer.canonicalJson(val[k])}`).join(',') + '}';
  }

  public static computeWeightsHash(weights?: Record<string, number>, binaryHash?: string): string {
    if (binaryHash) return this.sha256(`BINARY_WEIGHTS:${binaryHash}`);
    if (!weights) return this.sha256('EMPTY_WEIGHTS');
    const sortedStr = Object.keys(weights)
      .sort()
      .map((k) => `${k}:${weights[k]}`)
      .join(',');
    return this.sha256(`FLOAT_WEIGHTS:${sortedStr}`);
  }

  public static computeConfigurationHash(config?: Record<string, any>, inputContract?: any, outputContract?: any): string {
    const canonicalConfig = CanonicalAISerializer.canonicalJson(config || {});
    const canonicalIn = CanonicalAISerializer.canonicalJson(inputContract || {});
    const canonicalOut = CanonicalAISerializer.canonicalJson(outputContract || {});
    return this.sha256(`CONFIG|${canonicalConfig}|IN:${canonicalIn}|OUT:${canonicalOut}`);
  }

  public static computeModelHash(model: Partial<EngineeringAIModel>): string {
    const sortedWeightsStr = model.weights
      ? Object.keys(model.weights)
          .sort()
          .map((k) => `${k}:${model.weights![k]}`)
          .join(',')
      : (model.weightsHash || '');

    const configStr = model.configuration
      ? CanonicalAISerializer.canonicalJson(model.configuration)
      : (model.configurationHash || '');

    const binaryStr = model.modelBinaryHash || '';

    const payload = [
      model.modelId,
      model.modelName,
      model.modelType,
      model.version,
      model.architecture,
      model.trainingDatasetId,
      model.parameterHash || '',
      sortedWeightsStr,
      configStr,
      binaryStr
    ].join('|');

    return this.sha256(payload);
  }

  public static computeContextHash(ctx: Omit<EngineeringAIContext, 'contextHash'>): string {
    const sortAndStr = (obj: Record<string, any>) =>
      Object.keys(obj || {})
        .sort()
        .map((k) => `${k}:${CanonicalAISerializer.canonicalJson(obj[k])}`)
        .join(',');

    const payload = [
      ctx.contextId,
      sortAndStr(ctx.geometryState),
      sortAndStr(ctx.materialState),
      sortAndStr(ctx.physicsState),
      sortAndStr(ctx.manufacturingState),
      sortAndStr(ctx.assemblyState),
      sortAndStr(ctx.telemetryState),
      sortAndStr(ctx.configurationState),
      ctx.evidenceSnapshotHash
    ].join('||');

    return this.sha256(payload);
  }

  public static computeInputHash(inputs: Record<string, any>, units: Record<string, string>): string {
    const sortedKeys = Object.keys(inputs || {}).sort();
    const str = sortedKeys.map((k) => `${k}:${inputs[k]}@${units[k] || 'UNKNOWN'}`).join(';');
    return this.sha256(str);
  }

  public static computeFeatureHash(features: Record<string, number>): string {
    const sortedKeys = Object.keys(features || {}).sort();
    const str = sortedKeys.map((k) => `${k}:${features[k]}`).join(';');
    return this.sha256(str);
  }

  public static computeOutputHash(prediction: any, uncertaintyValue: number): string {
    return this.sha256(`${JSON.stringify(prediction)}|UNCERTAINTY:${uncertaintyValue}`);
  }

  public static computeExecutionHash(
    modelHash: string,
    contextHash: string,
    inputHash: string,
    outputHash: string,
    seed?: number
  ): string {
    return this.sha256(`EXEC|${modelHash}|${contextHash}|${inputHash}|${outputHash}|SEED:${seed ?? 'NONE'}`);
  }

  public static computeCompositeInferenceIdentity(
    modelHash: string,
    contextHash: string,
    inputHash: string,
    outputHash: string,
    seed?: number
  ): string {
    return this.computeExecutionHash(modelHash, contextHash, inputHash, outputHash, seed);
  }

  public static computeProvenanceHash(provenance: Record<string, any>): string {
    return this.sha256(`PROVENANCE|${CanonicalAISerializer.canonicalJson(provenance)}`);
  }
}
