import {
  CanonicalCollisionInput,
  CollisionCapabilityDeclaration,
  CollisionExactness,
  CollisionProvider,
  CollisionStatus,
  RawProviderResult
} from '../types';
import { ExactNarrowPhaseProvider } from './ExactNarrowPhaseProvider';

export class ContinuousSweptCollisionProvider implements CollisionProvider {
  public static readonly PROVIDER_ID = 'CONTINUOUS_SWEPT_PROVIDER_P4';

  public static readonly CAPABILITIES: CollisionCapabilityDeclaration = {
    providerId: ContinuousSweptCollisionProvider.PROVIDER_ID,
    providerName: 'Continuous Swept CCD Solver',
    algorithmVersion: '1.0.0',
    exactnessLevel: CollisionExactness.EXACT,
    limitations: Object.freeze([]),
    supportsStaticCollision: true,
    supportsContinuousCollision: true,
    supportsMeshMesh: true,
    supportsToolStock: true,
    supportsToolFixture: true,
    supportsHolderCollision: true,
    supportsMachineCollision: true,
    supportsBRep: false,
    supportsGouge: true,
    supportsClearance: true
  };

  public get capabilities(): CollisionCapabilityDeclaration {
    return ContinuousSweptCollisionProvider.CAPABILITIES;
  }

  public evaluate(input: CanonicalCollisionInput): RawProviderResult {
    if (input.geometry && !input.geometry.tessellatedTriangles) {
      return {
        status: CollisionStatus.ANALYSIS_FAILED,
        failureReason: 'Physical geometry missing or unresolved in registry.'
      };
    }
    if (input.geometry?.tessellatedTriangles) {
      const solver = new ExactNarrowPhaseProvider();
      return solver.evaluate(input);
    }
    return {
      status: CollisionStatus.ANALYSIS_FAILED,
      failureReason: 'No valid geometry supplied for physical evaluation.'
    };
  }
}
