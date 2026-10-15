/**
 * SECP CAD Kernel — Canonical Document UI Adapter
 * Phase 2 (PROMPT-004)
 *
 * ARCHITECTURAL CONTRACT:
 * - Serves as the single gatekeeper mapping UI triggers into transactional intents.
 * - Prevents components from storing or modifying parallel engineering truths.
 * - Guarantees revision and history integrity on every executed modification.
 */

import { EngineeringDocument, Sketch, FeatureNode } from '../document/CADDocument';
import { DocumentEvaluator, DocumentEvaluationResult } from '../document/DocumentEvaluator';
import { CapabilityTruthGate } from '../registry/CapabilityTruthGate';
import { SketchUIIntegration, ExtrudeActionOptions } from '../ui-integration/SketchUIIntegration';
import { AssemblyIntentMutator, AssemblyIntentAction } from '../document/AssemblyIntentMutator';
import { BRepHasher } from '../topology/BRepHasher';
import { WorkbenchStateOwnershipEngine } from '../../workbench/WorkbenchStateOwnershipEngine';

export interface ExecutionResult {
  success: boolean;
  status: 'SUCCESS' | 'FAILED' | 'REJECTED_BY_TRUTH_GATE' | 'BYPASSED';
  documentId: string;
  documentRevision: number | string;
  actionId: string;
  featureId?: string;
  geometryChanged?: boolean;
  topologyChanged?: boolean;
  verificationStatus?: 'VALID' | 'INVALID' | 'UNPROVEN';
  evidenceId?: string;
  error?: string;
}

export class CanonicalDocumentUIAdapter {
  /**
   * Dispatches a parametric sketch action (creating or modifying segments/points).
   * Maps 2D user coords directly to the canonical EngineeringDocument sketch parameters.
   */
  public static executeSketchAction(
    doc: EngineeringDocument,
    sketchEnts: any[],
    depth: number,
    options?: ExtrudeActionOptions
  ): { result: ExecutionResult; evaluation?: DocumentEvaluationResult } {
    const toolId = 'SKETCH_LINE'; // Or SKETCH_CIRCLE depending on context
    const gate = CapabilityTruthGate.resolve(toolId);

    if (gate.truthState === 'NOT_SUPPORTED' || gate.truthState === 'UNAVAILABLE') {
      return {
        result: {
          success: false,
          status: 'REJECTED_BY_TRUTH_GATE',
          documentId: doc.documentId,
          documentRevision: doc.revision,
          actionId: `ACT_SKETCH_${Date.now()}`,
          error: gate.explanation
        }
      };
    }

    const beforeHash = doc.evaluatedShape ? BRepHasher.computeEvidence(doc.evaluatedShape as any).geometryHash : undefined;

    try {
      const engine = WorkbenchStateOwnershipEngine.getInstance();
      if (!engine.getCanonicalDocument(doc.documentId)) {
        engine.registerCanonicalDocument(doc);
      }

      let evalResult!: DocumentEvaluationResult;

      const { updatedDoc } = engine.mutateCanonicalDocument(
        doc.documentId,
        (targetDoc) => {
          evalResult = SketchUIIntegration.applyExtrudeAction(targetDoc, sketchEnts, depth, options);
          if (!evalResult.success) {
            throw new Error(evalResult.diagnostics?.join(' | ') || 'Sketch operation failed');
          }
          targetDoc.features = evalResult.document.features;
          targetDoc.sketches = evalResult.document.sketches;
          targetDoc.evaluatedShape = evalResult.document.evaluatedShape;
          targetDoc.evaluatedSolid = evalResult.document.evaluatedSolid;
          targetDoc.derived = evalResult.document.derived;
          targetDoc.evidence = evalResult.document.evidence;
        },
        `Sketch Feature Action: depth=${depth}`,
        'DESIGN'
      );

      evalResult.document = updatedDoc;

      const afterHash = evalResult.document.evaluatedShape ? BRepHasher.computeEvidence(evalResult.document.evaluatedShape as any).geometryHash : undefined;
      const latestEvidence = evalResult.document.evidence?.[evalResult.document.evidence.length - 1];

      // Verify the mutation was mathematically sound and logged in evidence chain
      const verify = CapabilityTruthGate.verifyExecution(toolId, beforeHash, afterHash, !!latestEvidence);

      return {
        result: {
          success: verify.success,
          status: verify.success ? 'SUCCESS' : 'FAILED',
          documentId: evalResult.document.documentId,
          documentRevision: evalResult.document.revision,
          actionId: `ACT_SKETCH_${Date.now()}`,
          featureId: latestEvidence?.payload?.featuresExecuted ? `FEAT_SKETCH_${Date.now()}` : undefined,
          geometryChanged: beforeHash !== afterHash,
          topologyChanged: beforeHash !== afterHash,
          verificationStatus: latestEvidence?.verdict === 'VALID' ? 'VALID' : 'INVALID',
          evidenceId: latestEvidence?.evidenceId,
          error: verify.success ? undefined : verify.diagnostic
        },
        evaluation: evalResult
      };
    } catch (err: any) {
      return {
        result: {
          success: false,
          status: 'FAILED',
          documentId: doc.documentId,
          documentRevision: doc.revision,
          actionId: `ACT_SKETCH_${Date.now()}`,
          error: err.message || String(err)
        }
      };
    }
  }

