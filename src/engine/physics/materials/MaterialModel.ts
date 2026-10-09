/**
 * SECP Industrial OS v2 — Material Model Core
 * PATCH-044: Material Model
 */

import { 
  MaterialRepresentation, 
  MaterialState, 
  EvaluatedMaterialProperty, 
  MaterialProperty 
} from './MaterialTypes';
import { Quantity } from '../units/Quantity';
import * as crypto from 'crypto';

export class MaterialModel {
  constructor(
    public readonly representation: MaterialRepresentation
  ) {}

  public get identity() {
    return this.representation.identity;
  }

  public get properties() {
    return this.representation.properties;
  }

  public hasProperty(propertyId: string): boolean {
    return propertyId in this.representation.properties;
  }

  public getProperty(propertyId: string): MaterialProperty {
    if (!this.hasProperty(propertyId)) {
      throw new Error(`Property ${propertyId} is UNPROVEN for material ${this.identity.canonicalName}`);
    }
    return this.representation.properties[propertyId];
  }

  /**
   * Evaluates a material property at a given state.
   */
  public evaluateProperty(propertyId: string, state?: MaterialState): Quantity {
    const prop = this.getProperty(propertyId);
    
    // Check validity range if state is provided
    if (state && prop.validityRange) {
      if (prop.validityRange.minState?.temperature && state.temperature) {
        if (state.temperature.value < prop.validityRange.minState.temperature.convertTo(state.temperature.unit).value) {
          throw new Error(`State temperature ${state.temperature.toString()} is below validity range for ${propertyId}`);
        }
      }
      if (prop.validityRange.maxState?.temperature && state.temperature) {
        if (state.temperature.value > prop.validityRange.maxState.temperature.convertTo(state.temperature.unit).value) {
          throw new Error(`State temperature ${state.temperature.toString()} is above validity range for ${propertyId}`);
        }
      }
    }

    if (prop.model.type === 'CONSTANT') {
      return prop.model.value;
    } else if (prop.model.type === 'TABLE') {
      // Very basic linear interpolation for TEMPERATURE
      if (prop.model.independentVariable === 'TEMPERATURE' && state?.temperature) {
        return this.interpolateTable(prop.model, state.temperature);
      }
      throw new Error(`Table evaluation for ${prop.model.independentVariable} not fully implemented without proper state mapping`);
    } else {
      throw new Error(`Function evaluation for property ${propertyId} is UNPROVEN`);
    }
  }

  private interpolateTable(model: any, input: Quantity): Quantity {
    const points = model.points;
    if (points.length === 0) throw new Error('Table model has no points');
    if (points.length === 1) return points[0].output;

    // Convert input to points[0].input unit for comparison
    const x = input.convertTo(points[0].input.unit).value;
    
    // Assume points are sorted by input value
    if (x <= points[0].input.value) return points[0].output;
    if (x >= points[points.length - 1].input.value) return points[points.length - 1].output;

    for (let i = 0; i < points.length - 1; i++) {
      const x0 = points[i].input.value;
      const x1 = points[i+1].input.value;
      if (x >= x0 && x <= x1) {
        const y0 = points[i].output.value;
        const y1 = points[i+1].output.convertTo(points[i].output.unit).value;
        const y = y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
        return new Quantity(y, points[i].output.unit);
      }
    }

    throw new Error('Interpolation failed');
  }

  /**
   * Generates a deterministic fingerprint based on the canonical representation of the material.
   */
  public generateFingerprint(): string {
    const canonicalObject = this.toCanonicalForm(this.representation);
    const serialized = JSON.stringify(canonicalObject);
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  private toCanonicalForm(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      if (typeof obj === 'number') {
        if (isNaN(obj)) return '__NAN__';
        if (obj === Infinity) return '__INF__';
        if (obj === -Infinity) return '__NEG_INF__';
      }
      return obj;
    }

    if (obj instanceof Quantity) {
      return {
        value: obj.value,
        unit: obj.unit.id,
        dimension: obj.dimension.vector
      };
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.toCanonicalForm(item));
    }

    const sortedObj: any = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      // Exclude ephemeral or non-physical metadata
      if (key === 'metadata') continue; 
      sortedObj[key] = this.toCanonicalForm(obj[key]);
    }
    return sortedObj;
  }
}
