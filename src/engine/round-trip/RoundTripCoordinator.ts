/**
 * SECP Industrial OS v3 — PROMPT-055: UI-to-Backend Round Trip
 * Coordinator for executing and tracking the full Canonical Round Trip:
 * UI Action -> Intent -> Canonical Action -> Kernel Execution -> Engineering Result -> Validation -> Sync Projection -> UI Truth.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { AnyEngineeringIntent } from '../viewport/EngineeringIntent277';
import { CanonicalIntentDispatcher277 } from '../viewport/CanonicalIntentDispatcher277';
import { StateSyncEngine } from '../sync/StateSyncEngine';
import { DocumentEvaluator } from '../cad-kernel/document/DocumentEvaluator';
import { randomUUID } from 'crypto';

export interface RoundTripEvidence {
  testId: string;
  capabilityId: string;
  documentId: string;
  beforeRevision: number;
  afterRevision: number;
  intent: any;
  actionId: string;
  executionId: string;
  kernelReference: string;
  mutationReference: string;
  validationReference: string;
  verificationReference: string;
  beforeGeometrySignature: string;
  afterGeometrySignature: string;
  beforeTopologySignature: string;
  afterTopologySignature: string;
  uiProjectionRevision: number;
  uiFeatureState: any;
  uiPropertyState: any;
  uiViewportState: any;
  uiSelectionState: any;
  uiEvidenceState: any;
  uiStatus: string;
  roundTripVerdict: 'PASS' | 'FAIL';
  errorMessage?: string;
}

export class RoundTripCoordinator {
  /**
   * Executes a full round trip from UI Intent through the Canonical Backend and back to UI Projections.
   */
  public static async executeRoundTrip(
    testId: string,
    intent: AnyEngineeringIntent,
    document: EngineeringDocument,
    capabilityId: string = intent.toolId
  ): Promise<RoundTripEvidence> {
    const executionId = randomUUID();
    const beforeRevision = typeof document.revision === 'string' ? parseInt(document.revision, 10) : document.revision;
    const beforeGeometrySignature = document.derived?.mesh ? 'MESH_GENERATED' : (document.topologyMap?.hashes?.geometryHash || 'EMPTY');
    const beforeTopologySignature = Object.keys(document.topologyMap?.faceMap || {}).join(',');

    try {
      // 1. Dispatch through Canonical Pipeline
      const dispatchRes = await CanonicalIntentDispatcher277.dispatch(intent, document);

      if (!dispatchRes.success || !dispatchRes.document) {
        return this.generateFailedEvidence(
          testId, capabilityId, document, beforeRevision, intent, executionId,
          dispatchRes.canonicalActionId || 'DISPATCH_FAILED',
          dispatchRes.error || 'Unknown dispatch failure'
        );
      }

      const updatedDoc: EngineeringDocument = dispatchRes.document;
      const afterRevision = typeof updatedDoc.revision === 'string' ? parseInt(updatedDoc.revision, 10) : updatedDoc.revision;

      // 2. Document Evaluator Check (Ensures it passed through Kernel)
      const evaluationResult = dispatchRes.evaluationResult;
      if (!evaluationResult || !evaluationResult.success) {
        console.log('EVAL ERROR:', evaluationResult);
        return this.generateFailedEvidence(
          testId, capabilityId, document, beforeRevision, intent, executionId,
          dispatchRes.canonicalActionId,
          `Kernel Evaluation failed or bypassed: ${evaluationResult?.error || 'No result'}`
        );
      }

      // 4. Synchronize with UI Projections (PROMPT-054)
      const syncEngine = StateSyncEngine.getInstance();
      
      // We must register the document first if it's not known
      if (!syncEngine.getSnapshot(document.documentId)) {
        syncEngine.registerDocument(document);
      }

      const syncRes = syncEngine.applyMutation(updatedDoc);
      if (!syncRes.success || !syncRes.snapshot) {
        return this.generateFailedEvidence(
          testId, capabilityId, document, beforeRevision, intent, executionId,
          dispatchRes.canonicalActionId,
          `Sync Engine Rejected Mutation: ${syncRes.error}`
        );
      }

      const snap = syncRes.snapshot;

      // 5. Build Round Trip Evidence
      const afterGeometrySignature = updatedDoc.topologyMap?.hashes?.geometryHash || (updatedDoc.evaluatedShape as any)?.id || 'EMPTY';
      const afterTopologySignature = Object.keys(updatedDoc.topologyMap?.faceMap || {}).join(',');

      // 6. Final UI Truth Verification
      const isFeatureTreeValid = snap.featureTree.length === ((updatedDoc.features?.length || 0) + (updatedDoc.sketches?.length || 0));
      const isRevisionValid = snap.revision === afterRevision;
      const isGeometryValid = snap.viewport.bRepHash === afterGeometrySignature;
      
      const roundTripVerdict = (isFeatureTreeValid && isRevisionValid && isGeometryValid) ? 'PASS' : 'FAIL';
      const errorMessage = roundTripVerdict === 'FAIL' ? 'UI Projection did not match Canonical Output' : undefined;

      return {
        testId,
        capabilityId,
        documentId: document.documentId,
        beforeRevision,
        afterRevision,
        intent,
        actionId: dispatchRes.canonicalActionId,
        executionId,
        kernelReference: evaluationResult.stageDetails?.['BREP_REGENERATION'] ? 'BREP_KERNEL' : 'CANONICAL_KERNEL',
        mutationReference: `MUTATION_${afterRevision}`,
        validationReference: `VALIDATION_TRUE`,
        verificationReference: `VERIFICATION_${snap.status.status}`,
        beforeGeometrySignature,
        afterGeometrySignature,
        beforeTopologySignature,
        afterTopologySignature,
        uiProjectionRevision: snap.revision,
        uiFeatureState: snap.featureTree,
        uiPropertyState: snap.properties,
        uiViewportState: snap.viewport,
        uiSelectionState: snap.selection,
        uiEvidenceState: snap.evidence,
        uiStatus: snap.status.status,
        roundTripVerdict,
        errorMessage
      };

    } catch (err: any) {
      return this.generateFailedEvidence(
        testId, capabilityId, document, beforeRevision, intent, executionId,
        'SYSTEM_ERROR',
        `Exception: ${err.message}`
      );
    }
  }

  private static generateFailedEvidence(
    testId: string,
    capabilityId: string,
    document: EngineeringDocument,
    beforeRevision: number,
    intent: any,
    executionId: string,
    actionId: string,
    errorMessage: string
  ): RoundTripEvidence {
    return {
      testId,
      capabilityId,
      documentId: document.documentId,
      beforeRevision,
      afterRevision: beforeRevision,
      intent,
      actionId,
      executionId,
      kernelReference: 'NONE',
      mutationReference: 'NONE',
      validationReference: 'FAILED',
      verificationReference: 'FAILED',
      beforeGeometrySignature: 'UNCHANGED',
      afterGeometrySignature: 'UNCHANGED',
      beforeTopologySignature: 'UNCHANGED',
      afterTopologySignature: 'UNCHANGED',
      uiProjectionRevision: beforeRevision,
      uiFeatureState: null,
      uiPropertyState: null,
      uiViewportState: null,
      uiSelectionState: null,
      uiEvidenceState: null,
      uiStatus: 'FAILED',
      roundTripVerdict: 'FAIL',
      errorMessage
    };
  }
}
