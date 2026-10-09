import { ShapeHandle } from '../geometry/ShapeHandle';
import { 
  DesignHistory, 
  FeatureDefinition 
} from '../features/FeatureTypes';
import { 
  DesignIntent, 
  DesignIntentResult, 
  ComprehensiveValidationResult, 
  IntentStatus,
  IntentType
} from './DesignIntentTypes';
import { DesignIntentResolver } from './DesignIntentResolver';

/**
 * PATCH-SECP-048-A — Design Intent Validator
 * The brain of the intent layer. 
 * Detects violations even if the geometric rebuild was successful.
 */
export class DesignIntentValidator {
  
  public static async validate(
    intents: DesignIntent[],
    history: DesignHistory,
    finalShape: ShapeHandle | undefined,
    regenerationSuccess: boolean
  ): Promise<ComprehensiveValidationResult> {
    
    const results: DesignIntentResult[] = [];
    let intentSuccess = true;
    let topologyResolved = regenerationSuccess;

    if (!regenerationSuccess || !finalShape) {
      return {
        geometricSuccess: regenerationSuccess,
        topologyResolved: false,
        intentSuccess: false,
        intentDetails: intents.map(i => ({ intentId: i.id, status: IntentStatus.VIOLATED, message: 'Geometry failed' })),
        overallStatus: 'FAIL'
      };
    }

    for (const intent of intents) {
      if (intent.status === IntentStatus.SUPPRESSED) {
        results.push({
          intentId: intent.id,
          status: IntentStatus.SUPPRESSED,
          message: 'Intent is suppressed'
        });
        continue;
      }

      const res = await this.validateSingleIntent(intent, history, finalShape);
      results.push(res);
      if (res.status === IntentStatus.VIOLATED || res.status === IntentStatus.RESOLVE_ERROR) {
        intentSuccess = false;
      }
      if (res.status === IntentStatus.RESOLVE_ERROR) {
        topologyResolved = false;
      }
    }

    return {
      geometricSuccess: true,
      topologyResolved,
      intentSuccess,
      intentDetails: results,
      overallStatus: intentSuccess ? 'PASS' : 'PARTIAL_VIOLATION'
    };
  }

  private static async validateSingleIntent(
    intent: DesignIntent,
    history: DesignHistory,
    shape: ShapeHandle
  ): Promise<DesignIntentResult> {
    
    // 1. Resolve Semantic References
    const resolvedIndices: number[] = [];
    for (const ref of intent.semanticReferences) {
      const res = await DesignIntentResolver.resolveSemanticReference(ref, shape);
      if (!res.success) {
        return { 
          intentId: intent.id, 
          status: IntentStatus.RESOLVE_ERROR, 
          message: `Semantic resolution failed: ${res.error}` 
        };
      }
      resolvedIndices.push(res.entityIndex!);
    }

    // 2. Validate Invariant
    switch (intent.type) {
      case IntentType.MINIMUM_WALL_THICKNESS:
        return this.checkWallThickness(intent, history);

      case IntentType.MAXIMUM_DIMENSION:
        return this.checkMaxDimension(intent, history);

      case IntentType.CONCENTRICITY:
        return this.checkConcentricity(intent, history);

      case IntentType.SYMMETRY:
        return this.checkSymmetry(intent, history);

      case IntentType.COAXIALITY:
        return this.checkCoaxiality(intent, history);

      default:
        return { intentId: intent.id, status: IntentStatus.ACTIVE };
    }
  }

  private static checkWallThickness(intent: DesignIntent, history: DesignHistory): DesignIntentResult {
    const min = intent.parameters.min || 3.0;
    
    // Scan features for thickness violations
    for (const fid of intent.sourceFeatureIds) {
      const feature = history.features.find(f => f.featureId === fid);
      if (feature) {
        const actual = feature.parameters.thickness || feature.parameters.depth || feature.parameters.width || 0;
        if (actual < min) {
          return {
            intentId: intent.id,
            status: IntentStatus.VIOLATED,
            message: `Wall thickness violation on feature ${fid}: ${actual}mm < ${min}mm`,
            deviation: min - actual
          };
        }
      }
    }
    
    return { intentId: intent.id, status: IntentStatus.ACTIVE };
  }

  private static checkMaxDimension(intent: DesignIntent, history: DesignHistory): DesignIntentResult {
    const max = intent.parameters.max || 100.0;
    for (const fid of intent.sourceFeatureIds) {
      const feature = history.features.find(f => f.featureId === fid);
      if (feature) {
        const actual = Math.max(
          feature.parameters.width || 0,
          feature.parameters.height || 0,
          feature.parameters.depth || 0,
          feature.parameters.radius ? feature.parameters.radius * 2 : 0
        );
        if (actual > max) {
          return {
            intentId: intent.id,
            status: IntentStatus.VIOLATED,
            message: `Max dimension violation on feature ${fid}: ${actual}mm > ${max}mm`,
            deviation: actual - max
          };
        }
      }
    }
    return { intentId: intent.id, status: IntentStatus.ACTIVE };
  }

  private static checkConcentricity(intent: DesignIntent, history: DesignHistory): DesignIntentResult {
    const maxOffset = intent.parameters.maxOffset || 0.001;
    const offset = intent.parameters.offset || 0;
    if (offset > maxOffset) {
      return {
        intentId: intent.id,
        status: IntentStatus.VIOLATED,
        message: `Concentricity offset violation: ${offset}mm > ${maxOffset}mm`,
        deviation: offset - maxOffset
      };
    }
    return { intentId: intent.id, status: IntentStatus.ACTIVE, message: 'Concentricity preserved' };
  }

  private static checkSymmetry(intent: DesignIntent, history: DesignHistory): DesignIntentResult {
    const asymmetry = intent.parameters.asymmetry || 0;
    const maxAllowed = intent.parameters.maxAsymmetry || 0.001;
    if (asymmetry > maxAllowed) {
      return {
        intentId: intent.id,
        status: IntentStatus.VIOLATED,
        message: `Symmetry violation: asymmetry ${asymmetry}mm exceeds allowed ${maxAllowed}mm`,
        deviation: asymmetry - maxAllowed
      };
    }
    return { intentId: intent.id, status: IntentStatus.ACTIVE, message: 'Symmetry preserved' };
  }

  private static checkCoaxiality(intent: DesignIntent, history: DesignHistory): DesignIntentResult {
    const angularDev = intent.parameters.angularDeviation || 0;
    const maxAllowed = intent.parameters.maxAngularDeviation || 0.01;
    if (angularDev > maxAllowed) {
      return {
        intentId: intent.id,
        status: IntentStatus.VIOLATED,
        message: `Coaxiality angular violation: ${angularDev} rad > ${maxAllowed} rad`,
        deviation: angularDev - maxAllowed
      };
    }
    return { intentId: intent.id, status: IntentStatus.ACTIVE, message: 'Coaxiality preserved' };
  }
}
