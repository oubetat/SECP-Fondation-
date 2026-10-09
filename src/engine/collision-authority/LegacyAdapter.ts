/**
 * SECP Industrial OS v3 — Collision Authority Core
 * P0 Remediation Legacy Adapter — Explicit Limitation & Approximation Wrapper
 */

import {
  CanonicalCollisionInput,
  CollisionCapabilityDeclaration,
  CollisionExactness,
  CollisionProvider,
  CollisionStatus,
  RawProviderResult
} from './types';

export interface LegacyEngineInvoker {
  (input: CanonicalCollisionInput): Promise<any> | any;
}

export class LegacyCollisionAdapter implements CollisionProvider {
  public readonly capabilities: CollisionCapabilityDeclaration;
  private invoker: LegacyEngineInvoker;

  constructor(
    providerId: string,
    providerName: string,
    algorithmVersion: string,
    exactnessLevel: CollisionExactness,
    limitations: string[],
    capabilitiesMask: {
      supportsStaticCollision?: boolean;
      supportsContinuousCollision?: boolean;
      supportsMeshMesh?: boolean;
      supportsToolStock?: boolean;
      supportsToolFixture?: boolean;
      supportsHolderCollision?: boolean;
      supportsMachineCollision?: boolean;
      supportsBRep?: boolean;
      supportsGouge?: boolean;
      supportsClearance?: boolean;
    },
    invoker: LegacyEngineInvoker
  ) {
    this.capabilities = {
      providerId,
      providerName,
      algorithmVersion,
      exactnessLevel,
      limitations: Object.freeze([...limitations]),
      supportsStaticCollision: capabilitiesMask.supportsStaticCollision ?? false,
      supportsContinuousCollision: capabilitiesMask.supportsContinuousCollision ?? false,
      supportsMeshMesh: capabilitiesMask.supportsMeshMesh ?? false,
      supportsToolStock: capabilitiesMask.supportsToolStock ?? false,
      supportsToolFixture: capabilitiesMask.supportsToolFixture ?? false,
      supportsHolderCollision: capabilitiesMask.supportsHolderCollision ?? false,
      supportsMachineCollision: capabilitiesMask.supportsMachineCollision ?? false,
      supportsBRep: capabilitiesMask.supportsBRep ?? false,
      supportsGouge: capabilitiesMask.supportsGouge ?? false,
      supportsClearance: capabilitiesMask.supportsClearance ?? false
    };
    this.invoker = invoker;
  }

  public evaluate(input: CanonicalCollisionInput): Promise<RawProviderResult> | RawProviderResult {
    const raw = this.invoker(input);
    if (raw instanceof Promise) {
      return raw.then(res => this.normalizeLegacyOutput(res));
    }
    return this.normalizeLegacyOutput(raw);
  }

  private normalizeLegacyOutput(raw: any): RawProviderResult {
    // Normalize basic legacy result shapes
    if (typeof raw === 'boolean') {
      return {
        status: raw ? CollisionStatus.PENETRATION : CollisionStatus.NO_COLLISION,
        diagnostics: [`Legacy boolean adapter evaluated with exactness: ${this.capabilities.exactnessLevel}`]
      };
    }

    if (raw && typeof raw === 'object') {
      return {
        status: raw.status || (raw.hasCollision ? CollisionStatus.PENETRATION : CollisionStatus.NO_COLLISION),
        minClearanceMm: raw.minClearanceMm ?? raw.clearance ?? raw.minimumClearance,
        maxPenetrationDepthMm: raw.maxPenetrationDepthMm ?? raw.penetrationDepth ?? raw.penetrationDepthMm,
        volumetricInterferenceMm3: raw.volumetricInterferenceMm3 ?? raw.overlapVolume ?? raw.intersectionVolumeMm3,
        contacts: raw.contacts,
        diagnostics: [
          `Legacy adapter: ${this.capabilities.providerName} (${this.capabilities.exactnessLevel})`,
          ...(raw.diagnostics || [])
        ]
      };
    }

    return {
      status: CollisionStatus.ANALYSIS_FAILED,
      failureReason: 'Legacy engine returned uninterpretable result format.'
    };
  }
}
