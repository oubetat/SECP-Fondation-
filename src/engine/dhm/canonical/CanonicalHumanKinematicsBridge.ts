/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 003
 * Canonical Human Kinematics Integration Bridge
 * 
 * Binds solved Human Kinematics postures to SECP EngineeringDocument SOT,
 * revision management, and evidence ledgers without mutating original SOT.
 */

import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { HumanPoseState, HumanIKResult, IKEffectorTarget } from '../kinematics/types';

export interface HumanKinematicsBindingResult {
  kinematicsInstanceId: string;
  documentId: string;
  revision: string | number;
  solvedPose: HumanPoseState;
  solverAlgorithm: string;
  convergenceStatus: string;
  iterations: number;
  targets: IKEffectorTarget[];
  positionResidualsMm: Record<string, number>;
  provenanceHash: string;
  createdAtIso: string;
}

export class CanonicalHumanKinematicsBridge {
  public static readonly VERSION = '1.0.0-PROD';

  /**
   * Binds solved IK result to an EngineeringDocument revision and appends evidence
   */
  public static attachKinematicsToDocument(
    doc: EngineeringDocument,
    ikResult: HumanIKResult,
    targets: IKEffectorTarget[],
    solverAlgorithm: string = 'DLS_JACOBIAN_SOLVER_V1'
  ): EngineeringDocument {
    if (!doc) {
      throw new Error('[CanonicalHumanKinematicsBridge] Target EngineeringDocument is null or undefined.');
    }

    if (!ikResult || !ikResult.solvedPose) {
      throw new Error('[CanonicalHumanKinematicsBridge] Cannot bind null or incomplete HumanIKResult.');
    }

    const docId = doc.documentId || 'DOC_KINEMATICS_DEFAULT';
    const rev = doc.revision ?? 1;
    const createdAtIso = new Date().toISOString();

    const instanceId = `KIN_${docId}_R${rev}_${Date.now()}`;
    const rawStr = `${instanceId}:${docId}:${rev}:${ikResult.convergenceStatus}:${ikResult.iterations}:${JSON.stringify(ikResult.positionResidualsMm)}`;
    const provenanceHash = this.hashString(rawStr);

    const binding: HumanKinematicsBindingResult = {
      kinematicsInstanceId: instanceId,
      documentId: docId,
      revision: rev,
      solvedPose: ikResult.solvedPose,
      solverAlgorithm,
      convergenceStatus: ikResult.convergenceStatus,
      iterations: ikResult.iterations,
      targets,
      positionResidualsMm: ikResult.positionResidualsMm,
      provenanceHash,
      createdAtIso
    };

    // Deep copy document to preserve immutability
    const updatedDoc: EngineeringDocument = JSON.parse(JSON.stringify(doc));

    if (!updatedDoc.derived) {
      updatedDoc.derived = {};
    }
    updatedDoc.derived.humanKinematics = binding;

    if (!updatedDoc.metadata) {
      updatedDoc.metadata = {};
    }
    updatedDoc.metadata.kinematicsProvenanceHash = provenanceHash;

    if (!updatedDoc.evidence) {
      updatedDoc.evidence = [];
    }

    updatedDoc.evidence.push({
      evidenceId: `EVID_KIN_${instanceId}`,
      stage: 'HUMAN_FACTORS_KINEMATICS',
      sourceSystem: 'SECP-HFEE-001',
      documentId: docId,
      revision: rev,
      canonicalHash: provenanceHash,
      timestamp: createdAtIso,
      verdict: ikResult.success ? 'PASS' : 'FAIL',
      payload: {
        instanceId,
        solverAlgorithm,
        convergenceStatus: ikResult.convergenceStatus,
        iterations: ikResult.iterations,
        targetCount: targets.length,
        positionResidualsMm: ikResult.positionResidualsMm
      }
    });

    return updatedDoc;
  }

  /**
   * Validates binding integrity and revision match
   */
  public static validateKinematicsBinding(
    doc: EngineeringDocument,
    binding: HumanKinematicsBindingResult
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!binding) {
      return { isValid: false, errors: ['HumanKinematicsBindingResult is null or undefined.'] };
    }

    if (doc && binding.documentId !== doc.documentId) {
      errors.push(`Document ID mismatch: binding bound to '${binding.documentId}' but document is '${doc.documentId}'.`);
    }

    if (doc && String(binding.revision) !== String(doc.revision)) {
      errors.push(`Revision mismatch: binding bound to revision '${binding.revision}' but document is '${doc.revision}'.`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private static hashString(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
