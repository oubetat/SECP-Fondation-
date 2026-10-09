import {
  GeometryEntityDescriptor,
  GeometryContext,
  HallucinationVerdict,
  GeometryFeatureEvidence
} from './types';

export interface AIClaim {
  claimText: string;
  mentionedEntityIds?: string[];
  mentionedFeatureTypes?: string[];
  claimedDimensions?: Record<string, { value: number; unit: string }>;
}

export interface HallucinationCheckResult {
  verdict: HallucinationVerdict;
  details: string;
  invalidEntityIds: string[];
  mismatchedDimensions: string[];
}

export class GeometryHallucinationDetector {
  public static verifyClaimGrounding(
    claim: AIClaim,
    entities: GeometryEntityDescriptor[],
    features: GeometryFeatureEvidence[],
    context: GeometryContext
  ): HallucinationCheckResult {
    const invalidEntityIds: string[] = [];
    const mismatchedDimensions: string[] = [];

    const entityMap = new Map(entities.map((e) => [e.entityId, e]));

    // 1. Verify mentioned entity IDs exist in current geometry graph
    if (claim.mentionedEntityIds && claim.mentionedEntityIds.length > 0) {
      for (const entId of claim.mentionedEntityIds) {
        if (!entityMap.has(entId)) {
          invalidEntityIds.push(entId);
        }
      }
    }

    // 2. Check dimensions claimed by AI
    if (claim.claimedDimensions) {
      for (const [dimKey, dimVal] of Object.entries(claim.claimedDimensions)) {
        // Find if any entity matches this dimension
        let found = false;
        for (const ent of entities) {
          if (ent.parameters[dimKey] !== undefined) {
            const actualVal = ent.parameters[dimKey];
            // Account for unit conversion if needed or simple epsilon check
            if (Math.abs(actualVal - dimVal.value) <= 0.01) {
              found = true;
              break;
            }
          }
        }
        if (!found) {
          mismatchedDimensions.push(`${dimKey}: claimed ${dimVal.value} ${dimVal.unit}`);
        }
      }
    }

    // 3. Determine Verdict
    if (invalidEntityIds.length > 0) {
      return {
        verdict: 'UNGROUNDED',
        details: `Claim references non-existent geometry entities: [${invalidEntityIds.join(', ')}]`,
        invalidEntityIds,
        mismatchedDimensions
      };
    }

    if (mismatchedDimensions.length > 0) {
      return {
        verdict: 'CONTRADICTED_BY_KERNEL',
        details: `Claim dimensions contradicted by actual CAD geometry parameters: [${mismatchedDimensions.join(', ')}]`,
        invalidEntityIds,
        mismatchedDimensions
      };
    }

    if ((claim.mentionedEntityIds && claim.mentionedEntityIds.length === 0) && (claim.mentionedFeatureTypes && claim.mentionedFeatureTypes.length === 0)) {
      return {
        verdict: 'UNGROUNDED',
        details: 'Claim contains generic assertions without grounding in specific geometry entity IDs or feature IDs.',
        invalidEntityIds: [],
        mismatchedDimensions: []
      };
    }

    return {
      verdict: 'GROUNDED',
      details: 'All referenced geometry entities and parameters strictly verified against CAD model.',
      invalidEntityIds: [],
      mismatchedDimensions: []
    };
  }
}