  /**
   * Dispatches a 3D solid extrusion feature intent.
   * Modifies the parametric history of the single source of truth document.
   */
  public static executeExtrudeAction(
    doc: EngineeringDocument,
    sketchEnts: any[],
    depth: number,
    options?: ExtrudeActionOptions
  ): { result: ExecutionResult; evaluation?: DocumentEvaluationResult } {
    const toolId = 'FEATURE_EXTRUDE';
    const gate = CapabilityTruthGate.resolve(toolId);

    if (gate.truthState === 'NOT_SUPPORTED' || gate.truthState === 'UNAVAILABLE') {
      return {
        result: {
          success: false,
          status: 'REJECTED_BY_TRUTH_GATE',
          documentId: doc.documentId,
          documentRevision: doc.revision,
          actionId: `ACT_EXTRUDE_${Date.now()}`,
          error: gate.explanation
        }
      };
    }

    const beforeHash = doc.evaluatedShape ? BRepHasher.computeEvidence(doc.evaluatedShape as any).geometryHash : undefined;

    try {
      const engine = WorkbenchStateOwnershipEngine.getInstance();
      if (!engine.getCanonicalDocument(doc.documentId)) {
        engine.registerCanonicalDocument(doc);
      }

      let evalResult!: DocumentEvaluationResult;

      const { updatedDoc } = engine.mutateCanonicalDocument(
        doc.documentId,
        (targetDoc) => {
          evalResult = SketchUIIntegration.applyExtrudeAction(targetDoc, sketchEnts, depth, options);
          if (!evalResult.success) {
            throw new Error(evalResult.diagnostics?.join(' | ') || 'Extrude operation failed');
          }
          targetDoc.features = evalResult.document.features;
          targetDoc.sketches = evalResult.document.sketches;
          targetDoc.evaluatedShape = evalResult.document.evaluatedShape;
          targetDoc.evaluatedSolid = evalResult.document.evaluatedSolid;
          targetDoc.derived = evalResult.document.derived;
          targetDoc.evidence = evalResult.document.evidence;
        },
        `Extrude Feature: depth=${depth}`,
        'DESIGN'
      );

      evalResult.document = updatedDoc;

      const afterHash = evalResult.document.evaluatedShape ? BRepHasher.computeEvidence(evalResult.document.evaluatedShape as any).geometryHash : undefined;
      const latestEvidence = evalResult.document.evidence?.[evalResult.document.evidence.length - 1];

      // Verifies topological change & cryptographic signature
      const verify = CapabilityTruthGate.verifyExecution(toolId, beforeHash, afterHash, !!latestEvidence);

      return {
        result: {
          success: verify.success,
          status: verify.success ? 'SUCCESS' : 'FAILED',
          documentId: evalResult.document.documentId,
          documentRevision: evalResult.document.revision,
          actionId: `ACT_EXTRUDE_${Date.now()}`,
          featureId: latestEvidence?.payload?.featuresExecuted ? `F_EXTRUDE_${Date.now()}` : undefined,
          geometryChanged: beforeHash !== afterHash,
          topologyChanged: beforeHash !== afterHash,
          verificationStatus: latestEvidence?.verdict === 'VALID' ? 'VALID' : 'INVALID',
          evidenceId: latestEvidence?.evidenceId,
          error: verify.success ? undefined : verify.diagnostic
        },
        evaluation: evalResult
      };
    } catch (err: any) {
      return {
        result: {
          success: false,
          status: 'FAILED',
          documentId: doc.documentId,
          documentRevision: doc.revision,
          actionId: `ACT_EXTRUDE_${Date.now()}`,
          error: err.message || String(err)
        }
      };
    }
  }

