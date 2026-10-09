/**
 * PATCH-195: Feature Reorder Validator
 * Strictly validates that reordering features in the Feature Tree preserves
 * mathematical causality, topological ordering, geometric references, and acyclicity.
 */

import { ParametricFeature, FeatureReorderValidationResult } from './ParametricFeatureTypes';
import { FeatureDependencyGraph } from './FeatureDependencyGraph';

export class FeatureReorderValidator {
  /**
   * Validates whether moving a feature from its current position to targetIndex
   * is mathematically and topologically legal.
   */
  public static validateReorder(
    featureId: string,
    targetIndex: number,
    currentOrder: string[],
    featuresMap: Map<string, ParametricFeature>,
    dependencyGraph?: FeatureDependencyGraph
  ): FeatureReorderValidationResult {
    const currentIndex = currentOrder.indexOf(featureId);
    if (currentIndex === -1) {
      return {
        valid: false,
        reason: `Feature '${featureId}' does not exist in the current feature tree order.`
      };
    }

    if (targetIndex < 0 || targetIndex >= currentOrder.length) {
      return {
        valid: false,
        reason: `Target index ${targetIndex} is out of bounds [0, ${currentOrder.length - 1}].`
      };
    }

    if (currentIndex === targetIndex) {
      return {
        valid: true,
        targetIndex,
        proposedOrder: [...currentOrder]
      };
    }

    const feature = featuresMap.get(featureId);
    if (!feature) {
      return {
        valid: false,
        reason: `Feature definition '${featureId}' not found.`
      };
    }

    // Proposed new order
    const proposedOrder = [...currentOrder];
    proposedOrder.splice(currentIndex, 1);
    proposedOrder.splice(targetIndex, 0, featureId);
    const newPos = proposedOrder.indexOf(featureId);

    // 1. Direct and Transitive Upstream Dependencies Check
    // If moving EARLIER, check that all dependencies (parents/inputs) remain BEFORE newPos
    const allDependencies = new Set<string>([
      ...(feature.dependencies || []),
      ...(feature.parentFeatures || []),
      ...(feature.parentFeatureId ? [feature.parentFeatureId] : []),
      ...(feature.inputReferences || [])
    ]);

    // Add transitive upstream if graph is provided
    if (dependencyGraph) {
      const ancestors = dependencyGraph.getAncestors(featureId);
      for (const anc of ancestors) allDependencies.add(anc);
    }

    for (const depId of allDependencies) {
      const depPosInProposed = proposedOrder.indexOf(depId);
      if (depPosInProposed !== -1 && newPos <= depPosInProposed) {
        const depFeat = featuresMap.get(depId);
        const depName = depFeat ? depFeat.name : depId;
        return {
          valid: false,
          reason: `Violates dependency ordering: Feature '${feature.name}' (${featureId}) cannot be placed at index ${targetIndex} because its required upstream dependency '${depName}' (${depId}) appears at or after it (index ${depPosInProposed}).`,
          violatingDependencies: [depId],
          targetIndex,
          proposedOrder
        };
      }
    }

    // 2. Direct and Transitive Downstream Dependents Check
    // If moving LATER, check that all dependents (children) remain AFTER newPos
    const allDependents = new Set<string>([
      ...(feature.dependents || []),
      ...(feature.childFeatures || [])
    ]);

    if (dependencyGraph) {
      const descendants = dependencyGraph.getDescendants(featureId);
      for (const desc of descendants) allDependents.add(desc);
    }

    for (const depId of allDependents) {
      const depPosInProposed = proposedOrder.indexOf(depId);
      if (depPosInProposed !== -1 && newPos >= depPosInProposed) {
        const depFeat = featuresMap.get(depId);
        const depName = depFeat ? depFeat.name : depId;
        return {
          valid: false,
          reason: `Violates causality: Feature '${feature.name}' (${featureId}) cannot be moved after its dependent child '${depName}' (${depId}) at index ${depPosInProposed}.`,
          violatingDependencies: [depId],
          targetIndex,
          proposedOrder
        };
      }
    }

    // 3. Global Topological Consistency Check on Proposed Order
    for (let i = 0; i < proposedOrder.length; i++) {
      const currentFeatId = proposedOrder[i];
      const feat = featuresMap.get(currentFeatId);
      if (!feat) continue;

      for (const depId of feat.dependencies || []) {
        const depIdx = proposedOrder.indexOf(depId);
        if (depIdx !== -1 && depIdx >= i) {
          return {
            valid: false,
            reason: `Topological ordering conflict in proposed arrangement between '${feat.name}' and '${depId}'.`,
            violatingDependencies: [depId],
            targetIndex,
            proposedOrder
          };
        }
      }
    }

    return {
      valid: true,
      targetIndex,
      proposedOrder
    };
  }
}
