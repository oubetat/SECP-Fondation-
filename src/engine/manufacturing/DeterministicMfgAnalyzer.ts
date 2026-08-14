import { DesignHistory } from '../features/FeatureTypes';
import { ShapeHandle } from '../geometry/ShapeHandle';
import { DesignIntent } from '../intent/DesignIntentTypes';
import { DesignIntentValidator } from '../intent/DesignIntentValidator';
import { FeatureRegenerationEngine } from '../features/FeatureRegenerationEngine';
import { ManufacturingFeatureRecognizer } from './ManufacturingFeatureRecognizer';
import { ProcessSemanticsEngine } from './ProcessSemanticsEngine';
import { ManufacturabilityRulesEngine } from './ManufacturabilityRulesEngine';
import { ManufacturingIntentBridge } from './ManufacturingIntentBridge';
import { MultiTierValidationResult, ProcessType } from './ManufacturingTypes';

/**
 * PATCH-SECP-049-E — Deterministic Manufacturing Analyzer
 * Executes multi-tier evaluation: Geometry (OCCT) -> Design Intent (SECP-048) -> Manufacturability (SECP-049).
 */
export class DeterministicMfgAnalyzer {

  public static async analyzeModel(
    history: DesignHistory,
    intents: DesignIntent[] = [],
    preferredProcess: ProcessType = ProcessType.MILLING_3AXIS
  ): Promise<MultiTierValidationResult> {
    const timestamp = new Date().toISOString();

    // Step 1: Regeneration & Tier 1 Geometry Validation
    const regenEngine = new FeatureRegenerationEngine();
    const regenRes = await regenEngine.regenerate(history);
    const geometricValidity = regenRes.success && !!regenRes.finalShape;

    // Step 2: Tier 2 Design Intent Validation
    const intentRes = await DesignIntentValidator.validate(
      intents,
      history,
      regenRes.finalShape,
      regenRes.success
    );
    const designIntentSatisfied = intentRes.intentSuccess;

    // Step 3: Tier 3 Manufacturing Feature Recognition & Rule Evaluation
    const mfgFeatures = await ManufacturingFeatureRecognizer.recognizeFeatures(history, regenRes.finalShape);
    
    const rulesEngine = new ManufacturabilityRulesEngine();
    const violations = rulesEngine.evaluateFeatures(mfgFeatures, preferredProcess);

    const processPlan = ProcessSemanticsEngine.generateProcessPlan(mfgFeatures, preferredProcess);
    const mfgIntents = ManufacturingIntentBridge.convertDesignIntents(intents, preferredProcess);

    const manufacturabilityValid = violations.filter(v => v.severity === 'CRITICAL').length === 0 && processPlan.isFeasible;

    // Determine Multi-Tier Overall Status
    let overallStatus: 'PASS' | 'GEOMETRIC_FAIL' | 'INTENT_VIOLATED' | 'MANUFACTURABILITY_FAIL' = 'PASS';

    if (!geometricValidity) {
      overallStatus = 'GEOMETRIC_FAIL';
    } else if (!designIntentSatisfied) {
      overallStatus = 'INTENT_VIOLATED';
    } else if (!manufacturabilityValid) {
      overallStatus = 'MANUFACTURABILITY_FAIL';
    }

    // Provenance Hash computation
    const provPayload = JSON.stringify({
      historyRev: history.revision,
      featureCount: history.features.length,
      geometricValidity,
      designIntentSatisfied,
      manufacturabilityValid,
      violationCount: violations.length,
      planFeasible: processPlan.isFeasible,
      overallStatus
    });

    const provenanceHash = this.computeHash(provPayload);

    return {
      patch: 'SECP-049',
      timestamp,
      geometricValidity,
      designIntentSatisfied,
      manufacturabilityValid,
      overallStatus,
      recognizedFeatures: mfgFeatures,
      violations,
      processPlan,
      mfgIntents,
      provenanceHash
    };
  }

  private static computeHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `sha256-049-mfg-${Math.abs(hash).toString(16)}`;
  }
}
