/**
 * SECP Industrial OS — Physical Reality Origin Semantics
 * POST-PLUGIN-MATURITY-008R (Part A & B)
 *
 * Enforces strict epistemological origin semantics across digital design,
 * additive manufacturing, physical metrology, and reverse engineering.
 */

export enum PhysicalOriginType {
  DESIGNED = 'DESIGNED',
  MEASURED = 'MEASURED',
  MANUFACTURED = 'MANUFACTURED',
  RECONSTRUCTED = 'RECONSTRUCTED',
  REVERSE_ENGINEERED = 'REVERSE_ENGINEERED',
  IMPORTED = 'IMPORTED',
  INFERRED = 'INFERRED',
  ASSUMED = 'ASSUMED',
  CANONICAL = 'CANONICAL'
}

export interface OriginTag {
  readonly origin: PhysicalOriginType;
  readonly confidence: number; // 0.0 to 1.0 (1.0 for measured/canonical)
  readonly sourceIdentity: string;
  readonly createdAt: string;
  readonly basisStatement: string;
  readonly deviceOrMethod?: string;
  readonly calibrationCertificateId?: string;
  readonly measurementUncertaintyMm?: number;
}

export class PhysicalOriginSemantics {
  /**
   * Validates that an origin transition adheres to epistemological conservation rules.
   * Prevents promotion of INFERRED -> MEASURED, RECONSTRUCTED -> DESIGNED without proper canonicalization.
   */
  public static validateOriginTransition(
    fromOrigin: PhysicalOriginType,
    toOrigin: PhysicalOriginType,
    isAuthoritativeDecision: boolean = false
  ): { allowed: boolean; violationReason?: string } {
    // 1. Inferred geometry can NEVER be claimed as measured geometry
    if (fromOrigin === PhysicalOriginType.INFERRED && toOrigin === PhysicalOriginType.MEASURED) {
      return {
        allowed: false,
        violationReason: 'EPISTEMOLOGICAL_VIOLATION: Inferred geometry cannot be promoted to measured reality.'
      };
    }

    // 2. Measured reality cannot be labelled as design intent
    if (fromOrigin === PhysicalOriginType.MEASURED && toOrigin === PhysicalOriginType.DESIGNED) {
      return {
        allowed: false,
        violationReason: 'EPISTEMOLOGICAL_VIOLATION: Measured as-built geometry cannot overwrite or masquerade as design intent.'
      };
    }

    // 3. Reconstructed geometry cannot claim to be original design without authoritative engineering acceptance
    if (fromOrigin === PhysicalOriginType.RECONSTRUCTED && toOrigin === PhysicalOriginType.DESIGNED && !isAuthoritativeDecision) {
      return {
        allowed: false,
        violationReason: 'EPISTEMOLOGICAL_VIOLATION: Reconstructed geometry requires explicit authoritative engineering revision approval to become canonical design.'
      };
    }

    // 4. Assumed geometry cannot be promoted to measured
    if (fromOrigin === PhysicalOriginType.ASSUMED && toOrigin === PhysicalOriginType.MEASURED) {
      return {
        allowed: false,
        violationReason: 'EPISTEMOLOGICAL_VIOLATION: Assumed engineering parameters cannot be labelled as measured facts.'
      };
    }

    return { allowed: true };
  }

  /**
   * Creates an immutable origin tag.
   */
  public static createOriginTag(
    origin: PhysicalOriginType,
    sourceIdentity: string,
    basisStatement: string,
    options: {
      confidence?: number;
      deviceOrMethod?: string;
      calibrationCertificateId?: string;
      measurementUncertaintyMm?: number;
    } = {}
  ): OriginTag {
    const confidence = options.confidence ?? (
      origin === PhysicalOriginType.MEASURED || origin === PhysicalOriginType.CANONICAL ? 1.0 :
      origin === PhysicalOriginType.RECONSTRUCTED ? 0.95 :
      origin === PhysicalOriginType.INFERRED ? 0.70 :
      origin === PhysicalOriginType.ASSUMED ? 0.50 : 0.90
    );

    return Object.freeze({
      origin,
      confidence,
      sourceIdentity,
      createdAt: new Date().toISOString(),
      basisStatement,
      deviceOrMethod: options.deviceOrMethod,
      calibrationCertificateId: options.calibrationCertificateId,
      measurementUncertaintyMm: options.measurementUncertaintyMm
    });
  }
}
