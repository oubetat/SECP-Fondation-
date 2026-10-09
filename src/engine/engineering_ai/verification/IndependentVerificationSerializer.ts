import * as crypto from 'crypto';
import { EngineeringAIModel, EngineeringAIContext } from '../types';

/**
 * IndependentVerificationSerializer
 * 
 * Clean-room, dissimilar serialization and cryptographic digest implementation.
 * Engineered for M10.3 to eliminate Common-Mode Failures (CMF) with CanonicalAISerializer.
 * 
 * Strict invariants:
 * 1. Zero dependencies on CanonicalAISerializer.
 * 2. Strict numerical finiteness checks (rejects NaN, Infinity, -Infinity).
 * 3. Deterministic lexical sorting of UTF-8 keys at all object nesting depths.
 * 4. Distinct dissimilar salt/domain prefixing capability for tamper cross-checks.
 */
export class IndependentVerificationSerializer {
  private static readonly DIGEST_ALGORITHM = 'sha256';

  /**
   * Independent cryptographic SHA-256 digest calculation.
   */
  public static hash(data: string): string {
    return crypto.createHash(this.DIGEST_ALGORITHM).update(data, 'utf8').digest('hex');
  }

  /**
   * Dissimilar domain-separated digest to detect cross-protocol collisions.
   */
  public static dissimilarHash(data: string, domainTag: string = 'SECP_INDEPENDENT_VERIFIER_V1'): string {
    const prefixed = `${domainTag}::${data}`;
    return crypto.createHash(this.DIGEST_ALGORITHM).update(prefixed, 'utf8').digest('hex');
  }

  /**
   * Independent recursive JSON canonicalizer.
   * Guarantees strict lexical ordering of object keys and safe primitive normalization.
   */
  public static canonicalJson(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new Error(`INDEPENDENT_SERIALIZER_ERROR: Non-finite number encountered: ${value}`);
      }
      // Normalize -0 to 0
      return Object.is(value, -0) ? '0' : JSON.stringify(value);
    }

    if (typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return '[' + value.map((elem) => this.canonicalJson(elem)).join(',') + ']';
    }

    const sortedKeys = Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const entries = sortedKeys.map((key) => `${JSON.stringify(key)}:${this.canonicalJson(value[key])}`);
    return '{' + entries.join(',') + '}';
  }

  /**
   * Recomputes model weights hash independently.
   */
  public static computeWeightsHash(weights?: Record<string, number>, binaryHash?: string): string {
    if (binaryHash) {
      return this.hash(`BINARY_WEIGHTS:${binaryHash}`);
    }
    if (!weights || Object.keys(weights).length === 0) {
      return this.hash('EMPTY_WEIGHTS');
    }
    const sortedKeys = Object.keys(weights).sort();
    for (const key of sortedKeys) {
      if (!Number.isFinite(weights[key])) {
        throw new Error(`INDEPENDENT_SERIALIZER_ERROR: Weight '${key}' has non-finite value: ${weights[key]}`);
      }
    }
    const sortedStr = sortedKeys.map((k) => `${k}:${weights[k]}`).join(',');
    return this.hash(`FLOAT_WEIGHTS:${sortedStr}`);
  }

  /**
   * Recomputes configuration hash independently.
   */
  public static computeConfigurationHash(config?: Record<string, any>, inputContract?: any, outputContract?: any): string {
    const cConfig = this.canonicalJson(config || {});
    const cIn = this.canonicalJson(inputContract || {});
    const cOut = this.canonicalJson(outputContract || {});
    return this.hash(`CONFIG|${cConfig}|IN:${cIn}|OUT:${cOut}`);
  }

  /**
   * Recomputes model hash independently from model entity attributes.
   */
  public static computeModelHash(model: Partial<EngineeringAIModel>): string {
    const sortedWeightsStr = model.weights
      ? Object.keys(model.weights)
          .sort()
          .map((k) => `${k}:${model.weights![k]}`)
          .join(',')
      : (model.weightsHash || '');

    const configStr = model.configuration
      ? this.canonicalJson(model.configuration)
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

    return this.hash(payload);
  }

  /**
   * Recomputes context hash independently from raw context entity attributes.
   */
  public static computeContextHash(ctx: Omit<EngineeringAIContext, 'contextHash'>): string {
    const sortAndStr = (obj: Record<string, any>) =>
      Object.keys(obj || {})
        .sort()
        .map((k) => `${k}:${this.canonicalJson(obj[k])}`)
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

    return this.hash(payload);
  }

  /**
   * Recomputes input hash independently.
   */
  public static computeInputHash(inputs: Record<string, any>, units: Record<string, string>): string {
    const sortedKeys = Object.keys(inputs || {}).sort();
    const str = sortedKeys.map((k) => `${k}:${inputs[k]}@${units[k] || 'UNKNOWN'}`).join(';');
    return this.hash(str);
  }

  /**
   * Recomputes output hash independently.
   */
  public static computeOutputHash(prediction: any, uncertaintyValue: number): string {
    if (!Number.isFinite(uncertaintyValue)) {
      throw new Error(`INDEPENDENT_SERIALIZER_ERROR: Uncertainty value is non-finite: ${uncertaintyValue}`);
    }
    return this.hash(`${JSON.stringify(prediction)}|UNCERTAINTY:${uncertaintyValue}`);
  }

  /**
   * Recomputes execution hash independently.
   */
  public static computeExecutionHash(
    modelHash: string,
    contextHash: string,
    inputHash: string,
    outputHash: string,
    seed?: number
  ): string {
    return this.hash(`EXEC|${modelHash}|${contextHash}|${inputHash}|${outputHash}|SEED:${seed ?? 'NONE'}`);
  }

  /**
   * Recomputes provenance hash independently.
   */
  public static computeProvenanceHash(provenance: Record<string, any>): string {
    return this.hash(`PROVENANCE|${this.canonicalJson(provenance)}`);
  }
}
