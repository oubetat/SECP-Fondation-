/**
 * SECP Industrial OS — EPC-018: Product Architecture Serializer
 * Serializes, deserializes, and formats Product Architecture models to JSON, JSON-LD,
 * and canonical audit representations.
 */

import { ProductArchitecture, ProductArchitectureValidationError } from './ProductArchitectureTypes';
import { ProductArchitectureValidator } from './ProductArchitectureValidator';

export class ProductArchitectureSerializer {
  /**
   * Serializes a ProductArchitecture to a formatted JSON string.
   */
  public static toJSON(arch: ProductArchitecture, pretty = true): string {
    return JSON.stringify(arch, null, pretty ? 2 : undefined);
  }

  /**
   * Deserializes a JSON string into a validated ProductArchitecture.
   */
  public static fromJSON(jsonStr: string): ProductArchitecture {
    try {
      const parsed = JSON.parse(jsonStr);
      return ProductArchitectureValidator.validateArchitecture(parsed);
    } catch (err: any) {
      if (err instanceof ProductArchitectureValidationError) {
        throw err;
      }
      throw new ProductArchitectureValidationError(
        `Failed to parse ProductArchitecture JSON: ${err.message}`,
        'JSON_PARSE_ERROR'
      );
    }
  }

  /**
   * Serializes to JSON-LD semantic structure for digital thread interchange.
   */
  public static toJSONLD(arch: ProductArchitecture): Record<string, unknown> {
    return {
      '@context': 'https://secp.industrial.os/schema/epc018/v1',
      '@type': 'ProductArchitecture',
      '@id': `urn:secp:architecture:${arch.architectureId}`,
      productId: arch.productId,
      productName: arch.productName,
      productType: arch.productType,
      revision: arch.revision,
      variantCode: arch.variantCode,
      subsystems: arch.subsystems.map(s => ({
        '@type': 'Subsystem',
        subsystemId: s.subsystemId,
        category: s.category,
        totalMassKg: s.totalMassKg,
        componentsCount: s.components.length
      })),
      interfacesCount: arch.interfaces.length,
      provenanceHash: arch.provenanceHash
    };
  }
}
