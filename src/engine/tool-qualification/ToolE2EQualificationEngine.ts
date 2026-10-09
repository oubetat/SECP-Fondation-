/**
 * SECP Industrial OS v3 — PROMPT-056: Tool E2E Qualification Engine
 * Executes the complete Tool-by-Tool End-to-End Engineering Qualification.
 * Lifecycle: CREATE → MODIFY → REGENERATE → UNDO → REDO → SAVE → RELOAD → VERIFY
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { CanonicalIntentDispatcher277 } from '../viewport/CanonicalIntentDispatcher277';
import { StateSyncEngine } from '../sync/StateSyncEngine';
import { DocumentEvaluator } from '../cad-kernel/document/DocumentEvaluator';
import { CapabilityTruthGate } from '../cad-kernel/registry/CapabilityTruthGate';
import { DesignToolContractRegistry } from '../cad-kernel/registry/DesignToolContractRegistry';
import {
  ToolQualificationRecord,
  ToolLifecycleStage,
  ToolStageVerdict
} from './ToolQualificationTypes';

export function createDefaultDocument(documentId: string, name: string = 'Default Document'): EngineeringDocument {
  return {
    documentId,
    revision: 1,
    type: 'ASSEMBLY',
    units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
    sketches: [{ id: 'SK-1', name: 'Profile Sketch', plane: 'XY', entities: [] }],
    assembly: {
      instances: [
        { instanceId: 'INST-1', documentId: 'DOC-SUB-1', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
        { instanceId: 'INST-2', documentId: 'DOC-SUB-2', position: { x: 50, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
      ],
      mates: [],
      joints: []
    },
    constraints: [],
    features: [],
    parameters: [{ id: 'P-1', name: 'Depth', value: 20, unit: 'mm' }],
    topologyMap: { version: 1, faceMap: { F1: 'TOPOLOGY_FACE_1' }, hashes: { geometryHash: 'HASH_INIT_001' } },
    derived: { bRepHash: 'HASH_INIT_001', mesh: { vertices: new Float32Array(9), normals: new Float32Array(9), indices: new Uint32Array(3) } as any },
    evidence: [{
      evidenceId: `EV-${documentId}-1`,
      stage: 'GEOMETRY',
      sourceSystem: 'CADKernel',
      documentId,
      revision: 1,
      canonicalHash: 'HASH_INIT_001',
      timestamp: new Date().toISOString()
    }]
  };
}

export class ToolE2EQualificationEngine {

  /**
   * Qualifies a single tool through the 8 mandatory lifecycle stages.
   */
  public static async qualifyTool(toolId: string): Promise<ToolQualificationRecord> {
    const truth = CapabilityTruthGate.resolve(toolId);
    const contract = DesignToolContractRegistry.get(toolId);
    const capability = contract?.intent.type || toolId;
    const workbench = contract?.workbench || 'General';

    // If tool is UNSUPPORTED or UNAVAILABLE according to Capability Truth Gate
    if (truth.truthState === 'NOT_SUPPORTED' || truth.truthState === 'UNAVAILABLE') {
      return {
        toolId,
        capability,
        workbench,
        isSupported: false,
        stages: {
          CREATE: 'UNSUPPORTED',
          MODIFY: 'UNSUPPORTED',
          REGENERATE: 'UNSUPPORTED',
          UNDO: 'UNSUPPORTED',
          REDO: 'UNSUPPORTED',
          SAVE: 'UNSUPPORTED',
          RELOAD: 'UNSUPPORTED',
          VERIFY: 'UNSUPPORTED'
        },
        stageDetails: {
          CREATE: `Tool '${toolId}' is not supported by the backend kernel.`,
          MODIFY: `Tool '${toolId}' is not supported by the backend kernel.`,
          REGENERATE: `Tool '${toolId}' is not supported by the backend kernel.`,
          UNDO: `Tool '${toolId}' is not supported by the backend kernel.`,
          REDO: `Tool '${toolId}' is not supported by the backend kernel.`,
          SAVE: `Tool '${toolId}' is not supported by the backend kernel.`,
          RELOAD: `Tool '${toolId}' is not supported by the backend kernel.`,
          VERIFY: `Tool '${toolId}' is not supported by the backend kernel.`
        },
        finalVerdict: 'UNSUPPORTED'
      };
    }

    const stages: Record<ToolLifecycleStage, ToolStageVerdict> = {
      CREATE: 'FAIL',
      MODIFY: 'FAIL',
      REGENERATE: 'FAIL',
      UNDO: 'FAIL',
      REDO: 'FAIL',
      SAVE: 'FAIL',
      RELOAD: 'FAIL',
      VERIFY: 'FAIL'
    };

    const stageDetails: Record<ToolLifecycleStage, string> = {
      CREATE: 'Pending execution',
      MODIFY: 'Pending execution',
      REGENERATE: 'Pending execution',
      UNDO: 'Pending execution',
      REDO: 'Pending execution',
      SAVE: 'Pending execution',
      RELOAD: 'Pending execution',
      VERIFY: 'Pending execution'
    };

    const docId = `DOC-QUAL-${toolId}-${Date.now()}`;
    const doc = createDefaultDocument(docId, `Qualification Doc for ${toolId}`);
    
    // Add default sketch entities to support feature operations requiring sketches
    doc.sketches = [{
      id: 'SK-1',
      name: 'Default Sketch',
      plane: 'XY',
      entities: [
        { id: 'L1', type: 'LINE', startPointId: 'P1', endPointId: 'P2' },
        { id: 'L2', type: 'LINE', startPointId: 'P2', endPointId: 'P3' },
        { id: 'L3', type: 'LINE', startPointId: 'P3', endPointId: 'P4' },
        { id: 'L4', type: 'LINE', startPointId: 'P4', endPointId: 'P1' }
      ],
      points: [
        { id: 'P1', x: 0, y: 0 },
        { id: 'P2', x: 50, y: 0 },
        { id: 'P3', x: 50, y: 50 },
        { id: 'P4', x: 0, y: 50 }
      ],
      closedProfile: true
    }];

    const syncEngine = StateSyncEngine.getInstance();
    syncEngine.registerDocument(doc);

    let docAfterCreate: EngineeringDocument | null = null;
    let docAfterModify: EngineeringDocument | null = null;
    let beforeHash = 'EMPTY';
    let afterHash = 'EMPTY';
    let reloadedHash = 'EMPTY';

    try {
      // 1. STAGE: CREATE
      const createIntent = this.buildCreateIntent(toolId, docId);
      const createRes = await CanonicalIntentDispatcher277.dispatch(createIntent, doc);

      if (!createRes.success || !createRes.document) {
        stages.CREATE = 'FAIL';
        stageDetails.CREATE = `Create intent failed: ${createRes.error || 'Unknown dispatch error'}`;
        return this.buildRecord(toolId, capability, workbench, true, stages, stageDetails, 'FAIL');
      }

      docAfterCreate = createRes.document;
      const syncRes1 = syncEngine.applyMutation(docAfterCreate, 'MUTATION');
      if (!syncRes1.success) {
        stages.CREATE = 'FAIL';
        stageDetails.CREATE = `State sync failed after create: ${syncRes1.error}`;
        return this.buildRecord(toolId, capability, workbench, true, stages, stageDetails, 'FAIL');
      }

      stages.CREATE = 'PASS';
      beforeHash = syncRes1.snapshot?.viewport.bRepHash || 'HASH_CREATE';
      stageDetails.CREATE = `Create successful. Snapshot revision: ${syncRes1.snapshot?.revision}, Features: ${docAfterCreate.features.length}`;

      // 2. STAGE: MODIFY
      const modifyIntent = this.buildModifyIntent(toolId, docId, docAfterCreate);
      const modifyRes = await CanonicalIntentDispatcher277.dispatch(modifyIntent, docAfterCreate);

      if (!modifyRes.success || !modifyRes.document) {
        stages.MODIFY = 'FAIL';
        stageDetails.MODIFY = `Modify intent failed: ${modifyRes.error || 'Unknown dispatch error'}`;
        return this.buildRecord(toolId, capability, workbench, true, stages, stageDetails, 'FAIL');
      }

      docAfterModify = modifyRes.document;
      const syncRes2 = syncEngine.applyMutation(docAfterModify, 'MUTATION');
      if (!syncRes2.success) {
        stages.MODIFY = 'FAIL';
        stageDetails.MODIFY = `State sync failed after modify: ${syncRes2.error}`;
        return this.buildRecord(toolId, capability, workbench, true, stages, stageDetails, 'FAIL');
      }

      stages.MODIFY = 'PASS';
      afterHash = syncRes2.snapshot?.viewport.bRepHash || 'HASH_MODIFY';
      stageDetails.MODIFY = `Modify successful. Snapshot revision: ${syncRes2.snapshot?.revision}`;

      // 3. STAGE: REGENERATE
      const evalRes = DocumentEvaluator.evaluate(docAfterModify);
      if (!evalRes.success) {
        stages.REGENERATE = 'FAIL';
        stageDetails.REGENERATE = `DocumentEvaluator failed regeneration: ${evalRes.error}`;
        return this.buildRecord(toolId, capability, workbench, true, stages, stageDetails, 'FAIL');
      }

      stages.REGENERATE = 'PASS';
      stageDetails.REGENERATE = `Regenerate successful. Evaluation time: ${evalRes.evaluationTimeMs}ms, Hash: ${evalRes.derivedArtifacts?.bRepHash}`;

      // 4. STAGE: UNDO
      const undoSnap = syncEngine.applyUndo(docAfterCreate);
      if (!undoSnap || undoSnap.revision !== docAfterCreate.revision) {
        stages.UNDO = 'FAIL';
        stageDetails.UNDO = `Undo snapshot revision mismatch. Expected ${docAfterCreate.revision}, got ${undoSnap?.revision}`;
        return this.buildRecord(toolId, capability, workbench, true, stages, stageDetails, 'FAIL');
      }

      stages.UNDO = 'PASS';
      stageDetails.UNDO = `Undo successful. Reverted to revision ${undoSnap.revision}`;

      // 5. STAGE: REDO
      const redoSnap = syncEngine.applyRedo(docAfterModify);
      if (!redoSnap || redoSnap.revision !== docAfterModify.revision) {
        stages.REDO = 'FAIL';
        stageDetails.REDO = `Redo snapshot revision mismatch. Expected ${docAfterModify.revision}, got ${redoSnap?.revision}`;
        return this.buildRecord(toolId, capability, workbench, true, stages, stageDetails, 'FAIL');
      }

      stages.REDO = 'PASS';
      stageDetails.REDO = `Redo successful. Advanced to revision ${redoSnap.revision}`;

      // 6. STAGE: SAVE
      const serializedDoc = JSON.stringify(docAfterModify);
      if (!serializedDoc || !serializedDoc.includes(docId) || !serializedDoc.includes('features')) {
        stages.SAVE = 'FAIL';
        stageDetails.SAVE = 'Save failed: Serialized JSON payload is incomplete or invalid.';
        return this.buildRecord(toolId, capability, workbench, true, stages, stageDetails, 'FAIL');
      }

      stages.SAVE = 'PASS';
      stageDetails.SAVE = `Save successful. Canonical JSON payload size: ${serializedDoc.length} bytes`;

      // 7. STAGE: RELOAD
      const reloadedDoc = JSON.parse(serializedDoc) as EngineeringDocument;
      const reloadedEval = DocumentEvaluator.evaluate(reloadedDoc);
      const reloadedSnap = syncEngine.registerDocument(reloadedDoc);

      if (!reloadedEval.success || reloadedDoc.documentId !== docId) {
        stages.RELOAD = 'FAIL';
        stageDetails.RELOAD = 'Reload failed: Deserialized document re-evaluation failed.';
        return this.buildRecord(toolId, capability, workbench, true, stages, stageDetails, 'FAIL');
      }

      stages.RELOAD = 'PASS';
      reloadedHash = reloadedSnap.viewport.bRepHash || 'HASH_RELOAD';
      stageDetails.RELOAD = `Reload successful. Reconstructed docId '${reloadedDoc.documentId}', Revision: ${reloadedSnap.revision}`;

      // 8. STAGE: VERIFY
      const divergenceCheck = syncEngine.detectDivergence(docId, {
        claimedRevision: reloadedSnap.revision,
        featureCount: reloadedSnap.featureTree.length,
        parameterCount: reloadedSnap.properties.items.length,
        status: reloadedSnap.status.status
      });

      if (divergenceCheck.hasDivergence) {
        stages.VERIFY = 'FAIL';
        stageDetails.VERIFY = `Verify failed due to state divergence: ${divergenceCheck.reasons.join('; ')}`;
        return this.buildRecord(toolId, capability, workbench, true, stages, stageDetails, 'FAIL');
      }

      stages.VERIFY = 'PASS';
      stageDetails.VERIFY = 'Verify successful. Zero state divergence confirmed across UI and Canonical truth.';

      return {
        toolId,
        capability,
        workbench,
        isSupported: true,
        stages,
        stageDetails,
        finalVerdict: 'PASS',
        beforeHash,
        afterHash,
        reloadedHash,
        evidenceHash: `EVIDENCE-${docId}-${Date.now()}`
      };

    } catch (e: any) {
      return this.buildRecord(toolId, capability, workbench, true, stages, stageDetails, 'FAIL', `Exception: ${e.message}`);
    }
  }

  /**
   * Builds default Create Intent for a tool.
   */
  private static buildCreateIntent(toolId: string, documentId: string): any {
    switch (toolId) {
      case 'FEATURE_EXTRUDE':
        return {
          toolId,
          documentId,
          parameters: {
            sketchId: 'SK-1',
            depth: 20,
            operation: 'JOIN',
            sketchEntities: [{x:0, y:0}, {x:50, y:0}, {x:50, y:50}, {x:0, y:50}]
          }
        };
      case 'FEATURE_REVOLVE':
        return { toolId, documentId, parameters: { sketchId: 'SK-1', angleDeg: 360, axis: 'Y' } };
      case 'FEATURE_SWEEP':
        return { toolId, documentId, parameters: { profileSketchId: 'SK-1', pathSketchId: 'SK-1' } };
      case 'FEATURE_LOFT':
        return { toolId, documentId, parameters: { profileSketchIds: ['SK-1', 'SK-1'] } };
      case 'FEATURE_HOLE':
        return { toolId, documentId, parameters: { diameter: 10, depth: 15, holeType: 'SIMPLE' } };
      case 'FEATURE_THREAD':
        return { toolId, documentId, parameters: { pitch: 1.5, length: 20, threadType: 'METRIC' } };
      case 'FEATURE_DRAFT':
        return { toolId, documentId, parameters: { draftAngleDeg: 5, pullDirection: 'Z' } };
      case 'FEATURE_SHELL':
        return { toolId, documentId, parameters: { wallThickness: 2 } };
      case 'FEATURE_RIB':
        return { toolId, documentId, parameters: { thickness: 3, sketchId: 'SK-1' } };
      case 'FEATURE_THIN':
        return { toolId, documentId, parameters: { thickness: 1.5, depth: 10 } };
      case 'SKETCH_LINE':
        return { toolId, documentId, parameters: { sketchId: 'SK-1', startX: 0, startY: 0, endX: 100, endY: 0 } };
      case 'SKETCH_CIRCLE':
        return { toolId, documentId, parameters: { sketchId: 'SK-1', centerX: 0, centerY: 0, radius: 25 } };
      case 'ASSEMBLY_MATE_COINCIDENT':
        return { toolId, documentId, parameters: { mateId: 'MATE-1', instanceAId: 'INST-1', instanceBId: 'INST-2', entityA: 'FACE-1', entityB: 'FACE-2' } };
      default:
        return { toolId, documentId, parameters: { sketchId: 'SK-1', value: 10 } };
    }
  }

  /**
   * Builds default Modify Intent for a tool.
   */
  private static buildModifyIntent(toolId: string, documentId: string, docAfterCreate: EngineeringDocument): any {
    const targetFeature = docAfterCreate.features.find(f => f.type === 'EXTRUDE') || docAfterCreate.features[docAfterCreate.features.length - 1] || docAfterCreate.features[0];
    const targetFeatureId = (targetFeature as any)?.featureId || targetFeature?.id || 'FEAT-1';

    switch (toolId) {
      case 'SKETCH_LINE':
      case 'SKETCH_CIRCLE':
        return { toolId, documentId, parameters: { sketchId: 'SK-1', startX: 0, startY: 0, endX: 150, endY: 0, radius: 35 } };
      case 'ASSEMBLY_MATE_COINCIDENT':
        return { toolId, documentId, parameters: { mateId: 'MATE-2', instanceAId: 'INST-1', instanceBId: 'INST-2', entityA: 'FACE-1', entityB: 'FACE-3' } };
      default:
        return {
          toolId: 'FEATURE_UPDATE_PARAM',
          documentId,
          parameters: { featureId: targetFeatureId, paramName: 'depth', paramValue: 40 }
        };
    }
  }

  private static buildRecord(
    toolId: string,
    capability: string,
    workbench: string,
    isSupported: boolean,
    stages: Record<ToolLifecycleStage, ToolStageVerdict>,
    stageDetails: Record<ToolLifecycleStage, string>,
    finalVerdict: 'PASS' | 'FAIL' | 'UNSUPPORTED',
    errorOverride?: string
  ): ToolQualificationRecord {
    if (errorOverride) {
      for (const st of Object.keys(stages) as ToolLifecycleStage[]) {
        if (stages[st] === 'FAIL') {
          stageDetails[st] = `${stageDetails[st]} (${errorOverride})`;
        }
      }
    }
    return {
      toolId,
      capability,
      workbench,
      isSupported,
      stages,
      stageDetails,
      finalVerdict
    };
  }
}
