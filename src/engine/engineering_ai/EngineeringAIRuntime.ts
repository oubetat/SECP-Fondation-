import {
  EngineeringAIModel,
  EngineeringAIContext,
  AIInferenceRecord,
  AIUncertainty,
  AIGuardrailVerdict,
  OODStatus
} from './types';
import { CanonicalAISerializer } from './CanonicalAISerializer';
import { EngineeringAIGuardrailEngine } from './EngineeringAIGuardrailEngine';
import { TwinEvidenceGraphEngine } from '../twin_evidence/TwinEvidenceGraphEngine';

export interface InferenceOptions {
  model: EngineeringAIModel;
  context: EngineeringAIContext;
  inputs: Record<string, any>;
  units: Record<string, string>;
  determinism?: 'DETERMINISTIC' | 'NON_DETERMINISTIC';
  seed?: number;
  physicsEvaluator?: (inputs: Record<string, any>, prediction: number) => boolean;
  evidenceEngine?: TwinEvidenceGraphEngine;
}

export class EngineeringAIRuntime {
  private static runtimeVersion = 'SECP-AI-RUNTIME-v2.1';

  public static executeInference(options: InferenceOptions): AIInferenceRecord {
    const { model, context, inputs, units, determinism = 'DETERMINISTIC', seed = 42, evidenceEngine } = options;

    // 1. Guardrail Check
    const guardrail = EngineeringAIGuardrailEngine.evaluateGuardrails(model, context, inputs, units);

    if (guardrail.verdict === 'MODEL_NOT_QUALIFIED' || guardrail.verdict === 'REJECTED') {
      const uncertaintyValue = 1.0;
      const inputHash = CanonicalAISerializer.computeInputHash(inputs, units);
      const outputHash = CanonicalAISerializer.computeOutputHash(0, uncertaintyValue);
      const executionHash = CanonicalAISerializer.computeExecutionHash(model.modelHash, context.contextHash, inputHash, outputHash, seed);

      return {
        inferenceId: `INF-REJECTED-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        modelId: model.modelId,
        modelVersion: model.version,
        contextHash: context.contextHash,
        inputHash,
        featureHash: CanonicalAISerializer.computeFeatureHash({}),
        outputHash,
        executionHash,
        timestamp: new Date().toISOString(),
        runtimeVersion: this.runtimeVersion,
        status: 'REJECTED',
        determinism,
        seed,
        inputs,
        prediction: 0,
        uncertainty: { type: 'MODEL', value: uncertaintyValue, confidenceInterval: [0, 0] },
        oodStatus: guardrail.oodStatus,
        guardrailVerdict: guardrail.verdict
      };
    }

    if (guardrail.verdict === 'OUT_OF_DOMAIN') {
      const uncertaintyValue = 0.95;
      const inputHash = CanonicalAISerializer.computeInputHash(inputs, units);
      const outputHash = CanonicalAISerializer.computeOutputHash(0, uncertaintyValue);
      const executionHash = CanonicalAISerializer.computeExecutionHash(model.modelHash, context.contextHash, inputHash, outputHash, seed);

      return {
        inferenceId: `INF-OOD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        modelId: model.modelId,
        modelVersion: model.version,
        contextHash: context.contextHash,
        inputHash,
        featureHash: CanonicalAISerializer.computeFeatureHash({}),
        outputHash,
        executionHash,
        timestamp: new Date().toISOString(),
        runtimeVersion: this.runtimeVersion,
        status: 'OOD',
        determinism,
        seed,
        inputs,
        prediction: 0,
        uncertainty: { type: 'EPISTEMIC', value: uncertaintyValue, confidenceInterval: [0, 0] },
        oodStatus: guardrail.oodStatus,
        guardrailVerdict: guardrail.verdict
      };
    }

    // 2. Perform Model Prediction (Simulated surrogate based on weights + seed for deterministic reproducibility)
    let predictionVal = 0;
    const sortedKeys = Object.keys(inputs).sort();

    if (determinism === 'DETERMINISTIC') {
      // Deterministic evaluation formula using model weights and seed
      let sum = (seed % 100) * 0.01;
      for (const key of sortedKeys) {
        const val = typeof inputs[key] === 'number' ? inputs[key] : 1;
        const w = model.weights[key] !== undefined ? model.weights[key] : 1.0;
        sum += val * w;
      }
      predictionVal = sum;
    } else {
      // Non-deterministic execution
      predictionVal = Math.random() * 100;
    }

    // 3. Physics Constraints Check on Output
    if (options.physicsEvaluator) {
      const physicsOk = options.physicsEvaluator(inputs, predictionVal);
      if (!physicsOk) {
        const inputHash = CanonicalAISerializer.computeInputHash(inputs, units);
        const outputHash = CanonicalAISerializer.computeOutputHash(predictionVal, 0.8);
        const executionHash = CanonicalAISerializer.computeExecutionHash(model.modelHash, context.contextHash, inputHash, outputHash, seed);

        return {
          inferenceId: `INF-PHYSICS-FAIL-${Date.now()}`,
          modelId: model.modelId,
          modelVersion: model.version,
          contextHash: context.contextHash,
          inputHash,
          featureHash: CanonicalAISerializer.computeFeatureHash(inputs),
          outputHash,
          executionHash,
          timestamp: new Date().toISOString(),
          runtimeVersion: this.runtimeVersion,
          status: 'PHYSICS_VIOLATION',
          determinism,
          seed,
          inputs,
          prediction: predictionVal,
          uncertainty: { type: 'MODEL', value: 0.8, confidenceInterval: [predictionVal * 0.8, predictionVal * 1.2] },
          oodStatus: guardrail.oodStatus,
          guardrailVerdict: 'PHYSICS_VIOLATION'
        };
      }
    }

    // 4. Successful Controlled Inference
    const uncertaintyVal = guardrail.oodStatus === 'NEAR_BOUNDARY' ? 0.15 : 0.02;
    const uncertainty: AIUncertainty = {
      type: 'ALEATORIC',
      value: uncertaintyVal,
      confidenceInterval: [predictionVal * (1 - uncertaintyVal), predictionVal * (1 + uncertaintyVal)]
    };

    const inputHash = CanonicalAISerializer.computeInputHash(inputs, units);
    const featureHash = CanonicalAISerializer.computeFeatureHash(inputs);
    const outputHash = CanonicalAISerializer.computeOutputHash(predictionVal, uncertainty.value);
    const executionHash = CanonicalAISerializer.computeExecutionHash(model.modelHash, context.contextHash, inputHash, outputHash, seed);

    const inferenceId = `INF-${model.modelId}-${model.version}-${Date.now()}`;
    const occurrenceId = `OCC-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const nowIso = new Date().toISOString();

    const provenanceRecord = {
      inferenceId,
      occurrenceId,
      modelId: model.modelId,
      modelVersion: model.version,
      modelHash: model.modelHash,
      weightsHash: model.weightsHash || CanonicalAISerializer.computeWeightsHash(model.weights, model.modelBinaryHash),
      datasetId: model.trainingDatasetId,
      featureSchemaId: model.featureSchemaId,
      runtimeVersion: this.runtimeVersion,
      operator: 'SYSTEM_AUTONOMOUS',
      canonicalRevisionId: context.configurationState?.revisionId || 'REV-UNKNOWN',
      canonicalRevisionHash: context.configurationState?.canonicalRevisionHash || '',
      contextHash: context.contextHash,
      inputHash,
      outputHash,
      executionHash,
      provenanceHash: '',
      timestamp: nowIso
    };
    provenanceRecord.provenanceHash = CanonicalAISerializer.computeProvenanceHash(provenanceRecord);

    const record: AIInferenceRecord = {
      inferenceId,
      occurrenceId,
      modelId: model.modelId,
      modelVersion: model.version,
      contextHash: context.contextHash,
      inputHash,
      featureHash,
      outputHash,
      resultDigest: outputHash,
      executionHash,
      executionIdentity: executionHash,
      timestamp: nowIso,
      startedAt: nowIso,
      completedAt: nowIso,
      durationMs: 0,
      runtimeVersion: this.runtimeVersion,
      status: 'SUCCESS',
      determinism,
      seed,
      inputs,
      prediction: predictionVal,
      uncertainty,
      oodStatus: guardrail.oodStatus,
      guardrailVerdict: guardrail.verdict,
      provenanceRecord
    };

    // 5. Twin Evidence Graph Integration (PATCH-130)
    if (evidenceEngine) {
      const modelNodeId = `AI-MODEL-${model.modelId}-${model.version}`;
      const contextNodeId = `AI-CTX-${context.contextId}`;
      const inferenceNodeId = `AI-INF-${inferenceId}`;

      // Add nodes if not present
      if (!evidenceEngine.graph.nodes.has(modelNodeId)) {
        evidenceEngine.addNode(
          modelNodeId,
          'PREDICTION',
          model.modelId,
          model.version,
          'EngineeringAIModelRegistry',
          new Date().toISOString(),
          { modelHash: model.modelHash, status: model.status }
        );
      }

      if (!evidenceEngine.graph.nodes.has(contextNodeId)) {
        evidenceEngine.addNode(
          contextNodeId,
          'GEOMETRY_STATE',
          context.contextId,
          'v1',
          'EngineeringAIContextEngine',
          context.timestamp,
          { contextHash: context.contextHash }
        );
      }

      evidenceEngine.addNode(
        inferenceNodeId,
        'PREDICTION',
        inferenceId,
        'v1',
        'EngineeringAIRuntime',
        record.timestamp,
        {
          inputHash,
          outputHash,
          executionHash,
          prediction: predictionVal,
          uncertainty: uncertainty.value,
          guardrailVerdict: record.guardrailVerdict
        }
      );

      // Add Edges
      evidenceEngine.addEdge(`E-GEN-${inferenceId}`, inferenceNodeId, modelNodeId, 'DERIVED_FROM');
      evidenceEngine.addEdge(`E-CTX-${inferenceId}`, inferenceNodeId, contextNodeId, 'DEPENDS_ON');
    }

    return record;
  }
}
