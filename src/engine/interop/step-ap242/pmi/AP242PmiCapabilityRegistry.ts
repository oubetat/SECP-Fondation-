/**
 * SECP Industrial OS v2 — AP242 PMI Capability Registry
 * PATCH-035: AP242 PMI
 */

export type CapabilityStatus = 'PROVEN' | 'PARTIAL' | 'UNSUPPORTED' | 'UNPROVEN';

export interface PmiCapabilityMatrix {
  Dimensions: CapabilityStatus;
  GDT: CapabilityStatus;
  Datums: CapabilityStatus;
  FeatureControlFrames: CapabilityStatus;
  SurfaceFinish: CapabilityStatus;
  SemanticPMI: CapabilityStatus;
  GraphicalPMI: CapabilityStatus;
  GeometryAssociation: CapabilityStatus;
  RoundTrip: CapabilityStatus;
}

export class AP242PmiCapabilityRegistry {
  private static matrix: PmiCapabilityMatrix = {
    Dimensions: 'UNPROVEN',
    GDT: 'UNPROVEN',
    Datums: 'UNPROVEN',
    FeatureControlFrames: 'UNPROVEN',
    SurfaceFinish: 'UNPROVEN',
    SemanticPMI: 'UNPROVEN',
    GraphicalPMI: 'UNPROVEN',
    GeometryAssociation: 'UNPROVEN',
    RoundTrip: 'UNPROVEN'
  };

  public static getMatrix(): PmiCapabilityMatrix {
    return { ...this.matrix };
  }

  public static updateCapability(key: keyof PmiCapabilityMatrix, status: CapabilityStatus) {
    this.matrix[key] = status;
  }
}
