/**
 * SECP Industrial OS v2 — AP242 Header Validator
 * PATCH-036: AP242 Validation
 */

import { StepHeader } from '../../step-ap242/StepAp242Types';
import { AP242ValidationIssue } from '../AP242ValidationTypes';

export class AP242HeaderValidator {
  public static validate(header: StepHeader, issues: AP242ValidationIssue[]): boolean {
    let valid = true;

    if (!header.fileSchema || header.fileSchema.length === 0) {
      issues.push({
        code: 'AP242-MISSING-SCHEMA',
        severity: 'ERROR',
        category: 'SCHEMA',
        message: 'FILE_SCHEMA is missing or empty'
      });
      valid = false;
    } else {
      const schemaStr = header.fileSchema[0] || '';
      if (!schemaStr.includes('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF')) {
        issues.push({
          code: 'AP242-UNSUPPORTED-SCHEMA',
          severity: 'ERROR', // Or WARNING if we allow partial, but spec says we want strict checks
          category: 'SCHEMA',
          message: `Expected AP242 schema, found: ${schemaStr}`
        });
        valid = false;
      }
    }

    if (!header.fileName) {
      issues.push({
        code: 'AP242-MISSING-FILENAME',
        severity: 'WARNING',
        category: 'HEADER',
        message: 'FILE_NAME is missing'
      });
    }

    return valid;
  }
}
