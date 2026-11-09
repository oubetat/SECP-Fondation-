/**
 * SECP Industrial OS — SpatialMaterialField
 * Represents a spatially varying material property field over geometry.
 */

export interface PropertyBounds {
  lower: number;
  upper: number;
}

export interface PropertySpec {
  propertyName: string;
  evaluationType: 'CONSTANT' | 'ANALYTIC_EXPRESSION' | 'TABULAR' | 'INTERPOLATED';
  expression: (coords: { x: number; y: number; z: number }) => number;
  bounds?: PropertyBounds;
}

export interface SpatialDomainBounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export class SpatialMaterialField {
  public readonly fieldId: string;
  public readonly geometryId: string;
  public readonly revisionId: string;
  public readonly baseMaterialId: string;
  public readonly properties: Map<string, PropertySpec>;
  public readonly domainBounds?: SpatialDomainBounds;
  public readonly outOfDomainBehavior: 'FAIL_CLOSED' | 'CLAMP';

  constructor(
    fieldId: string,
    geometryId: string,
    revisionId: string,
    baseMaterialId: string,
    properties: Map<string, PropertySpec>,
    domainBounds?: SpatialDomainBounds,
    outOfDomainBehavior: 'FAIL_CLOSED' | 'CLAMP' = 'FAIL_CLOSED'
  ) {
    if (!fieldId || !fieldId.trim()) {
      throw new Error('[SPATIAL_FIELD_INVALID_ID] Invalid or whitespace field ID during field construction');
    }

    this.fieldId = fieldId;
    this.geometryId = geometryId;
    this.revisionId = revisionId;
    this.baseMaterialId = baseMaterialId;
    this.properties = properties;
    this.domainBounds = domainBounds;
    this.outOfDomainBehavior = outOfDomainBehavior;

    // Validate physical constraints
    for (const [key, prop] of properties.entries()) {
      if (key === 'E' && prop.bounds && prop.bounds.lower < 0) {
        throw new Error('[SPATIAL_FIELD_PHYSICAL_ERROR] Physical property E cannot have negative lower bound');
      }
    }
  }

  public evaluate(coords: { x: number; y: number; z: number }): Record<string, number> {
    if (coords == null || isNaN(coords.x) || isNaN(coords.y) || isNaN(coords.z)) {
      throw new Error('[SPATIAL_FIELD_INVALID_COORDS] Coordinates contain NaN values');
    }

    if (!isFinite(coords.x) || !isFinite(coords.y) || !isFinite(coords.z)) {
      throw new Error('[SPATIAL_FIELD_INVALID_COORDS] Coordinates contain non-finite values');
    }

    let evalCoords = { ...coords };

    if (this.domainBounds) {
      const isOutside =
        evalCoords.x < this.domainBounds.min.x ||
        evalCoords.x > this.domainBounds.max.x ||
        evalCoords.y < this.domainBounds.min.y ||
        evalCoords.y > this.domainBounds.max.y ||
        evalCoords.z < this.domainBounds.min.z ||
        evalCoords.z > this.domainBounds.max.z;

      if (isOutside) {
        if (this.outOfDomainBehavior === 'CLAMP') {
          evalCoords.x = Math.max(this.domainBounds.min.x, Math.min(this.domainBounds.max.x, evalCoords.x));
          evalCoords.y = Math.max(this.domainBounds.min.y, Math.min(this.domainBounds.max.y, evalCoords.y));
          evalCoords.z = Math.max(this.domainBounds.min.z, Math.min(this.domainBounds.max.z, evalCoords.z));
        } else {
          throw new Error('[SPATIAL_FIELD_OUT_OF_DOMAIN] Coordinate evaluated outside defined spatial domain');
        }
      }
    }

    const result: Record<string, number> = {};

    for (const [propName, propSpec] of this.properties.entries()) {
      const val = propSpec.expression(evalCoords);

      if (isNaN(val) || !isFinite(val)) {
        throw new Error(`[SPATIAL_FIELD_ERROR] Property ${propName} evaluation returned non-finite value: ${val}`);
      }

      if (propSpec.bounds) {
        if (val < propSpec.bounds.lower || val > propSpec.bounds.upper) {
          throw new Error(
            `[SPATIAL_FIELD_BOUNDS_ERROR] Property ${propName} evaluated to ${val}, which violates bounds [${propSpec.bounds.lower}, ${propSpec.bounds.upper}]`
          );
        }
      }

      result[propName] = val;
    }

    return result;
  }

  public getDefinedProperties(): string[] {
    return Array.from(this.properties.keys());
  }

  public getPropertySpec(propertyName: string): PropertySpec | undefined {
    return this.properties.get(propertyName);
  }
}

