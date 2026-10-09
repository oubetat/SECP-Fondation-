/**
 * SECP CAD Kernel — Feature History Regenerator
 * Phase 2 (PATCH-022)
 *
 * ARCHITECTURAL CONTRACT:
 * - Deterministic, dependency-aware regeneration of the parametric history tree.
 * - Incremental invalidation: unchanged upstream features are preserved without redundant execution.
 * - Logical rollback capability without mutating history structure.
 * - Strict tolerance integration: passes explicit ToleranceContext to each feature execution.
 * - Explicit suppression handling and state transition tracking.
 */

import { FeatureNode, FeatureId } from './FeatureNode';
import { FeatureDependencyGraph } from './FeatureDependency';
import { FeatureHistoryValidator } from './FeatureHistoryValidator';
import { FeatureExecutor, FeatureExecutionContext } from './FeatureExecution';
import { FeatureStateMachine } from './FeatureState';
import { ToleranceContext, ToleranceOperation } from '../tolerance';

export interface RegenerationOptions {
  toleranceContext?: ToleranceContext;
  rollbackTargetId?: FeatureId;
  forceAll?: boolean;
}

export interface FeatureDiagnostic {
  featureId: FeatureId;
  type: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'UNSUPPORTED' | 'UNPROVEN';
  message: string;
}

export interface RegenerationResult {
  success: boolean;
  finalGeometry?: any;
  executedFeatureIds: FeatureId[];
  skippedFeatureIds: FeatureId[];
  failedFeatureIds: FeatureId[];
  diagnostics: FeatureDiagnostic[];
  totalFeatures: number;
}

