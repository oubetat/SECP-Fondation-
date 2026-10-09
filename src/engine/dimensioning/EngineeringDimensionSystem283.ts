
import { 
  EngineeringDimension283, 
  DimensionType283, 
  DimensionReference283, 
  DimensionStatus283,
  ToleranceType283,
  DimensionSource283,
  DimensionEvidence283
} from './DimensionTypes283';

/**
 * PATCH-283 — Engineering Dimensioning System
 * Core logic for semantic dimension calculation and management
 */
export class EngineeringDimensionSystem283 {
  private dimensions: Map<string, EngineeringDimension283> = new Map();
  private activeModelRevision: string = 'REV-001';

  constructor() {}

  /**
   * Creates a semantic dimension from geometric references
   */
  public createDimension(
    type: DimensionType283,
    references: DimensionReference283[],
    source: DimensionSource283 = DimensionSource283.MODEL
  ): EngineeringDimension283 {
    // 1. Validate References
    if (!this.validateReferences(type, references)) {
      throw new Error(`Incompatible references for dimension type: ${type}`);
    }

    // 2. Solve Real Geometry Value
    const nominalValue = this.solveGeometricValue(type, references);

    // 3. Create Entity
    const dimension: EngineeringDimension283 = {
      id: `DIM-${crypto.randomUUID()}`,
      type,
      references,
      nominalValue,
      unit: 'mm',
      tolerance: { type: ToleranceType283.NONE },
      source,
      status: DimensionStatus283.VALID,
      revision: this.activeModelRevision,
      placement: {
        origin: [0, 0, 0], // Default, to be refined by UI/Auto-placement
        direction: [0, 1, 0],
        textOffset: [0, 10, 0]
      },
      style: {
        font: 'Inter, sans-serif',
        textHeight: 3.5,
        lineWidth: 0.25,
        arrowSize: 2.5,
        color: '#38bdf8',
        precision: 2,
        unitSystem: 'METRIC',
        showTrailingZeros: true,
        dualDimensions: false
      },
      visibility: true,
      metadata: {}
    };

    this.dimensions.set(dimension.id, dimension);
    return dimension;
  }

  /**
   * Validates if references are compatible with dimension type
   */
  private validateReferences(type: DimensionType283, refs: DimensionReference283[]): boolean {
    switch (type) {
      case DimensionType283.LINEAR:
        return refs.length === 2 && (refs.every(r => r.entityType === 'VERTEX') || refs.every(r => r.entityType === 'FACE'));
      case DimensionType283.RADIAL:
      case DimensionType283.DIAMETER:
        return refs.length === 1 && (refs[0].entityType === 'EDGE' || refs[0].entityType === 'FACE');
      case DimensionType283.ANGULAR:
        return refs.length === 2 && refs.every(r => r.entityType === 'EDGE' || r.entityType === 'FACE');
      default:
        return refs.length > 0;
    }
  }

  /**
   * Internal geometric solver (Simulated for patch context, would call B-Rep kernel)
   */
  private solveGeometricValue(type: DimensionType283, refs: DimensionReference283[]): number {
    // In a real system, this calls the CAD Kernel to measure the distance/angle/radius
    // For the purpose of this simulation, we generate a deterministic value based on entity IDs
    let seed = refs.reduce((acc, r) => acc + r.entityId.length, 0);
    
    switch (type) {
      case DimensionType283.LINEAR: return 25.0 + (seed % 100) / 10;
      case DimensionType283.RADIAL: return 5.0 + (seed % 20);
      case DimensionType283.DIAMETER: return 10.0 + (seed % 40);
      case DimensionType283.ANGULAR: return 90.0;
      default: return 0;
    }
  }

  /**
   * Re-evaluates all dimensions against a new model revision
   */
  public revalidate(newRevision: string): void {
    this.activeModelRevision = newRevision;
    this.dimensions.forEach(dim => {
      // 1. Check for broken references (Simulated)
      const isBroken = Math.random() > 0.95; // 5% chance of broken ref on rebuild
      
      if (isBroken) {
        dim.status = DimensionStatus283.UNRESOLVED;
      } else {
        // 2. Re-solve value
        const newValue = this.solveGeometricValue(dim.type, dim.references);
        if (Math.abs(newValue - dim.nominalValue) > 0.0001) {
          dim.nominalValue = newValue;
          dim.status = DimensionStatus283.STALE; // Needs approval or update
        } else {
          dim.status = DimensionStatus283.VALID;
        }
      }
      dim.revision = newRevision;
    });
  }

  /**
   * Generates engineering evidence for a dimension
   */
  public generateEvidence(dimId: string): DimensionEvidence283 {
    const dim = this.dimensions.get(dimId);
    if (!dim) throw new Error('Dimension not found');

    return {
      dimensionId: dim.id,
      timestamp: new Date().toISOString(),
      modelRevision: dim.revision,
      value: dim.nominalValue,
      tolerance: dim.tolerance,
      status: dim.status,
      hash: btoa(`${dim.id}-${dim.nominalValue}-${dim.revision}`)
    };
  }

  public getDimensions(): EngineeringDimension283[] {
    return Array.from(this.dimensions.values());
  }

  public getDimension(id: string): EngineeringDimension283 | undefined {
    return this.dimensions.get(id);
  }

  public setTolerance(dimId: string, tolerance: EngineeringDimension283['tolerance']): void {
    const dim = this.dimensions.get(dimId);
    if (dim) {
      dim.tolerance = tolerance;
    }
  }

  public deleteDimension(id: string): void {
    this.dimensions.delete(id);
  }
}
