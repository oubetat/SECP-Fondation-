/**
 * SECP Industrial OS v2 — AP242 Reference Validator
 * PATCH-036/PATCH-329B: AP242 Reference Validator
 */

import { StepEntity } from '../../step-ap242/StepAp242Types';
import { isStepRef, getRefId } from '../../step-ap242/StepAp242Parser';
import { AP242ValidationIssue } from '../AP242ValidationTypes';

export class AP242ReferenceValidator {
  public static validate(entities: Map<number, StepEntity>, issues: AP242ValidationIssue[], rawContent?: string): boolean {
    let valid = true;

    for (const [id, entity] of entities) {
      for (const param of entity.parameters) {
        this.checkParam(param, id, entities, issues, () => valid = false);
      }
    }

    return valid;
  }

  private static checkParam(
    param: any,
    entityId: number,
    entities: Map<number, StepEntity>,
    issues: AP242ValidationIssue[],
    setInvalid: () => void
  ) {
    const refId = getRefId(param);
    if (refId !== undefined) {
      if (!entities.has(refId)) {
        issues.push({
          code: 'AP242-DANGLING-REFERENCE',
          severity: 'CRITICAL',
          category: 'REFERENCE',
          entityId: String(entityId),
          message: `Entity #${entityId} references non-existent entity #${refId}`
        });
        setInvalid();
      }
    } else if (Array.isArray(param)) {
      for (const sub of param) {
        this.checkParam(sub, entityId, entities, issues, setInvalid);
      }
    }
  }
}
