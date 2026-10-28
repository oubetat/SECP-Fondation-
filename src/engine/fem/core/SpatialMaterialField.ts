/**
 * SECP Industrial OS — Programmable Material Engineering (SECP-PROGRAMMABLE-MATERIAL-V3)
 * SpatialMaterialField.ts
 * 
 * Revision-bound spatial material field contract, physical bounds enforcement,
 * and spatial evaluation engine.
 */

import { createHash } from "crypto";

export type PropertyName = 'E' | 'nu' | 'yieldStress' | 'hardeningModulus' | 'density';

export type ValueCategory = 'TARGET' | 'PREDICTED' | 'MEASURED';

export type EvaluationType = 'ANALYTIC_EXPRESSION' | 'GRADIENT_1D' | 'CONSTANT' | 'CONTROL_POINTS';

export interface ManufacturingConstraint {
  maxGradient?: number; // Maximum spatial gradient
  minFeatureSize?: number; // Minimum feature size constraint
}

export interface PropertyFieldSpec {
  propertyName: PropertyName;
  evaluationType: EvaluationType;
  expression: (coords: { x: number; y: number; z: number }) => number;
  bounds: { lower: number; upper: number };
  manufacturingConstraints?: ManufacturingConstraint;
  valueCategory?: ValueCategory;
  unit?: string;
}

export interface SpatialDomain {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export type OutOfDomainBehavior = 'FAIL_CLOSED' | 'CLAMP';

export class SpatialMaterialField {
  constructor(
    public readonly fieldId: string,
    public readonly canonicalGeometryId: string,
    public readonly canonicalRevisionId: string,
    public readonly baseMaterialId: string,
    private readonly propertySpecs: Map<PropertyName, PropertyFieldSpec>,
    public readonly domain?: SpatialDomain,
    public readonly outOfDomainBehavior: OutOfDomainBehavior = 'FAIL_CLOSED',
    public readonly coordinateSystem: string = 'GLOBAL_CARTESIAN'
  ) {
    if (!fieldId || fieldId.trim() === '') {
      throw new Error(`[SPATIAL_FIELD_INVALID_ID] Field ID cannot be empty or whitespace.`);
    }
    if (!baseMaterialId || baseMaterialId.trim() === '') {
      throw new Error(`[SPATIAL_FIELD_INVALID_MATERIAL] Base material ID cannot be empty.`);
    }
    if (!canonicalRevisionId || canonicalRevisionId.trim() === '') {
      throw new Error(`[SPATIAL_FIELD_INVALID_REVISION] Canonical revision ID cannot be empty.`);
    }
    if (!canonicalGeometryId || canonicalGeometryId.trim() === '') {
      throw new Error(`[SPATIAL_FIELD_INVALID_GEOMETRY] Canonical geometry ID cannot be empty.`);
    }
    this.validateSpecDefinitions();
  }

  private validateSpecDefinitions(): void {
    if (this.propertySpecs.size === 0) {
      throw new Error(`[SPATIAL_FIELD_EMPTY_SPECS] Field '${this.fieldId}' must define at least one property specification.`);
    }

    for (const [propName, spec] of this.propertySpecs.entries()) {
      if (spec.propertyName !== propName) {
        throw new Error(`[SPATIAL_FIELD_SPEC_MISMATCH] Spec key '${propName}' does not match spec propertyName '${spec.propertyName}'.`);
      }
      if (spec.bounds.lower > spec.bounds.upper) {
        throw new Error(`[SPATIAL_FIELD_BOUNDS_ERROR] Property '${propName}' lower bound (${spec.bounds.lower}) exceeds upper bound (${spec.bounds.upper}).`);
      }
      if (propName === 'E' && spec.bounds.lower <= 0) {
        throw new Error(`[SPATIAL_FIELD_PHYSICAL_ERROR] Young's modulus E lower bound must be strictly positive: ${spec.bounds.lower}`);
      }
      if (propName === 'nu' && (spec.bounds.lower <= -1.0 || spec.bounds.upper >= 0.5)) {
        throw new Error(`[SPATIAL_FIELD_PHYSICAL_ERROR] Poisson's ratio nu bounds must lie in (-1.0, 0.5). Got [${spec.bounds.lower}, ${spec.bounds.upper}]`);
      }
      if (propName === 'density' && spec.bounds.lower <= 0) {
        throw new Error(`[SPATIAL_FIELD_PHYSICAL_ERROR] Density lower bound must be strictly positive: ${spec.bounds.lower}`);
      }
    }

    if (this.domain) {
      if (
        this.domain.min.x > this.domain.max.x ||
        this.domain.min.y > this.domain.max.y ||
        this.domain.min.z > this.domain.max.z
      ) {
        throw new Error(`[SPATIAL_FIELD_DOMAIN_ERROR] Invalid spatial domain bounding box: min exceeds max.`);
      }
    }
  }

