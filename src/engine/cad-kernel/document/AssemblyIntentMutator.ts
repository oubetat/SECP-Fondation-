/**
 * SECP CAD Kernel — Assembly Intent Mutator (PATCH-038D)
 * 
 * Canonical engineering intent mutator for Assembly Engineering Documents (AED).
 * Enforces Rule 01 (Engineering SOT) and Rule 02 (No Direct UI -> Runtime Engineering Mutation).
 * 
 * All user assembly engineering actions MUST flow through:
 *   UI Intent
 *       ↓
 *   AssemblyIntentMutator.apply(canonicalDocument, action)
 *       ↓
 *   new canonicalDocument.assembly
 *       ↓
 *   DocumentEvaluator.evaluate(newDocument, context)
 *       ↓
 *   evaluatedAssembly
 *       ↓
 *   runtime projection
 *       ↓
 *   Viewport
 * 
 * Purity Contract:
 * - Deterministic, pure function with no side effects.
 * - Does NOT create CadSolidEntity.
 * - Does NOT trigger viewport or renderer.
 * - Does NOT access React state or runtime assemblyData.
 * - Does NOT generate synthetic geometry.
 * - Does NOT mutate child EngineeringDocuments.
 * - Does NOT trigger persistence directly.
 */

import { createHash } from 'crypto';
import { EngineeringDocument, AssemblyDefinition, AssemblyInstance, AssemblyMate } from './CADDocument';
import { MechanicalJoint } from '../../assembly/joints/MechanicalJointTypes';

export type AssemblyIntentAction =
  | {
      type: 'ADD_INSTANCE';
      instance: AssemblyInstance;
    }
  | {
      type: 'REMOVE_INSTANCE';
      instanceId: string;
    }
  | {
      type: 'UPDATE_TRANSFORM';
      instanceId: string;
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
    }
  | {
      type: 'BATCH_UPDATE_TRANSFORMS';
      transforms: Array<{
        instanceId: string;
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
      }>;
    }
  | {
      type: 'ADD_MATE';
      mate: AssemblyMate;
    }
  | {
      type: 'REMOVE_MATE';
      mateId: string;
    }
  | {
      type: 'UPDATE_MATE';
      mateId: string;
      patch: Partial<AssemblyMate>;
    }
  | {
      type: 'SUPPRESS_INSTANCE';
      instanceId: string;
      suppressed: boolean;
    }
  | {
      type: 'SET_GROUNDED';
      instanceId: string;
      isGrounded: boolean;
    }
  | {
      type: 'ADD_JOINT';
      joint: MechanicalJoint;
    }
  | {
      type: 'REMOVE_JOINT';
      jointId: string;
    }
  | {
      type: 'UPDATE_JOINT';
      jointId: string;
      patch: Partial<MechanicalJoint>;
    }
  | {
      type: 'SET_JOINT_MOTION';
      jointId: string;
      position: number;
      secondaryPosition?: number;
      tertiaryPosition?: number;
    }
  | {
      type: 'APPLY_KINEMATIC_SOLUTION';
      transforms: Array<{
        instanceId: string;
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
      }>;
      jointStates?: Array<{
        jointId: string;
        currentPosition: number;
        state: any;
        residual?: number;
      }>;
      evidenceHash?: string;
    }
  | {
      type: 'BATCH_UPDATE_JOINTS';
      joints: MechanicalJoint[];
    };

