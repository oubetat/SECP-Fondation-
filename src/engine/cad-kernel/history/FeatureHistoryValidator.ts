/**
 * SECP CAD Kernel — Feature History Validator
 * Phase 2 (PATCH-022)
 *
 * ARCHITECTURAL CONTRACT:
 * - Validates complete feature history integrity before and during regeneration.
 * - Detects broken dependencies, duplicate IDs, self-dependencies, cycles, invalid references.
 * - Enforces parameter validity (no NaN / Infinity, valid bounds).
 */

import { FeatureNode } from './FeatureNode';
import { FeatureDependencyGraph, DependencyValidationResult } from './FeatureDependency';
import { FeatureExecutor } from './FeatureExecution';

export interface HistoryValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  dependencyResult: DependencyValidationResult;
  checkedFeaturesCount: number;
}

export class FeatureHistoryValidator {
  /**
   * Validates a collection of FeatureNodes and their dependency graph.
   */
  public static validateHistory(
    nodes: FeatureNode[],
    graph: FeatureDependencyGraph
  ): HistoryValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check for duplicate Feature IDs
    const seenIds = new Set<string>();
    for (const node of nodes) {
      if (seenIds.has(node.id)) {
        errors.push(`Duplicate Feature ID detected: '${node.id}'`);
      }
      seenIds.add(node.id);
    }

    // 2. Validate individual feature definitions and parameters
    for (const node of nodes) {
      if (!node.type) {
        errors.push(`Feature '${node.id}' has undefined or empty type`);
      }

      if (!node.definition) {
        errors.push(`Feature '${node.id}' is missing canonical definition`);
      }

      const paramCheck = FeatureExecutor.validateParameters(node.type, node.parameters);
      if (!paramCheck.isValid) {
        errors.push(`Feature '${node.id}' (${node.type}) parameter errors: ${paramCheck.errors.join('; ')}`);
      }

      // Check input references
      for (const ref of node.inputReferences) {
        if (!ref.targetFeatureId) {
          errors.push(`Feature '${node.id}' has input reference with missing targetFeatureId`);
        }
      }
    }

    // 3. Validate Dependency Graph (cycles, missing deps, self deps)
    const dependencyResult = graph.validate();
    if (!dependencyResult.isValid) {
      for (const issue of dependencyResult.issues) {
        errors.push(`Dependency issue: ${issue.message}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      dependencyResult,
      checkedFeaturesCount: nodes.length
    };
  }
}