  public hasProperty(prop: PropertyName): boolean {
    return this.propertySpecs.has(prop);
  }

  public getPropertySpec(prop: PropertyName): PropertyFieldSpec | undefined {
    return this.propertySpecs.get(prop);
  }

  public getDefinedProperties(): PropertyName[] {
    return Array.from(this.propertySpecs.keys());
  }

  public evaluate(coords: { x: number; y: number; z: number }): Record<PropertyName, number> {
    if (
      !Number.isFinite(coords.x) || Number.isNaN(coords.x) ||
      !Number.isFinite(coords.y) || Number.isNaN(coords.y) ||
      !Number.isFinite(coords.z) || Number.isNaN(coords.z)
    ) {
      throw new Error(`[SPATIAL_FIELD_INVALID_COORDS] Non-finite coordinate evaluated: ({${coords.x}, ${coords.y}, ${coords.z}})`);
    }

    let evalCoords = { ...coords };

    if (this.domain) {
      const isInside =
        coords.x >= this.domain.min.x && coords.x <= this.domain.max.x &&
        coords.y >= this.domain.min.y && coords.y <= this.domain.max.y &&
        coords.z >= this.domain.min.z && coords.z <= this.domain.max.z;

      if (!isInside) {
        if (this.outOfDomainBehavior === 'FAIL_CLOSED') {
          throw new Error(
            `[SPATIAL_FIELD_OUT_OF_DOMAIN] Coordinates ({${coords.x}, ${coords.y}, ${coords.z}}) lie outside spatial domain ` +
            `[(${this.domain.min.x},${this.domain.min.y},${this.domain.min.z}) - (${this.domain.max.x},${this.domain.max.y},${this.domain.max.z})].`
          );
        } else {
          // CLAMP behavior
          evalCoords = {
            x: Math.max(this.domain.min.x, Math.min(this.domain.max.x, coords.x)),
            y: Math.max(this.domain.min.y, Math.min(this.domain.max.y, coords.y)),
            z: Math.max(this.domain.min.z, Math.min(this.domain.max.z, coords.z))
          };
        }
      }
    }

    const result: Partial<Record<PropertyName, number>> = {};
    for (const [prop, spec] of this.propertySpecs.entries()) {
      const val = spec.expression(evalCoords);
      if (!Number.isFinite(val) || Number.isNaN(val)) {
        throw new Error(`[SPATIAL_FIELD_ERROR] Non-finite value evaluated for property '${prop}' at ({${evalCoords.x}, ${evalCoords.y}, ${evalCoords.z}}): ${val}`);
      }
      if (val < spec.bounds.lower || val > spec.bounds.upper) {
        throw new Error(`[SPATIAL_FIELD_BOUNDS_ERROR] Property '${prop}' evaluated value ${val} out of bounds [${spec.bounds.lower}, ${spec.bounds.upper}]`);
      }
      if (prop === 'E' && val <= 0) {
        throw new Error(`[SPATIAL_FIELD_PHYSICAL_ERROR] Young's modulus E must be strictly positive: ${val}`);
      }
      if (prop === 'nu' && (val <= -1.0 || val >= 0.5)) {
        throw new Error(`[SPATIAL_FIELD_PHYSICAL_ERROR] Poisson's ratio nu must be in (-1.0, 0.5): ${val}`);
      }
      if (prop === 'density' && val <= 0) {
        throw new Error(`[SPATIAL_FIELD_PHYSICAL_ERROR] Density must be strictly positive: ${val}`);
      }
      result[prop] = val;
    }
    return result as Record<PropertyName, number>;
  }

  public computeHash(): string {
    const specEntries = Array.from(this.propertySpecs.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, spec]) => ({
        propertyName: name,
        evaluationType: spec.evaluationType,
        bounds: spec.bounds,
        valueCategory: spec.valueCategory ?? 'TARGET',
        unit: spec.unit ?? '',
        manufacturingConstraints: spec.manufacturingConstraints
      }));

    const payload = {
      fieldId: this.fieldId,
      canonicalGeometryId: this.canonicalGeometryId,
      canonicalRevisionId: this.canonicalRevisionId,
      baseMaterialId: this.baseMaterialId,
      specs: specEntries,
      domain: this.domain,
      outOfDomainBehavior: this.outOfDomainBehavior,
      coordinateSystem: this.coordinateSystem
    };

    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  }

  public cloneWithRevision(newRevisionId: string): SpatialMaterialField {
    return new SpatialMaterialField(
      this.fieldId,
      this.canonicalGeometryId,
      newRevisionId,
      this.baseMaterialId,
      new Map(this.propertySpecs),
      this.domain,
      this.outOfDomainBehavior,
      this.coordinateSystem
    );
  }
}