export class FeatureRegenerator {
  /**
   * Regenerates the feature history tree deterministically.
   */
  public static regenerate(
    documentId: string,
    nodes: FeatureNode[],
    graph: FeatureDependencyGraph,
    options: RegenerationOptions = {}
  ): RegenerationResult {
    const diagnostics: FeatureDiagnostic[] = [];
    const executedFeatureIds: FeatureId[] = [];
    const skippedFeatureIds: FeatureId[] = [];
    const failedFeatureIds: FeatureId[] = [];

    // 1. Structural History Validation
    const validation = FeatureHistoryValidator.validateHistory(nodes, graph);
    if (!validation.isValid) {
      for (const err of validation.errors) {
        diagnostics.push({
          featureId: 'HISTORY_ROOT',
          type: 'VALIDATION',
          status: 'FAILED',
          message: err
        });
      }
      return {
        success: false,
        executedFeatureIds,
        skippedFeatureIds,
        failedFeatureIds,
        diagnostics,
        totalFeatures: nodes.length
      };
    }

    // 2. Resolve Deterministic Topological Execution Order
    let fullOrder: FeatureId[];
    try {
      fullOrder = graph.getTopologicalOrder();
    } catch (e: any) {
      diagnostics.push({
        featureId: 'TOPOLOGY_SORT',
        type: 'ORDERING',
        status: 'FAILED',
        message: e.message || 'Failed to determine topological order'
      });
      return {
        success: false,
        executedFeatureIds,
        skippedFeatureIds,
        failedFeatureIds,
        diagnostics,
        totalFeatures: nodes.length
      };
    }

    // 3. Apply Rollback Boundary if specified
    let targetOrder = fullOrder;
    if (options.rollbackTargetId) {
      const idx = fullOrder.indexOf(options.rollbackTargetId);
      if (idx === -1) {
        diagnostics.push({
          featureId: options.rollbackTargetId,
          type: 'ROLLBACK',
          status: 'FAILED',
          message: `Rollback target '${options.rollbackTargetId}' not found in execution order`
        });
        return {
          success: false,
          executedFeatureIds,
          skippedFeatureIds,
          failedFeatureIds,
          diagnostics,
          totalFeatures: nodes.length
        };
      }
      targetOrder = fullOrder.slice(0, idx + 1);
    }

    // 4. Prepare Execution Environment
    const nodeMap = new Map<FeatureId, FeatureNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    const resolvedOutputs = new Map<string, any>();
    let lastValidGeometry: any = undefined;

    const defaultTolerance: ToleranceContext = options.toleranceContext || {
      operation: ToleranceOperation.BOOLEAN,
      geometryScale: 1.0,
      unitSystem: 'mm',
      requestedTolerance: 1e-7,
      policy: 'STRICT_INDUSTRIAL'
    };

    // 5. Execute in Topological Order
    for (const featureId of targetOrder) {
      const feature = nodeMap.get(featureId)!;

      // Handle Feature Suppression
      if (feature.suppressed) {
        feature.state = 'SUPPRESSED';
        feature.regenerationStatus = 'SKIPPED';
        skippedFeatureIds.push(featureId);
        diagnostics.push({
          featureId,
          type: feature.type,
          status: 'SKIPPED',
          message: `Feature '${feature.name || featureId}' is suppressed`
        });
        continue;
      }

      // Check Incremental Execution:
      // If the feature is already VALID, not forced, and has valid output, reuse it.
      if (!options.forceAll && feature.state === 'VALID' && feature.outputGeometry !== undefined) {
        resolvedOutputs.set(featureId, feature.outputGeometry);
        lastValidGeometry = feature.outputGeometry;
        skippedFeatureIds.push(featureId);
        continue;
      }

      // Transition to REGENERATING
      const transitionToRegen = FeatureStateMachine.canTransition(
        feature.state,
        'REGENERATING',
        'EXECUTION_STARTED'
      );
      if (!transitionToRegen.allowed) {
        feature.state = 'FAILED';
        feature.regenerationStatus = 'FAILED';
        failedFeatureIds.push(featureId);
        diagnostics.push({
          featureId,
          type: feature.type,
          status: 'FAILED',
          message: transitionToRegen.errorMessage || 'Illegal state transition to REGENERATING'
        });
        return {
          success: false,
          executedFeatureIds,
          skippedFeatureIds,
          failedFeatureIds,
          diagnostics,
          totalFeatures: nodes.length
        };
      }
      feature.state = 'REGENERATING';

      // Check if required upstream inputs exist and are not suppressed
      let missingInput = false;
      for (const depId of feature.dependencyIds) {
        const depNode = nodeMap.get(depId);
        if (depNode && depNode.suppressed) {
          feature.state = 'FAILED';
          feature.regenerationStatus = 'FAILED';
          failedFeatureIds.push(featureId);
          diagnostics.push({
            featureId,
            type: feature.type,
            status: 'FAILED',
            message: `Upstream dependency '${depId}' is suppressed`
          });
          missingInput = true;
          break;
        }
      }
      if (missingInput) {
        return {
          success: false,
          executedFeatureIds,
          skippedFeatureIds,
          failedFeatureIds,
          diagnostics,
          totalFeatures: nodes.length
        };
      }

      // Execute Feature
      feature.markEvaluating();
      const execContext: FeatureExecutionContext = {
        documentId,
        toleranceContext: defaultTolerance,
        resolvedInputs: resolvedOutputs
      };

      const execResult = FeatureExecutor.execute(feature, execContext);

      if (execResult.status === 'SUCCESS') {
        feature.markValid(execResult.outputGeometry);
        resolvedOutputs.set(featureId, execResult.outputGeometry);
        lastValidGeometry = execResult.outputGeometry;
        executedFeatureIds.push(featureId);

        diagnostics.push({
          featureId,
          type: feature.type,
          status: 'SUCCESS',
          message: execResult.diagnostics.join('; ') || 'Regeneration succeeded'
        });
      } else {
        feature.markFailed();
        feature.state = execResult.status === 'UNSUPPORTED' ? 'INVALID' : 'FAILED';
        failedFeatureIds.push(featureId);

        diagnostics.push({
          featureId,
          type: feature.type,
          status: execResult.status,
          message: execResult.diagnostics.join('; ') || 'Execution failed'
        });

        // Abort on first failure to prevent cascading corruptions
        return {
          success: false,
          finalGeometry: lastValidGeometry,
          executedFeatureIds,
          skippedFeatureIds,
          failedFeatureIds,
          diagnostics,
          totalFeatures: nodes.length
        };
      }
    }

    return {
      success: true,
      finalGeometry: lastValidGeometry,
      executedFeatureIds,
      skippedFeatureIds,
      failedFeatureIds,
      diagnostics,
      totalFeatures: nodes.length
    };
  }
}
