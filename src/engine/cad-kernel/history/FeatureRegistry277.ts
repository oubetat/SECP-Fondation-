/**
 * PATCH-PROMPT-014: Canonical Feature Evaluation Registry
 * Formalizes the mapping between Feature Types and their Kernel Evaluators.
 */

import { FeatureType } from './FeatureDefinition';
import { FeatureNode } from './FeatureNode';
import { FeatureExecutionContext, FeatureExecutionResult } from './FeatureExecution';

export type FeatureEvaluatorFn = (
  feature: FeatureNode,
  context: FeatureExecutionContext
) => FeatureExecutionResult;

export class FeatureRegistry277 {
  private static registry: Map<FeatureType, FeatureEvaluatorFn> = new Map();

  /**
   * Registers a canonical evaluator for a specific feature type.
   */
  public static register(type: FeatureType, evaluator: FeatureEvaluatorFn): void {
    this.registry.set(type, evaluator);
  }

  /**
   * Dispatches execution to the registered evaluator.
   */
  public static evaluate(
    feature: FeatureNode,
    context: FeatureExecutionContext
  ): FeatureExecutionResult {
    const evaluator = this.registry.get(feature.type);
    if (!evaluator) {
      return {
        status: 'UNSUPPORTED',
        diagnostics: [`No registered evaluator found for feature type '${feature.type}'`],
        dependenciesUsed: feature.dependencyIds,
        toleranceContext: context.toleranceContext
      };
    }
    return evaluator(feature, context);
  }

  /**
   * Checks if a feature type has a registered canonical route.
   */
  public static hasRoute(type: FeatureType): boolean {
    return this.registry.has(type);
  }
}
