/**
 * SECP Industrial OS v2 — AP242 Consistency Validator
 * PATCH-036/PATCH-329B: AP242 Consistency Validator
 */

import { StepParsedFile } from '../../step-ap242/StepAp242Types';
import { getRefId } from '../../step-ap242/StepAp242Parser';
import { AP242ValidationIssue } from '../AP242ValidationTypes';

export class AP242ConsistencyValidator {
  public static validate(parsed: StepParsedFile, issues: AP242ValidationIssue[]): { 
    relationships: boolean, 
    geometry: boolean, 
    topology: boolean, 
    pmi: boolean,
    overall: boolean
  } {
    let relValid = true;
    let geoValid = true;
    let topoValid = true;
    let pmiValid = true;

    for (const [id, entity] of parsed.data.entities) {
      if (entity.type === 'CARTESIAN_POINT') {
        const coords = entity.parameters[1] as any[];
        if (coords && Array.isArray(coords)) {
          for (const coord of coords) {
            if (typeof coord !== 'number' || !isFinite(coord) || isNaN(coord)) {
              issues.push({
                code: 'AP242-INVALID-GEOMETRY-COORDINATE',
                severity: 'CRITICAL',
                category: 'GEOMETRY',
                entityId: String(id),
                message: `Invalid coordinate value (NaN/Infinity or non-numeric) in CARTESIAN_POINT`
              });
              geoValid = false;
            }
          }
        }
      }

      if (entity.type === 'VERTEX_POINT') {
        const ptRef = entity.parameters[1];
        const ptId = getRefId(ptRef);
        if (ptId !== undefined) {
           const ptEntity = parsed.data.entities.get(ptId);
           if (!ptEntity || ptEntity.type !== 'CARTESIAN_POINT') {
              issues.push({
                code: 'AP242-TOPOLOGY-MISMATCH',
                severity: 'ERROR',
                category: 'TOPOLOGY',
                entityId: String(id),
                message: `VERTEX_POINT must reference a CARTESIAN_POINT, got ${ptEntity?.type || 'missing'}`
              });
              topoValid = false;
           }
        }
      }

      if (entity.type === 'GEOMETRIC_TOLERANCE_WITH_DATUM_REFERENCE') {
        const datums = entity.parameters[6];
        if (!datums || (typeof datums === 'string' && datums.trim() === '')) {
          issues.push({
            code: 'AP242-PMI-INVALID-DATUM-REF',
            severity: 'ERROR',
            category: 'PMI',
            entityId: String(id),
            message: `PMI GD&T missing datum references`
          });
          pmiValid = false;
        }
      }
    }

    return {
      relationships: relValid,
      geometry: geoValid,
      topology: topoValid,
      pmi: pmiValid,
      overall: relValid && geoValid && topoValid && pmiValid
    };
  }
}
