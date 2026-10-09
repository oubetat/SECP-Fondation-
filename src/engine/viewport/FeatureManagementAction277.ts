/**
 * PATCH-SECP-PROMPT-013: Feature Management Canonical Action
 * Implementation of Suppress, Delete, and Update operations.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { CanonicalDocumentUIAdapter } from '../cad-kernel/ui/CanonicalDocumentUIAdapter';
import { 
  SuppressFeatureIntent, 
  DeleteFeatureIntent, 
  UpdateParamIntent, 
  DispatchResult,
  AnyEngineeringIntent 
} from './EngineeringIntent277';
import { CanonicalAction } from './CanonicalAction277';

export class FeatureManagementAction277 implements CanonicalAction<AnyEngineeringIntent> {
  public readonly actionId = 'CanonicalDocumentUIAdapter.manage';

  public async execute(intent: AnyEngineeringIntent, document: EngineeringDocument): Promise<DispatchResult> {
    let result: any;
    let evalRes: any;

    if (intent.toolId === 'FEATURE_SUPPRESS') {
      const suppressIntent = intent as SuppressFeatureIntent;
      // Note: executeSuppressFeature returns { result, evaluation }
      const { result: uiResult, evaluation } = CanonicalDocumentUIAdapter.executeSuppressFeature(document, suppressIntent.parameters.featureId);
      result = uiResult;
      evalRes = evaluation;
    } else if (intent.toolId === 'FEATURE_DELETE') {
      const deleteIntent = intent as DeleteFeatureIntent;
      const { result: uiResult, evaluation } = CanonicalDocumentUIAdapter.executeDeleteFeature(document, deleteIntent.parameters.featureId);
      result = uiResult;
      evalRes = evaluation;
    } else if (intent.toolId === 'FEATURE_UPDATE_PARAM') {
      const updateIntent = intent as UpdateParamIntent;
      const paramId = updateIntent.parameters.paramId || (updateIntent.parameters as any).paramName || 'depth';
      const value = updateIntent.parameters.value ?? (updateIntent.parameters as any).paramValue ?? 40;
      const { result: uiResult, evaluation } = CanonicalDocumentUIAdapter.executeUpdateFeatureParameter(
        document, 
        updateIntent.parameters.featureId,
        paramId,
        value
      );
      result = uiResult;
      evalRes = evaluation;
    } else {
      throw new Error(`UNSUPPORTED_MANAGEMENT_INTENT: ${intent.toolId}`);
    }

    return {
      success: result.success,
      documentId: document.documentId,
      revision: typeof result.documentRevision === 'string' ? parseInt(result.documentRevision, 10) : result.documentRevision,
      canonicalActionId: `CanonicalDocumentUIAdapter.${intent.toolId}`,
      affectedEntities: [result.featureId || 'UNKNOWN'],
      document: evalRes?.document,
      evaluationResult: evalRes,
      error: result.success ? undefined : (result.error || evalRes?.error || (evalRes?.diagnostics && evalRes.diagnostics.length > 0 ? evalRes.diagnostics.join('; ') : 'Feature update failed'))
    };
  }
}
