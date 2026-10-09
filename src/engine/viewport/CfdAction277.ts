/**
 * PATCH-SECP-PROMPT-055: CFD Simulation Canonical Action
 * Implementation of the formal CFD result commitment operation on EngineeringDocument.
 */

import { EngineeringDocument, CFDModel } from '../cad-kernel/document/CADDocument';
import { DocumentEvaluator } from '../cad-kernel/document/DocumentEvaluator';
import { TelemetryHasher } from '../telemetry/TelemetryHasher';
import { CfdSimulationIntent, DispatchResult } from './EngineeringIntent277';
import { CanonicalAction } from './CanonicalAction277';
import { CanonicalMutationVerifier } from '../semantics/CanonicalMutationVerifier';

export class CfdAction277 implements CanonicalAction<CfdSimulationIntent> {
  public readonly actionId = 'CFD_SOLVE_NAVIER_STOKES';

  public async execute(intent: CfdSimulationIntent, document: EngineeringDocument): Promise<DispatchResult> {
    if (document.documentId !== intent.documentId) {
      return {
        success: false,
        documentId: document.documentId,
        revision: typeof document.revision === 'string' ? parseInt(document.revision, 10) : document.revision,
        canonicalActionId: this.actionId,
        affectedEntities: [],
        error: `INVALID_DOCUMENT: Intent targeted document '${intent.documentId}' but active document is '${document.documentId}'.`
      };
    }

    const prevRevision = typeof document.revision === 'string' ? parseInt(document.revision, 10) : document.revision;
    const newRevision = prevRevision + 1;

    // 1. Capture payload hash BEFORE
    const canonicalPayloadHashBefore = TelemetryHasher.hashString(JSON.stringify(document.derived?.cfd || { rev: prevRevision }));

    // 2. Compute solver and geometry hashes
    const sourceGeometryHash = document.derived?.geometryHash || TelemetryHasher.hashString(JSON.stringify(document.features || []));
    const solverInputHash = TelemetryHasher.hashString(
      `CFD_IN_${document.documentId}_${sourceGeometryHash}_vel${intent.parameters.inletVelocity}_rho${intent.parameters.fluidDensity}_mu${intent.parameters.viscosity}`
    );

    const cfdHash = TelemetryHasher.hashString(
      `CFD_RES_${document.documentId}_REV${newRevision}_${sourceGeometryHash}_${intent.parameters.inletVelocity}_${intent.parameters.fluidDensity}_${intent.parameters.viscosity}_${intent.parameters.results.reynoldsNumber}_${intent.parameters.results.pressureDropPa}`
    );

    const modelId = intent.parameters.modelId || `CFD_DOC_${document.documentId}_REV${newRevision}`;

    const cfdModel: CFDModel = {
      modelId,
      domainBounds: { min: [0, 0, 0], max: [100, 100, 100] },
      meshType: 'UNSTRUCTURED_POLYHEDRAL',
      cellCount: intent.parameters.cellCount || 250,
      inletVelocity: [intent.parameters.inletVelocity, 0, 0],
      fluidDensity: intent.parameters.fluidDensity,
      viscosity: intent.parameters.viscosity,
      convergenceIterations: intent.parameters.convergenceIterations,
      results: {
        reynoldsNumber: intent.parameters.results.reynoldsNumber,
        pressureDropPa: intent.parameters.results.pressureDropPa,
        flowRegime: intent.parameters.results.flowRegime,
        maxVelocity: intent.parameters.results.maxVelocity
      },
      geometryHash: sourceGeometryHash,
      topologyHash: (document.derived as any)?.topologyHash,
      hash: cfdHash,
      revision: newRevision
    };

    // 3. Mark prior simulation evidence as SUPERSEDED
    const prevEvidence = document.derived?.evidenceChain || document.evidence || [];
    const updatedEvidenceHistory = prevEvidence.map((ev: any) => {
      if (ev.stage === 'SIMULATION' && ev.revision < newRevision) {
        return {
          ...ev,
          status: 'SUPERSEDED',
          verdict: 'SUPERSEDED'
        };
      }
      return ev;
    });

    // 4. Create new Active Evidence Artifact
    const cfdEvidence = {
      evidenceId: `EV_CFD_REV${newRevision}_${Date.now()}`,
      stage: 'SIMULATION' as const,
      sourceSystem: 'SECP_CFD_RANS_ENGINE',
      documentId: document.documentId,
      revision: newRevision,
      canonicalHash: cfdHash,
      geometryHash: sourceGeometryHash,
      solverInputHash: solverInputHash,
      meshHash: `MESH_${cfdModel.cellCount}`,
      timestamp: new Date().toISOString(),
      payload: {
        reynoldsNumber: intent.parameters.results.reynoldsNumber,
        flowRegime: intent.parameters.results.flowRegime,
        maxVelocityMS: intent.parameters.results.maxVelocity,
        pressureDropPa: intent.parameters.results.pressureDropPa
      },
      verdict: 'VALID' as const,
      status: 'ACTIVE' as const
    };

    const newEvidenceChain = [...updatedEvidenceHistory, cfdEvidence];

    // 5. Build Updated Engineering Document
    const updatedDocument: EngineeringDocument = {
      ...document,
      revision: newRevision,
      derived: {
        ...document.derived,
        cfd: cfdModel,
        evidenceChain: newEvidenceChain
      },
      evidence: newEvidenceChain as any
    };

    // 6. Evaluate Document
    const evalResult = DocumentEvaluator.evaluate(updatedDocument);

    // 7. Capture payload hash AFTER
    const canonicalPayloadHashAfter = TelemetryHasher.hashString(JSON.stringify(updatedDocument.derived.cfd));

    // 8. Verify Mutation Proof via CanonicalMutationVerifier
    const proof = {
      targetDocumentId: document.documentId,
      previousRevision: prevRevision,
      newRevision: newRevision,
      mutationType: 'CFD_SIMULATION_RESULT',
      canonicalPayloadHashBefore,
      canonicalPayloadHashAfter,
      isStaleState: false,
      rebuildable: true,
      affectedCanonicalEntities: ['derived.cfd', 'evidenceChain'],
      isCanonicalMutation: true,
      nonCanonicalReasons: []
    };

    const verification = CanonicalMutationVerifier.verifyMutation(proof as any);

    if (!verification.isValid) {
      return {
        success: false,
        documentId: document.documentId,
        revision: prevRevision,
        canonicalActionId: this.actionId,
        affectedEntities: ['derived.cfd'],
        error: `CANONICAL_MUTATION_VERIFICATION_FAILED: ${verification.rejectionReasons.join('; ')}`
      };
    }

    return {
      success: true,
      documentId: updatedDocument.documentId,
      revision: newRevision,
      canonicalActionId: this.actionId,
      affectedEntities: ['derived.cfd', 'evidenceChain'],
      document: updatedDocument,
      evaluationResult: evalResult
    };
  }
}