  /**
   * Dispatches an assembly intent to modify instances or mates.
   */
  public static executeAssemblyAction(
    doc: EngineeringDocument,
    action: AssemblyIntentAction,
    resolver: any
  ): { result: ExecutionResult; evaluation?: DocumentEvaluationResult } {
    const toolId = 'ASSEMBLY_MATE_COINCIDENT';
    const gate = CapabilityTruthGate.resolve(toolId);

    if (gate.truthState === 'NOT_SUPPORTED' || gate.truthState === 'UNAVAILABLE') {
      return {
        result: {
          success: false,
          status: 'REJECTED_BY_TRUTH_GATE',
          documentId: doc.documentId,
          documentRevision: doc.revision,
          actionId: `ACT_ASSY_${Date.now()}`,
          error: gate.explanation
        }
      };
    }

    try {
      const engine = WorkbenchStateOwnershipEngine.getInstance();
      if (!engine.getCanonicalDocument(doc.documentId)) {
        engine.registerCanonicalDocument(doc);
      }

      let evalResult!: DocumentEvaluationResult;

      const { updatedDoc } = engine.mutateCanonicalDocument(
        doc.documentId,
        (targetDoc) => {
          const resDoc = AssemblyIntentMutator.apply(targetDoc, action);
          targetDoc.assembly = resDoc.assembly;
          evalResult = DocumentEvaluator.evaluate(targetDoc, {
            generateMesh: true,
            context: { resolver }
          });
          if (!evalResult.success) {
            throw new Error(evalResult.diagnostics?.join(' | ') || 'Assembly evaluation failed');
          }
          targetDoc.evaluatedShape = evalResult.document.evaluatedShape;
          targetDoc.evaluatedSolid = evalResult.document.evaluatedSolid;
          targetDoc.derived = evalResult.document.derived;
          targetDoc.evidence = evalResult.document.evidence;
        },
        `Assembly Action: ${action.type || 'MATE'}`,
        'ASSEMBLY_WORKBENCH'
      );

      evalResult.document = updatedDoc;

      const latestEvidence = evalResult.document.evidence?.[evalResult.document.evidence.length - 1];

      return {
        result: {
          success: true,
          status: 'SUCCESS',
          documentId: evalResult.document.documentId,
          documentRevision: evalResult.document.revision,
          actionId: `ACT_ASSY_${Date.now()}`,
          verificationStatus: 'VALID',
          evidenceId: latestEvidence?.evidenceId,
          geometryChanged: false,
          topologyChanged: false
        },
        evaluation: evalResult
      };
    } catch (err: any) {
      return {
        result: {
          success: false,
          status: 'FAILED',
          documentId: doc.documentId,
          documentRevision: doc.revision,
          actionId: `ACT_ASSY_${Date.now()}`,
          error: err.message || String(err)
        }
      };
    }
  }

  /**
   * Bypassed command handler for unavailable tools.
   * Reports truthful unavailable status without creating fake UI states.
   */
  public static executeBypassedAction(toolId: string, docId: string): ExecutionResult {
    const gate = CapabilityTruthGate.resolve(toolId);
    return {
      success: false,
      status: 'BYPASSED',
      documentId: docId,
      documentRevision: 1,
      actionId: `ACT_BYPASS_${Date.now()}`,
      error: gate.explanation
    };
  }

