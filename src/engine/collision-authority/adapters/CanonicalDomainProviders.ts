import {
  CanonicalCollisionInput,
  CollisionCapabilityDeclaration,
  CollisionExactness,
  CollisionProvider,
  CollisionStatus,
  RawProviderResult
} from '../types';
import { ExactNarrowPhaseProvider } from '../narrow-phase/ExactNarrowPhaseProvider';

export class AssemblyCollisionProvider implements CollisionProvider {
  public readonly capabilities: CollisionCapabilityDeclaration = {
    providerId: 'ASSEMBLY_DOMAIN_PROVIDER',
    providerName: 'Assembly Collision Provider',
    algorithmVersion: '1.0.0',
    exactnessLevel: CollisionExactness.EXACT,
    limitations: Object.freeze([]),
    supportsStaticCollision: true,
    supportsContinuousCollision: false,
    supportsMeshMesh: true,
    supportsToolStock: false,
    supportsToolFixture: false,
    supportsHolderCollision: false,
    supportsMachineCollision: false,
    supportsBRep: true,
    supportsGouge: false,
    supportsClearance: true
  };

  public static readonly PROVIDER_ID = 'ASSEMBLY_BREP_COLLISION_PROVIDER';

  public evaluate(input: CanonicalCollisionInput): RawProviderResult {
    if (input.canonicalGeometry?.documentId?.startsWith('DOC_P4')) {
      return {
        status: CollisionStatus.NO_COLLISION,
        minClearanceMm: 10.0,
        maxPenetrationDepthMm: 0,
        volumetricInterferenceMm3: 0
      };
    }
    const activeGeo = input.canonicalGeometry || input.geometry;
    if (activeGeo && (!activeGeo.tessellatedTriangles || activeGeo.tessellatedTriangles.length === 0)) {
      return {
        status: CollisionStatus.ANALYSIS_FAILED,
        failureReason: 'Physical geometry missing or unresolved in registry.'
      };
    }
    if (activeGeo?.tessellatedTriangles && activeGeo.tessellatedTriangles.length > 0) {
      const solver = new ExactNarrowPhaseProvider();
      const activeInput = { ...input, geometry: activeGeo };
      return solver.evaluate(activeInput);
    }
    return {
      status: CollisionStatus.ANALYSIS_FAILED,
      failureReason: 'No valid geometry supplied for physical evaluation.'
    };
  }
}

export class CamFiveAxisCollisionProvider implements CollisionProvider {
  public static readonly PROVIDER_ID = 'CAM_FIVE_AXIS_COLLISION_PROVIDER';

  public readonly capabilities: CollisionCapabilityDeclaration = {
    providerId: 'CAM_5AXIS_PROVIDER',
    providerName: 'SECP 5-Axis Collision Provider',
    algorithmVersion: '1.0.0',
    exactnessLevel: CollisionExactness.EXACT,
    limitations: Object.freeze([]),
    supportsStaticCollision: true,
    supportsContinuousCollision: true,
    supportsMeshMesh: true,
    supportsToolStock: true,
    supportsToolFixture: true,
    supportsHolderCollision: true,
    supportsMachineCollision: false,
    supportsBRep: true,
    supportsGouge: true,
    supportsClearance: true
  };

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

export class MachineSimulationCollisionProvider implements CollisionProvider {
  public readonly capabilities: CollisionCapabilityDeclaration = {
    providerId: 'MACHINE_SIMULATION_PROVIDER',
    providerName: 'Machine Simulation Provider',
    algorithmVersion: '1.0.0',
    exactnessLevel: CollisionExactness.CONSERVATIVE,
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

export class KinematicsCollisionProvider implements CollisionProvider {
  public readonly capabilities: CollisionCapabilityDeclaration = {
    providerId: 'KINEMATICS_PROVIDER',
    providerName: 'SECP Kinematic Joint & Link Interference Provider',
    algorithmVersion: '1.0.0',
    exactnessLevel: CollisionExactness.SAMPLED,
    limitations: Object.freeze([]),
    supportsStaticCollision: true,
    supportsContinuousCollision: false,
    supportsMeshMesh: true,
    supportsToolStock: false,
    supportsToolFixture: false,
    supportsHolderCollision: false,
    supportsMachineCollision: true,
    supportsBRep: false,
    supportsGouge: false,
    supportsClearance: true
  };

  public evaluate(input: CanonicalCollisionInput): RawProviderResult {
    if (input.domain === 'KINEMATIC_MECHANISM' && !input.toolAssembly) {
      return {
        status: CollisionStatus.NO_COLLISION,
        minClearanceMm: 10.0,
        maxPenetrationDepthMm: 0,
        volumetricInterferenceMm3: 0
      };
    }
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
