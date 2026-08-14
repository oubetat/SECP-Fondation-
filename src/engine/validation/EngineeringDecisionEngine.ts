import { DesignHistory } from '../features/FeatureTypes';
import { DesignIntent } from '../intent/DesignIntentTypes';
import { ProcessType } from '../manufacturing/ManufacturingTypes';
import { DeterministicMfgAnalyzer } from '../manufacturing/DeterministicMfgAnalyzer';
import { GeometryKernelManager } from '../geometry/GeometryKernelManager';
import { SystemProvenanceEngine } from './SystemProvenanceEngine';
import { 
  UnifiedEngineeringReport, 
  FinalEngineeringDecision 
} from './EngineeringDecisionTypes';

/**
 * PATCH-SECP-050-A & B — Engineering Decision Engine
 * Evaluates the full CAD Core stack and returns a unified, deterministic decision.
 */
export class EngineeringDecisionEngine {

  public static async evaluateModel(
    history: DesignHistory,
    intents: DesignIntent[] = [],
    preferredProcess: ProcessType = ProcessType.MILLING_3AXIS
  ): Promise<UnifiedEngineeringReport> {
    const timestamp = new Date().toISOString();
    const kernel = await GeometryKernelManager.getKernel();

    // Run Tier 1 + Tier 2 + Tier 3 via DeterministicMfgAnalyzer
    const mfgRes = await DeterministicMfgAnalyzer.analyzeModel(
      history,
      intents,
      preferredProcess
    );

    // Retrieve Properties from Shape if available
    let volume = 0;
    let faceCount = 0;
    let edgeCount = 0;

    const regenRes = await new (await import('../features/FeatureRegenerationEngine')).FeatureRegenerationEngine().regenerate(history);
    if (regenRes.finalShape && regenRes.finalShape.getProperties) {
      const props = await regenRes.finalShape.getProperties();
      volume = props?.volume || 0;
      faceCount = props?.faceCount || 0;
      edgeCount = props?.edgeCount || 0;
    }

    const t1Valid = mfgRes.geometricValidity;
    const t2Satisfied = mfgRes.designIntentSatisfied;
    const t3Feasible = mfgRes.manufacturabilityValid;

    // Calculate Failures Count
    const failures: string[] = [];
    if (!t1Valid) failures.push('GEOMETRY');
    if (!t2Satisfied) failures.push('INTENT');
    if (!t3Feasible) failures.push('MANUFACTURABILITY');

    let decision: FinalEngineeringDecision;

    if (!t1Valid) {
      decision = FinalEngineeringDecision.GEOMETRIC_INVALID;
    } else if (!t2Satisfied && !t3Feasible) {
      decision = FinalEngineeringDecision.MULTIPLE_ENGINEERING_FAILURES;
    } else if (!t2Satisfied) {
      decision = FinalEngineeringDecision.DESIGN_INTENT_FAIL;
    } else if (!t3Feasible) {
      decision = FinalEngineeringDecision.MANUFACTURABILITY_FAIL;
    } else {
      decision = FinalEngineeringDecision.ENGINEERING_VALID;
    }

    // Provenance Certificate
    const provenance = SystemProvenanceEngine.generateProvenance(
      history,
      intents,
      mfgRes,
      decision,
      kernel
    );

    return {
      patch: 'SECP-050',
      systemVersion: 'SECP CAD CORE v1.0',
      timestamp,
      decision,
      isAcceptableForProduction: decision === FinalEngineeringDecision.ENGINEERING_VALID,

      tier1Geometry: {
        valid: t1Valid,
        volumeMm3: volume,
        faceCount,
        edgeCount,
        message: t1Valid ? 'B-Rep geometry valid' : 'B-Rep kernel regeneration failed'
      },

      tier2DesignIntent: {
        satisfied: t2Satisfied,
        totalIntentsEvaluated: intents.length,
        violationsCount: intents.filter(i => i.status === 'VIOLATED').length,
        details: {
          patch: 'SECP-048',
          timestamp,
          geometricSuccess: t1Valid,
          intentSuccess: t2Satisfied,
          overallStatus: t2Satisfied ? 'PASS' : 'FAIL',
          intentDetails: intents.map(i => ({
            intentId: i.id,
            type: i.type,
            status: i.status,
            message: i.description
          })),
          provenanceHash: provenance.outputHash
        }
      },

      tier3Manufacturability: {
        feasible: t3Feasible,
        recognizedFeaturesCount: mfgRes.recognizedFeatures.length,
        criticalViolationsCount: mfgRes.violations.filter(v => v.severity === 'CRITICAL').length,
        details: mfgRes
      },

      provenance
    };
  }
}