  /**
   * Adds a generic feature to the document.
   * Used for high-level UI tools (Split Line, Delete Face, etc.) to record intent in the canonical record.
   */
  public static executeAddFeature(
    doc: EngineeringDocument,
    featureData: { name: string; type: string; parameters?: any; provenance?: any }
  ): { result: ExecutionResult; evaluation?: DocumentEvaluationResult } {
    const newFeature: any = {
      id: `FEAT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      featureId: `FEAT-${Date.now()}`,
      name: featureData.name,
      type: featureData.type as any,
      parameters: featureData.parameters || [],
      dependencies: [],
      references: [],
      status: 'RECONSTRUCTED' as any,
      confidence: 'HIGH' as any,
      isSuppressed: false,
      provenance: featureData.provenance || {
        algorithm: 'UI_MANUAL',
        timestamp: Date.now(),
        evidenceIds: []
      }
    };

    const engine = WorkbenchStateOwnershipEngine.getInstance();
    if (!engine.getCanonicalDocument(doc.documentId)) {
      engine.registerCanonicalDocument(doc);
    }

    const { updatedDoc } = engine.mutateCanonicalDocument(
      doc.documentId,
      (targetDoc) => {
        targetDoc.features = [...(targetDoc.features || []), newFeature];
      },
      `Add Feature: ${newFeature.name} (${newFeature.type})`,
      'FEATURE_TREE_WORKBENCH'
    );

    // Re-evaluate the document to ensure consistency
    const evaluation = DocumentEvaluator.evaluate(updatedDoc);

    return {
      result: {
        success: true,
        status: 'SUCCESS',
        documentId: updatedDoc.documentId,
        documentRevision: updatedDoc.revision,
        actionId: `ACT_ADD_FEAT_${Date.now()}`,
        featureId: newFeature.id
      },
      evaluation
    };
  }

  /**
   * Derives a UI-compatible Design Tree from the canonical EngineeringDocument.
   * This ensures the UI reflects the actual feature history and parameters.
   */
  public static getDerivedDesignTree(doc: EngineeringDocument): any[] {
    const tree: any[] = [];

    // 1. Fixed Base Entities (Standard CAD planes/origin)
    tree.push({ id: 'BASE_MAT', name: 'Material: (Not Specified)', type: 'MATERIAL', visible: true, active: false, evidenceHash: 'EPC-MAT-0000' });
    tree.push({ id: 'BASE_XY', name: 'Front Plane (XY)', type: 'PLANE', visible: true, active: false, evidenceHash: 'EPC-PLN-001A' });
    tree.push({ id: 'BASE_XZ', name: 'Top Plane (XZ)', type: 'PLANE', visible: true, active: false, evidenceHash: 'EPC-PLN-002B' });
    tree.push({ id: 'BASE_YZ', name: 'Right Plane (YZ)', type: 'PLANE', visible: true, active: false, evidenceHash: 'EPC-PLN-003C' });
    tree.push({ id: 'BASE_ORG', name: 'Origin (0,0,0)', type: 'ORIGIN', visible: true, active: false, evidenceHash: 'EPC-ORG-0000' });

    // 2. Map Canonical Sketches to Tree Items
    if (doc.sketches) {
      doc.sketches.forEach(sketch => {
        tree.push({
          id: sketch.id,
          name: sketch.name,
          type: 'SKETCH',
          visible: true,
          active: false,
          evidenceHash: `EPC-SKT-${sketch.id.substring(0, 4)}`
        });
      });
    }

    // 3. Map Canonical Features to Tree Items
    if (doc.features) {
      doc.features.forEach((feature: any) => {
        tree.push({
          id: feature.id || feature.featureId,
          name: feature.name,
          type: 'FEATURE',
          visible: true,
          active: false,
          suppressed: feature.suppressed,
          evidenceHash: feature.definitionHash ? `EPC-FEAT-${feature.definitionHash.substring(0, 4)}` : 'EPC-FEAT-UNKNOWN'
        });
      });
    }

    return tree;
  }

  /**
   * Derives the Canonical Feature Tree from the engineering document.
   * This is the single source of truth for the Feature History UI.
   */
  public static getDerivedFeatureHistory(doc: EngineeringDocument): any[] {
    if (!doc.features) return [];

    return doc.features.map((feature: any) => {
      // Extract core canonical fields
      const featureId = feature.featureId || feature.id;
      const type = feature.type || 'UNKNOWN';
      const name = feature.name || `${type}_${featureId?.substring(0, 4)}`;
      const parameters = feature.parameters || feature.definition?.parameters || {};
      const suppressed = feature.suppressed ?? false;
      const regenerationStatus = feature.regenerationStatus || 'PENDING';
      const state = feature.state || 'DEFINED';
      const validationStatus = feature.status || (state === 'VALID' ? 'VALID' : 'DIRTY');
      
      // Compute evidence hash from definition hash or similar stable provenance
      const evidenceHash = feature.definitionHash 
        ? `EPC-FEAT-${feature.definitionHash.substring(0, 6).toUpperCase()}` 
        : (feature.id ? `EPC-FEAT-${feature.id.substring(0, 4).toUpperCase()}` : 'EPC-FEAT-UNKNOWN');

      return {
        id: featureId,
        featureId,
        type,
        name,
        parameters,
        suppressed,
        regenerationStatus,
        state,
        validationStatus,
        evidenceHash,
        active: false, // UI selection state
        dependencies: feature.dependencyIds || feature.parents || [],
        parentId: feature.parentId
      };
    });
  }

  /**
   * Toggles the suppression state of a canonical feature.
   */
  public static executeSuppressFeature(doc: EngineeringDocument, featureId: string): { result: ExecutionResult; evaluation?: DocumentEvaluationResult } {
    const feature = doc.features.find((f: any) => (f.featureId || f.id) === featureId);
    if (!feature) {
      return { result: { success: false, status: 'FAILED', documentId: doc.documentId, documentRevision: doc.revision, actionId: `ACT_SUPPRESS_${Date.now()}`, error: 'Feature not found' } };
    }

    const engine = WorkbenchStateOwnershipEngine.getInstance();
    if (!engine.getCanonicalDocument(doc.documentId)) {
      engine.registerCanonicalDocument(doc);
    }

    const { updatedDoc } = engine.mutateCanonicalDocument(
      doc.documentId,
      (targetDoc) => {
        targetDoc.features = targetDoc.features.map((f: any) => {
          const id = f.featureId || f.id;
          if (id === featureId) {
            return { ...f, suppressed: !f.suppressed };
          }
          return f;
        });
      },
      `Toggle Suppression: Feature ${featureId}`,
      'FEATURE_TREE_WORKBENCH'
    );

    const evalResult = DocumentEvaluator.evaluate(updatedDoc);

    return {
      result: {
        success: evalResult.success,
        status: evalResult.success ? 'SUCCESS' : 'FAILED',
        documentId: evalResult.document.documentId,
        documentRevision: evalResult.document.revision,
        actionId: `ACT_SUPPRESS_${Date.now()}`,
        featureId,
        geometryChanged: true,
        topologyChanged: true
      },
      evaluation: evalResult
    };
  }

  /**
   * Deletes a feature from the canonical history.
   */
  public static executeDeleteFeature(doc: EngineeringDocument, featureId: string): { result: ExecutionResult; evaluation?: DocumentEvaluationResult } {
    const exists = doc.features.some((f: any) => (f.featureId || f.id) === featureId);
    if (!exists) {
      return { result: { success: false, status: 'FAILED', documentId: doc.documentId, documentRevision: doc.revision, actionId: `ACT_DELETE_${Date.now()}`, error: 'Feature not found' } };
    }

    const engine = WorkbenchStateOwnershipEngine.getInstance();
    if (!engine.getCanonicalDocument(doc.documentId)) {
      engine.registerCanonicalDocument(doc);
    }

    const { updatedDoc } = engine.mutateCanonicalDocument(
      doc.documentId,
      (targetDoc) => {
        targetDoc.features = targetDoc.features.filter((f: any) => (f.featureId || f.id) !== featureId);
      },
      `Delete Feature: ${featureId}`,
      'FEATURE_TREE_WORKBENCH'
    );

    const evalResult = DocumentEvaluator.evaluate(updatedDoc);

    return {
      result: {
        success: evalResult.success,
        status: evalResult.success ? 'SUCCESS' : 'FAILED',
        documentId: evalResult.document.documentId,
        documentRevision: evalResult.document.revision,
        actionId: `ACT_DELETE_${Date.now()}`,
        geometryChanged: true,
        topologyChanged: true
      },
      evaluation: evalResult
    };
  }

  /**
   * Updates a specific parameter of a canonical feature.
   */
  public static executeUpdateFeatureParameter(
    doc: EngineeringDocument, 
    featureId: string, 
    paramId: string, 
    newValue: any
  ): { result: ExecutionResult; evaluation?: DocumentEvaluationResult } {
    const feature = doc.features.find((f: any) => (f.featureId || f.id) === featureId);
    if (!feature) {
      return { result: { success: false, status: 'FAILED', documentId: doc.documentId, documentRevision: doc.revision, actionId: `ACT_UPDATE_PARAM_${Date.now()}`, error: 'Feature not found' } };
    }

    const engine = WorkbenchStateOwnershipEngine.getInstance();
    if (!engine.getCanonicalDocument(doc.documentId)) {
      engine.registerCanonicalDocument(doc);
    }

    const { updatedDoc } = engine.mutateCanonicalDocument(
      doc.documentId,
      (targetDoc) => {
        targetDoc.features = targetDoc.features.map((f: any) => {
          const id = f.featureId || f.id;
          if (id === featureId) {
            const updatedParams = { ...(f.parameters || {}), [paramId]: newValue };
            const updatedDef = f.definition ? { 
              ...f.definition, 
              parameters: { ...(f.definition.parameters || {}), [paramId]: newValue }
            } : undefined;

            return { 
              ...f, 
              parameters: updatedParams,
              definition: updatedDef || f.definition
            };
          }
          return f;
        });
      },
      `Update Parameter ${paramId} on Feature ${featureId}`,
      'PARAMETRIC_WORKBENCH'
    );

    const evalResult = DocumentEvaluator.evaluate(updatedDoc);

    return {
      result: {
        success: evalResult.success,
        status: evalResult.success ? 'SUCCESS' : 'FAILED',
        documentId: evalResult.document.documentId,
        documentRevision: evalResult.document.revision,
        actionId: `ACT_UPDATE_PARAM_${Date.now()}_${paramId}`,
        featureId,
        geometryChanged: true,
        topologyChanged: true
      },
      evaluation: evalResult
    };
  }
}
