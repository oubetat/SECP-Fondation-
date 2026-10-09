import { EngineeringAIContext } from './types';
import { CanonicalAISerializer } from './CanonicalAISerializer';

export class EngineeringAIContextEngine {
  public static createContext(
    contextId: string,
    states: {
      geometryState?: Record<string, any>;
      materialState?: Record<string, any>;
      physicsState?: Record<string, any>;
      manufacturingState?: Record<string, any>;
      assemblyState?: Record<string, any>;
      telemetryState?: Record<string, any>;
      configurationState?: Record<string, any>;
      evidenceSnapshotHash?: string;
    }
  ): EngineeringAIContext {
    const rawCtx: Omit<EngineeringAIContext, 'contextHash'> = {
      contextId,
      geometryState: states.geometryState || {},
      materialState: states.materialState || {},
      physicsState: states.physicsState || {},
      manufacturingState: states.manufacturingState || {},
      assemblyState: states.assemblyState || {},
      telemetryState: states.telemetryState || {},
      configurationState: states.configurationState || {},
      evidenceSnapshotHash: states.evidenceSnapshotHash || 'EVID-SNAPSHOT-000',
      timestamp: new Date().toISOString()
    };

    const contextHash = CanonicalAISerializer.computeContextHash(rawCtx);

    return {
      ...rawCtx,
      contextHash
    };
  }
}
