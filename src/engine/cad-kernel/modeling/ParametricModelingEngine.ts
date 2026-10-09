/**
 * SECP CAD Kernel — Parametric Modeling Engine
 * Phase 2 (PATCH-029)
 */

import { FeatureHistory } from '../history/FeatureHistory';
import { FeatureNode, FeatureId } from '../history/FeatureNode';
import { FeatureType } from '../history/FeatureDefinition';
import { ParametricRegenerationEngine } from '../parametric/ParametricRegenerationEngine';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { ParametricEdit } from './ParametricEdit';

export interface ParametricExecutionResult {
  history: FeatureHistory;
  featureId: string;
  regenerationResult: any;
  beforeGeometryHash: string;
  afterGeometryHash: string;
  affectedEntities: string[];
  status: 'SUCCESS' | 'FAILED' | 'REGENERATION_REQUIRED' | 'CONFLICT';
  diagnostics: string[];
}

export class ParametricModelingEngine {
  /**
   * Executes a parametric operation on a feature history.
   */
  public static applyParametricEdit(
    history: FeatureHistory,
    edit: ParametricEdit,
    activeShape?: any
  ): ParametricExecutionResult {
    const diagnostics: string[] = [];
    const beforeHash = history.getHistoryHash();

    try {
      switch (edit.operation) {
        case 'CREATE_FEATURE': {
          if (!edit.featureType) {
            diagnostics.push('CREATE_FEATURE requires featureType');
            return this.buildFailureResult(history, edit, beforeHash, diagnostics);
          }

          const node = history.addFeature(
            edit.featureType as FeatureType,
            edit.featureId,
            {
              type: edit.featureType as FeatureType,
              name: edit.featureId,
              parameters: edit.parameterChanges || {},
              references: edit.inputReferences || []
            },
            edit.dependencies || [],
            undefined,
            edit.featureId
          );

          const regenResult = ParametricRegenerationEngine.regenerate(history, {
            modelId: history.documentId || 'MODEL_ID',
            rootChange: `CREATE_FEATURE_${node.id}`,
            currentModelRevision: 1,
            regenerationMode: 'FULL'
          });

          if (regenResult.finalStatus !== 'SUCCESS') {
            diagnostics.push(`Parametric regeneration failed after feature creation: ${regenResult.finalStatus}`);
            return {
              history,
              featureId: node.id,
              regenerationResult: regenResult,
              beforeGeometryHash: beforeHash,
              afterGeometryHash: beforeHash,
              affectedEntities: [],
              status: regenResult.finalStatus === 'CONSTRAINT_CONFLICT' ? 'CONFLICT' : 'FAILED',
              diagnostics
            };
          }

          const afterHash = history.getHistoryHash();
          return {
            history,
            featureId: node.id,
            regenerationResult: regenResult,
            beforeGeometryHash: beforeHash,
            afterGeometryHash: afterHash,
            affectedEntities: regenResult.recomputedFeatureIds || regenResult.affectedFeatures || [],
            status: 'SUCCESS',
            diagnostics
          };
        }

        case 'MODIFY_PARAMETERS': {
          const feature = history.getFeature(edit.featureId);
          if (!feature) {
            diagnostics.push(`Feature not found: ${edit.featureId}`);
            return this.buildFailureResult(history, edit, beforeHash, diagnostics);
          }

          const currentDef = feature.definition;
          const updatedDef = {
            ...currentDef,
            parameters: {
              ...(currentDef.parameters || {}),
              ...(edit.parameterChanges || {})
            }
          };

          history.updateFeatureDefinition(edit.featureId, updatedDef);

          const paramKeys = Object.keys(edit.parameterChanges || {});
          const firstKey = paramKeys[0] || 'maxX';
          const firstVal = paramKeys.length > 0 ? (edit.parameterChanges || {})[firstKey] : undefined;

          const regenResult = ParametricRegenerationEngine.regenerate(history, {
            modelId: history.documentId || 'MODEL_ID',
            rootChange: `MODIFY_PARAMETERS_${edit.featureId}`,
            changedEntityId: edit.featureId,
            targetParameter: firstKey,
            newValue: firstVal,
            currentModelRevision: 1,
            regenerationMode: 'FULL'
          });

          if (regenResult.finalStatus !== 'SUCCESS') {
            diagnostics.push(`Parametric regeneration failed after parameter modification: ${regenResult.finalStatus}`);
            return {
              history,
              featureId: edit.featureId,
              regenerationResult: regenResult,
              beforeGeometryHash: beforeHash,
              afterGeometryHash: beforeHash,
              affectedEntities: [],
              status: regenResult.finalStatus === 'CONSTRAINT_CONFLICT' ? 'CONFLICT' : 'FAILED',
              diagnostics
            };
          }

          const afterHash = history.getHistoryHash();
          return {
            history,
            featureId: edit.featureId,
            regenerationResult: regenResult,
            beforeGeometryHash: beforeHash,
            afterGeometryHash: afterHash,
            affectedEntities: regenResult.recomputedFeatureIds || regenResult.affectedFeatures || [],
            status: 'SUCCESS',
            diagnostics
          };
        }

        case 'SUPPRESS_FEATURE': {
          const feature = history.getFeature(edit.featureId);
          if (!feature) {
            diagnostics.push(`Feature not found: ${edit.featureId}`);
            return this.buildFailureResult(history, edit, beforeHash, diagnostics);
          }

          history.setSuppressed(edit.featureId, true);
          const regenResult = ParametricRegenerationEngine.regenerate(history, {
            modelId: history.documentId || 'MODEL_ID',
            rootChange: `SUPPRESS_FEATURE_${edit.featureId}`,
            changedEntityId: edit.featureId,
            newValue: true,
            currentModelRevision: 1,
            regenerationMode: 'FULL'
          });

          const afterHash = history.getHistoryHash();
          return {
            history,
            featureId: edit.featureId,
            regenerationResult: regenResult,
            beforeGeometryHash: beforeHash,
            afterGeometryHash: afterHash,
            affectedEntities: regenResult.recomputedFeatureIds || regenResult.affectedFeatures || [],
            status: regenResult.finalStatus === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
            diagnostics
          };
        }

        case 'UNSUPPRESS_FEATURE': {
          const feature = history.getFeature(edit.featureId);
          if (!feature) {
            diagnostics.push(`Feature not found: ${edit.featureId}`);
            return this.buildFailureResult(history, edit, beforeHash, diagnostics);
          }

          history.setSuppressed(edit.featureId, false);
          const regenResult = ParametricRegenerationEngine.regenerate(history, {
            modelId: history.documentId || 'MODEL_ID',
            rootChange: `UNSUPPRESS_FEATURE_${edit.featureId}`,
            changedEntityId: edit.featureId,
            newValue: false,
            currentModelRevision: 1,
            regenerationMode: 'FULL'
          });

          const afterHash = history.getHistoryHash();
          return {
            history,
            featureId: edit.featureId,
            regenerationResult: regenResult,
            beforeGeometryHash: beforeHash,
            afterGeometryHash: afterHash,
            affectedEntities: regenResult.recomputedFeatureIds || regenResult.affectedFeatures || [],
            status: regenResult.finalStatus === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
            diagnostics
          };
        }

        case 'REGENERATE_CHAIN': {
          const regenResult = ParametricRegenerationEngine.regenerate(history, {
            modelId: history.documentId || 'MODEL_ID',
            rootChange: 'REGENERATE_CHAIN',
            changedEntityId: 'ALL',
            newValue: true,
            currentModelRevision: 1,
            regenerationMode: 'FULL'
          });

          const afterHash = history.getHistoryHash();
          return {
            history,
            featureId: edit.featureId || 'ALL',
            regenerationResult: regenResult,
            beforeGeometryHash: beforeHash,
            afterGeometryHash: afterHash,
            affectedEntities: regenResult.recomputedFeatureIds || regenResult.affectedFeatures || [],
            status: regenResult.finalStatus === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
            diagnostics
          };
        }

        default: {
          diagnostics.push(`Unsupported parametric operation: ${edit.operation}`);
          return this.buildFailureResult(history, edit, beforeHash, diagnostics);
        }
      }
    } catch (err: any) {
      diagnostics.push(`Parametric edit exception: ${err?.message || String(err)}`);
      return this.buildFailureResult(history, edit, beforeHash, diagnostics);
    }
  }

  private static buildFailureResult(
    history: FeatureHistory,
    edit: ParametricEdit,
    hash: string,
    diagnostics: string[]
  ): ParametricExecutionResult {
    return {
      history,
      featureId: edit.featureId || 'UNKNOWN',
      regenerationResult: null,
      beforeGeometryHash: hash,
      afterGeometryHash: hash,
      affectedEntities: [],
      status: 'FAILED',
      diagnostics
    };
  }
}