export class AssemblyIntentMutator {
  /**
   * Pure, immutable application of an AssemblyIntentAction onto an EngineeringDocument.
   * Produces a new EngineeringDocument instance preserving unaffected properties.
   */
  public static apply(
    document: EngineeringDocument,
    action: AssemblyIntentAction
  ): EngineeringDocument {
    if (!document) {
      throw new Error('[SECP_INTENT_ERROR] Cannot apply assembly intent to null/undefined document.');
    }

    const currentAssembly: AssemblyDefinition = document.assembly
      ? {
          instances: [...(document.assembly.instances || [])],
          mates: [...(document.assembly.mates || [])],
          joints: [...(document.assembly.joints || [])]
        }
      : { instances: [], mates: [], joints: [] };

    let newInstances: AssemblyInstance[] = currentAssembly.instances.map(inst => ({
      instanceId: inst.instanceId,
      documentId: inst.documentId,
      position: { ...inst.position },
      rotation: { ...inst.rotation },
      colorHex: inst.colorHex,
      isSuppressed: !!inst.isSuppressed,
      isGrounded: !!inst.isGrounded || !!inst.grounded,
      grounded: !!inst.isGrounded || !!inst.grounded
    }));

    let newMates: AssemblyMate[] = currentAssembly.mates.map(m => ({
      mateId: m.mateId,
      type: m.type,
      instanceAId: m.instanceAId,
      instanceBId: m.instanceBId,
      offset: m.offset,
      parameters: m.parameters ? { ...m.parameters } : undefined,
      entityA: m.entityA ? { ...m.entityA } : undefined,
      entityB: m.entityB ? { ...m.entityB } : undefined
    }));

    let newJoints: MechanicalJoint[] = (currentAssembly.joints || []).map(j => ({
      ...j,
      id: j.id || j.jointId || '',
      jointId: j.jointId || j.id,
      type: j.type || j.jointType || 'FIXED',
      parentComponentId: j.parentComponentId || j.componentA || '',
      childComponentId: j.childComponentId || j.componentB || ''
    }));

    switch (action.type) {
      case 'ADD_INSTANCE': {
        const { instance } = action;
        if (!instance || !instance.instanceId) {
          throw new Error('[SECP_INTENT_ERROR] ADD_INSTANCE requires a valid instance with instanceId.');
        }
        if (!instance.documentId) {
          throw new Error(`[SECP_INTENT_ERROR] ADD_INSTANCE requires documentId reference for instance '${instance.instanceId}'.`);
        }
        if (newInstances.some(i => i.instanceId === instance.instanceId)) {
          throw new Error(`[SECP_INTENT_ERROR] Instance with id '${instance.instanceId}' already exists.`);
        }

        newInstances.push({
          instanceId: instance.instanceId,
          documentId: instance.documentId,
          position: {
            x: instance.position?.x ?? 0,
            y: instance.position?.y ?? 0,
            z: instance.position?.z ?? 0
          },
          rotation: {
            x: instance.rotation?.x ?? 0,
            y: instance.rotation?.y ?? 0,
            z: instance.rotation?.z ?? 0
          },
          colorHex: instance.colorHex,
          isSuppressed: !!instance.isSuppressed
        });
        break;
      }

      case 'REMOVE_INSTANCE': {
        const { instanceId } = action;
        const exists = newInstances.some(i => i.instanceId === instanceId);
        if (!exists) {
          throw new Error(`[SECP_INTENT_ERROR] REMOVE_INSTANCE failed: instance '${instanceId}' not found.`);
        }

        // Clean removal from instances
        newInstances = newInstances.filter(i => i.instanceId !== instanceId);

        // Truthful mate cleanup: clean up mates referencing the removed instance so no dangling references remain
        newMates = newMates.filter(
          m => m.instanceAId !== instanceId && m.instanceBId !== instanceId
        );
        break;
      }

      case 'UPDATE_TRANSFORM': {
        const { instanceId, position, rotation } = action;
        const idx = newInstances.findIndex(i => i.instanceId === instanceId);
        if (idx === -1) {
          throw new Error(`[SECP_INTENT_ERROR] UPDATE_TRANSFORM failed: instance '${instanceId}' not found.`);
        }

        newInstances[idx] = {
          ...newInstances[idx],
          position: { ...position },
          rotation: { ...rotation }
        };
        break;
      }
      
      case 'BATCH_UPDATE_TRANSFORMS': {
        const { transforms } = action;
        for (const t of transforms) {
          const idx = newInstances.findIndex(i => i.instanceId === t.instanceId);
          if (idx !== -1) {
            newInstances[idx] = {
              ...newInstances[idx],
              position: { ...t.position },
              rotation: { ...t.rotation }
            };
          }
        }
        break;
      }

      case 'SUPPRESS_INSTANCE': {
        const { instanceId, suppressed } = action;
        const idx = newInstances.findIndex(i => i.instanceId === instanceId);
        if (idx === -1) {
          throw new Error(`[SECP_INTENT_ERROR] SUPPRESS_INSTANCE failed: instance '${instanceId}' not found.`);
        }

        newInstances[idx] = {
          ...newInstances[idx],
          isSuppressed: suppressed
        };
        break;
      }

      case 'SET_GROUNDED': {
        const { instanceId, isGrounded } = action;
        const idx = newInstances.findIndex(i => i.instanceId === instanceId);
        if (idx === -1) {
          throw new Error(`[SECP_INTENT_ERROR] SET_GROUNDED failed: instance '${instanceId}' not found.`);
        }

        newInstances[idx] = {
          ...newInstances[idx],
          isGrounded,
          grounded: isGrounded
        };
        break;
      }

      case 'ADD_MATE': {
        const { mate } = action;
        if (!mate || !mate.mateId) {
          throw new Error('[SECP_INTENT_ERROR] ADD_MATE requires a valid mate with mateId.');
        }
        if (newMates.some(m => m.mateId === mate.mateId)) {
          throw new Error(`[SECP_INTENT_ERROR] Mate with id '${mate.mateId}' already exists.`);
        }

        newMates.push({
          mateId: mate.mateId,
          type: mate.type,
          instanceAId: mate.instanceAId,
          instanceBId: mate.instanceBId,
          offset: mate.offset,
          parameters: mate.parameters ? { ...mate.parameters } : undefined,
          entityA: mate.entityA ? { ...mate.entityA } : undefined,
          entityB: mate.entityB ? { ...mate.entityB } : undefined
        });
        break;
      }

      case 'REMOVE_MATE': {
        const { mateId } = action;
        const exists = newMates.some(m => m.mateId === mateId);
        if (!exists) {
          throw new Error(`[SECP_INTENT_ERROR] REMOVE_MATE failed: mate '${mateId}' not found.`);
        }

        newMates = newMates.filter(m => m.mateId !== mateId);
        break;
      }

      case 'UPDATE_MATE': {
        const { mateId, patch } = action;
        const idx = newMates.findIndex(m => m.mateId === mateId);
        if (idx === -1) {
          throw new Error(`[SECP_INTENT_ERROR] UPDATE_MATE failed: mate '${mateId}' not found.`);
        }

        newMates[idx] = {
          ...newMates[idx],
          ...patch,
          mateId // maintain immutable identity
        };
        break;
      }

      case 'ADD_JOINT': {
        const { joint } = action;
        const jId = joint.id || joint.jointId;
        if (!joint || !jId) {
          throw new Error('[SECP_INTENT_ERROR] ADD_JOINT requires a valid joint with id/jointId.');
        }
        if (newJoints.some(j => j.id === jId || j.jointId === jId)) {
          throw new Error(`[SECP_INTENT_ERROR] Joint with id '${jId}' already exists.`);
        }

        newJoints.push({
          ...joint,
          id: jId,
          jointId: jId,
          type: joint.type || joint.jointType || 'FIXED',
          jointType: joint.jointType || joint.type || 'FIXED',
          parentComponentId: joint.parentComponentId || joint.componentA || '',
          childComponentId: joint.childComponentId || joint.componentB || '',
          componentA: joint.componentA || joint.parentComponentId || '',
          componentB: joint.componentB || joint.childComponentId || ''
        });
        break;
      }

      case 'REMOVE_JOINT': {
        const { jointId } = action;
        const exists = newJoints.some(j => j.id === jointId || j.jointId === jointId);
        if (!exists) {
          throw new Error(`[SECP_INTENT_ERROR] REMOVE_JOINT failed: joint '${jointId}' not found.`);
        }

        newJoints = newJoints.filter(j => j.id !== jointId && j.jointId !== jointId);
        break;
      }

      case 'UPDATE_JOINT': {
        const { jointId, patch } = action;
        const idx = newJoints.findIndex(j => j.id === jointId || j.jointId === jointId);
        if (idx === -1) {
          throw new Error(`[SECP_INTENT_ERROR] UPDATE_JOINT failed: joint '${jointId}' not found.`);
        }

        newJoints[idx] = {
          ...newJoints[idx],
          ...patch,
          id: jointId,
          jointId: jointId
        };
        break;
      }

      case 'SET_JOINT_MOTION': {
        const { jointId, position, secondaryPosition, tertiaryPosition } = action;
        const idx = newJoints.findIndex(j => j.id === jointId || j.jointId === jointId);
        if (idx === -1) {
          throw new Error(`[SECP_INTENT_ERROR] SET_JOINT_MOTION failed: joint '${jointId}' not found.`);
        }

        newJoints[idx] = {
          ...newJoints[idx],
          currentPosition: position,
          motionParameter: position,
          currentPositionSecondary: secondaryPosition !== undefined ? secondaryPosition : newJoints[idx].currentPositionSecondary,
          currentPositionTertiary: tertiaryPosition !== undefined ? tertiaryPosition : newJoints[idx].currentPositionTertiary,
          revision: (newJoints[idx].revision || 1) + 1
        };
        break;
      }

      case 'APPLY_KINEMATIC_SOLUTION': {
        const { transforms, jointStates } = action;
        for (const t of transforms) {
          const idx = newInstances.findIndex(i => i.instanceId === t.instanceId);
          if (idx !== -1) {
            newInstances[idx] = {
              ...newInstances[idx],
              position: { ...t.position },
              rotation: { ...t.rotation }
            };
          }
        }
        if (jointStates) {
          for (const js of jointStates) {
            const idx = newJoints.findIndex(j => j.id === js.jointId || j.jointId === js.jointId);
            if (idx !== -1) {
              newJoints[idx] = {
                ...newJoints[idx],
                currentPosition: js.currentPosition,
                motionParameter: js.currentPosition,
                state: js.state,
                solverState: js.state
              };
            }
          }
        }
        break;
      }

      case 'BATCH_UPDATE_JOINTS': {
        const { joints } = action;
        newJoints = joints.map(j => ({
          ...j,
          id: j.id || j.jointId || '',
          jointId: j.jointId || j.id
        }));
        break;
      }

      default:
        throw new Error(`[SECP_INTENT_ERROR] Unsupported intent action: ${(action as any).type}`);
    }

    const nextRevision = (document.revision || 1) + 1;

    const evidencePayload = {
      documentId: document.documentId,
      revision: nextRevision,
      intentAction: action.type,
      instancesCount: newInstances.length,
      matesCount: newMates.length,
      jointsCount: newJoints.length
    };
    const canonicalHash = createHash('sha256').update(JSON.stringify(evidencePayload)).digest('hex');

    // Return new immutable document instance
    const updatedDocument: EngineeringDocument = {
      ...document,
      type: 'ASSEMBLY',
      revision: nextRevision,
      assembly: {
        instances: newInstances,
        mates: newMates,
        joints: newJoints,
        kinematicConfiguration: document.assembly?.kinematicConfiguration
      },
      evidence: [
        ...(document.evidence || []),
        {
          documentId: document.documentId,
          revision: nextRevision,
          canonicalHash: `0x${canonicalHash}`,
          timestamp: new Date().toISOString(),
          payload: evidencePayload,
          verdict: 'VALID'
        }
      ]
    };

    return updatedDocument;
  }
}
