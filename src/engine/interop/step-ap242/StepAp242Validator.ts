/**
 * SECP Industrial OS v2 — STEP AP242 Validator
 * PATCH-034/PATCH-329B: STEP AP242 Validator
 */

import { StepParsedFile, StepValidationResult } from './StepAp242Types';
import { isStepRef, getRefId } from './StepAp242Parser';

export class StepAp242Validator {
  public static validate(parsed: StepParsedFile, sourceHash: string): StepValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Schema Validation
    const schema = parsed.header.fileSchema[0] || '';
    if (!schema || (!schema.includes('242') && !schema.includes('AP242'))) {
      errors.push(`INVALID_SCHEMA: Schema '${schema}' is not AP242 compliant`);
    }

    // 2. Reference Integrity & Required Parameters Checking
    let referenceIntegrity = true;
    for (const [id, entity] of Array.from(parsed.data.entities.entries())) {
      // Check parameter completeness for core B-Rep entities
      if (entity.type === 'MANIFOLD_SOLID_BREP' && (entity.parameters.length < 2 || !entity.parameters[1])) {
        errors.push(`INCOMPLETE_ENTITY_PARAMETERS: Entity #${id} (${entity.type}) missing required shell parameter`);
        referenceIntegrity = false;
      }
      this.checkParamReferences(entity.parameters, id, entity.type, parsed.data.entities, errors, () => {
        referenceIntegrity = false;
      });
    }

    // 3. Header Checks
    if (!parsed.header.fileName) warnings.push('MISSING_HEADER: FILE_NAME is empty');
    if (!parsed.header.timeStamp) warnings.push('MISSING_HEADER: FILE_NAME timestamp is empty');

    return {
      status: errors.length > 0 ? 'INVALID' : 'VALID',
      errors,
      warnings,
      schema,
      entityCount: parsed.data.entities.size,
      referenceIntegrity,
      sourceHash
    };
  }

  private static checkParamReferences(
    param: any,
    entityId: number,
    entityType: string,
    entities: Map<number, any>,
    errors: string[],
    onFailure: () => void
  ) {
    if (isStepRef(param)) {
      if (!entities.has(param.ref)) {
        errors.push(`DANGLING_REFERENCE: Entity #${entityId} (${entityType}) references non-existent #${param.ref}`);
        onFailure();
      }
    } else if (typeof param === 'number' && Number.isInteger(param) && param > 0) {
      // For backwards compatibility or legacy numeric ref parameters on topological entities
      if (this.isLikelyReferenceType(entityType) && !entities.has(param)) {
        errors.push(`DANGLING_REFERENCE: Entity #${entityId} (${entityType}) references non-existent #${param}`);
        onFailure();
      }
    } else if (Array.isArray(param)) {
      for (const sub of param) {
        this.checkParamReferences(sub, entityId, entityType, entities, errors, onFailure);
      }
    }
  }

  private static isLikelyReferenceType(type: string): boolean {
    const refTypes = [
      'MANIFOLD_SOLID_BREP', 'CLOSED_SHELL', 'OPEN_SHELL', 'ADVANCED_FACE',
      'FACE_BOUND', 'FACE_OUTER_BOUND', 'EDGE_LOOP', 'ORIENTED_EDGE', 'EDGE_CURVE', 'VERTEX_POINT',
      'PRODUCT_DEFINITION_SHAPE', 'SHAPE_DEFINITION_REPRESENTATION',
      'SHAPE_REPRESENTATION', 'NEXT_ASSEMBLY_USAGE_OCCURRENCE'
    ];
    return refTypes.includes(type);
  }
}
