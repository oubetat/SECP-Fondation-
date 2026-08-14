import { ShapeHandle } from './ShapeHandle';
import { ValidationResult } from './GeometryTypes';
import { GeometryValidationEngine, GeometryValidationReport } from '../validation/GeometryValidationEngine';

export { GeometryValidationEngine };
export type { GeometryValidationReport };

export class GeometryValidator {
  /**
   * Centralized exhaustive validation report delegating to GeometryValidationEngine
   */
  static async validate(shape: ShapeHandle): Promise<GeometryValidationReport> {
    return GeometryValidationEngine.validate(shape);
  }

  /**
   * High-level B-Rep validation
   */
  static async validateBRep(shape: ShapeHandle): Promise<ValidationResult> {
    const report = await GeometryValidationEngine.validate(shape);
    return {
      isValid: report.isValid,
      messages: report.passedChecks.concat(report.errors),
      topologyErrors: report.anomalies.details,
      geometricErrors: report.errors
    };
  }

  /**
   * Verifies if the shape is a closed solid
   */
  static async validateSolid(shape: ShapeHandle): Promise<boolean> {
    const report = await GeometryValidationEngine.validate(shape);
    return report.topology.solidCount > 0 && report.isValid;
  }

  /**
   * Checks topology consistency
   */
  static async validateTopology(shape: ShapeHandle): Promise<boolean> {
    const report = await GeometryValidationEngine.validate(shape);
    return (
      report.topology.vertexCount > 0 &&
      report.topology.edgeCount > 0 &&
      report.topology.faceCount > 0
    );
  }

  /**
   * Validates mass properties are physical
   */
  static async validateMassProperties(shape: ShapeHandle): Promise<boolean> {
    const report = await GeometryValidationEngine.validate(shape);
    return report.metrics.volume > 0 && report.metrics.surfaceArea > 0;
  }

  /**
   * Validates bounding box sanity
   */
  static async validateBoundingBox(shape: ShapeHandle): Promise<boolean> {
    const report = await GeometryValidationEngine.validate(shape);
    const bbox = report.metrics.boundingBox;
    const dx = bbox.max.x - bbox.min.x;
    const dy = bbox.max.y - bbox.min.y;
    const dz = bbox.max.z - bbox.min.z;
    return dx >= 0 && dy >= 0 && dz >= 0 && (dx + dy + dz) > 0;
  }
}
