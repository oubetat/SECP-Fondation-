/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 002
 * Canonical DHM Integration Bridge
 * 
 * Binds Digital Human Models (DHM) to SECP EngineeringDocument SOT, coordinate frames,
 * revision management, and evidence ledgers.
 */

import { Matrix4x4, Vector3D } from '../../assembly/graph/types';
import { TransformMatrix } from '../../assembly/graph/TransformMatrix';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { AnthropometricProfile } from '../types/AnthropometricTypes';
import { SkeletalTopology } from '../types/SkeletalTopologyTypes';
import { AnatomicalJoint } from '../types/JointModelTypes';

export interface DHMPlacementFrame {
  parentCoordinateFrame: 'WCS' | 'MCS' | 'LOCAL' | string;
  positionMm: Vector3D;
  rotationEulerDeg: Vector3D;
  transformMatrix: Matrix4x4;
}

export interface DHMModelInstance {
  dhmInstanceId: string;
  documentId: string;
  revision: string | number;
  profile: AnthropometricProfile;
  skeleton: SkeletalTopology;
  joints: Record<string, AnatomicalJoint>;
  placementFrame: DHMPlacementFrame;
  provenanceHash: string;
  createdAtIso: string;
}

export interface DHMBindingValidationResult {
  isValid: boolean;
  errors: string[];
  provenanceHash: string;
}

export class CanonicalDHMIntegrationBridge {
  public static readonly VERSION = '1.0.0-PROD';

  /**
   * Constructs an immutable DHMModelInstance bound to a specific EngineeringDocument revision
   */
  public static createModelInstance(
    doc: EngineeringDocument,
    profile: AnthropometricProfile,
    skeleton: SkeletalTopology,
    joints: Map<string, AnatomicalJoint> | Record<string, AnatomicalJoint>,
    placement: {
      parentCoordinateFrame?: string;
      positionMm?: Vector3D;
      rotationEulerDeg?: Vector3D;
    } = {}
  ): DHMModelInstance {
    const docId = doc?.documentId || 'DOC_DHM_DEFAULT';
    const rev = doc?.revision ?? 1;

    const pos = placement.positionMm || { x: 0, y: 0, z: 0 };
    const rot = placement.rotationEulerDeg || { x: 0, y: 0, z: 0 };
    const frame = placement.parentCoordinateFrame || 'WCS';

    const transformMatrix = TransformMatrix.create(
      pos.x,
      pos.y,
      pos.z,
      rot.x,
      rot.y,
      rot.z
    ).matrix;

    const placementFrame: DHMPlacementFrame = {
      parentCoordinateFrame: frame,
      positionMm: pos,
      rotationEulerDeg: rot,
      transformMatrix
    };

    const jointsRecord = joints instanceof Map
      ? Object.fromEntries(joints.entries())
      : joints;

    const dhmInstanceId = `DHM_${docId}_R${rev}_${profile.gender}_${profile.provenance.percentile}`;
    const createdAtIso = new Date().toISOString();

    const rawStr = `${dhmInstanceId}:${docId}:${rev}:${profile.profileId}:${skeleton.serializationHash}:${pos.x},${pos.y},${pos.z}`;
    const provenanceHash = this.hashString(rawStr);

    return {
      dhmInstanceId,
      documentId: docId,
      revision: rev,
      profile,
      skeleton,
      joints: jointsRecord,
      placementFrame,
      provenanceHash,
      createdAtIso
    };
  }

  /**
   * Safely attaches DHM Model Instance to EngineeringDocument via doc.derived & doc.metadata
   * without direct illegal state mutation.
   */
  public static attachToCanonicalDocument(
    doc: EngineeringDocument,
    instance: DHMModelInstance
  ): EngineeringDocument {
    if (!doc) {
      throw new Error('[CanonicalDHMBridge] Target EngineeringDocument is null or undefined.');
    }

    const validation = this.validateBinding(doc, instance);
    if (!validation.isValid) {
      throw new Error(`[CanonicalDHMBridge] Invalid DHM binding: ${validation.errors.join('; ')}`);
    }

    // Deep clone doc to avoid mutating original SOT instance directly
    const updatedDoc: EngineeringDocument = JSON.parse(JSON.stringify(doc));

    if (!updatedDoc.derived) {
      updatedDoc.derived = {};
    }

    // Store DHM instance under derived.dhm & metadata.dhm
    updatedDoc.derived.dhm = instance;
    if (!updatedDoc.metadata) {
      updatedDoc.metadata = {};
    }
    updatedDoc.metadata.dhmProvenanceHash = instance.provenanceHash;

    // Append Evidence Record
    if (!updatedDoc.evidence) {
      updatedDoc.evidence = [];
    }

    updatedDoc.evidence.push({
      evidenceId: `EVID_DHM_${instance.dhmInstanceId}`,
      stage: 'HUMAN_FACTORS_DHM_FOUNDATION',
      sourceSystem: 'SECP-HFEE-001',
      documentId: doc.documentId,
      revision: doc.revision,
      canonicalHash: instance.provenanceHash,
      timestamp: instance.createdAtIso,
      verdict: 'PASS',
      payload: {
        dhmInstanceId: instance.dhmInstanceId,
        gender: instance.profile.gender,
        percentile: instance.profile.provenance.percentile,
        statureMm: instance.profile.measurements.statureMm,
        segmentCount: Object.keys(instance.skeleton.segments).length
      }
    });

    return updatedDoc;
  }

  /**
   * Validates DHM binding compatibility and mutation integrity against EngineeringDocument
   */
  public static validateBinding(
    doc: EngineeringDocument,
    instance: DHMModelInstance
  ): DHMBindingValidationResult {
    const errors: string[] = [];

    if (!instance) {
      return { isValid: false, errors: ['DHMModelInstance is null or undefined.'], provenanceHash: '' };
    }

    if (!instance.profile || !instance.profile.isValid) {
      errors.push('DHMModelInstance contains an invalid or unverified AnthropometricProfile.');
    }

    if (!instance.skeleton || !instance.skeleton.isValid) {
      errors.push('DHMModelInstance contains an invalid or unverified SkeletalTopology.');
    }

    if (!TransformMatrix.isValidTransform(instance.placementFrame.transformMatrix)) {
      errors.push('DHMModelInstance placement transform matrix is degenerate or non-finite.');
    }

    if (doc && instance.documentId !== doc.documentId) {
      errors.push(
        `Document ID mismatch: DHM instance bound to '${instance.documentId}' but document ID is '${doc.documentId}'.`
      );
    }

    const recomputedHash = this.hashString(
      `${instance.dhmInstanceId}:${instance.documentId}:${instance.revision}:${instance.profile.profileId}:${instance.skeleton.serializationHash}:${instance.placementFrame.positionMm.x},${instance.placementFrame.positionMm.y},${instance.placementFrame.positionMm.z}`
    );

    if (recomputedHash !== instance.provenanceHash) {
      errors.push('DHM instance provenance hash verification failed (mutation or tamper detected).');
    }

    return {
      isValid: errors.length === 0,
      errors,
      provenanceHash: instance.provenanceHash
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
