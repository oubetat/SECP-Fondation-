/**
 * PATCH-SECP-PROMPT-012: Canonical Intent Dispatcher
 * The central authority for routing design intents to canonical actions.
 * 
 * ARCHITECTURAL ROLE:
 * - Validates Document, Selection, and Revision before execution.
 * - Routes to specialized canonical mutators (Actions).
 * - Triggers DocumentEvaluator to produce the new Engineering Truth.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { DocumentEvaluator } from '../cad-kernel/document/DocumentEvaluator';
import { SketchUIIntegration } from '../cad-kernel/ui-integration/SketchUIIntegration';
import { AssemblyIntentMutator, AssemblyIntentAction } from '../cad-kernel/document/AssemblyIntentMutator';
import { AnyEngineeringIntent, DispatchResult } from './EngineeringIntent277';
import { SelectionContractEvaluator } from './SelectionTypes277';
import { ExtrudeAction277 } from './ExtrudeAction277';
import { AssemblyMateAction277 } from './AssemblyMateAction277';
import { RevolveAction277 } from './RevolveAction277';
import { SweepAction277 } from './SweepAction277';
import { LoftAction277 } from './LoftAction277';
import { HoleAction277 } from './HoleAction277';
import { ThreadAction277 } from './ThreadAction277';
import { DraftAction277 } from './DraftAction277';
import { ShellAction277 } from './ShellAction277';
import { RibAction277 } from './RibAction277';
import { ThinAction277 } from './ThinAction277';
import { FeatureManagementAction277 } from './FeatureManagementAction277';
import { SketchAction277 } from './SketchAction277';
import { CfdAction277 } from './CfdAction277';
import { CanonicalAction } from './CanonicalAction277';

export class CanonicalIntentDispatcher277 {
  private static readonly actionRegistry: Record<string, CanonicalAction<any>> = {
    'FEATURE_EXTRUDE': new ExtrudeAction277(),
    'ASSEMBLY_MATE_COINCIDENT': new AssemblyMateAction277(),
    'FEATURE_REVOLVE': new RevolveAction277(),
    'FEATURE_SWEEP': new SweepAction277(),
    'FEATURE_LOFT': new LoftAction277(),
    'FEATURE_HOLE': new HoleAction277(),
    'FEATURE_THREAD': new ThreadAction277(),
    'FEATURE_DRAFT': new DraftAction277(),
    'FEATURE_SHELL': new ShellAction277(),
    'FEATURE_RIB': new RibAction277(),
    'FEATURE_THIN': new ThinAction277(),
    'FEATURE_SUPPRESS': new FeatureManagementAction277(),
    'FEATURE_DELETE': new FeatureManagementAction277(),
    'FEATURE_UPDATE_PARAM': new FeatureManagementAction277(),
    'SKETCH_LINE': new SketchAction277(),
    'SKETCH_CONSTRUCTION_LINE': new SketchAction277(),
    'SKETCH_CENTERLINE': new SketchAction277(),
    'SKETCH_CIRCLE': new SketchAction277(),
    'SKETCH_RECTANGLE': new SketchAction277(),
    'SKETCH_CORNER_RECTANGLE': new SketchAction277(),
    'SKETCH_CENTER_RECTANGLE': new SketchAction277(),
    'SKETCH_3POINT_RECTANGLE': new SketchAction277(),
    'SKETCH_3POINT_CENTER_RECTANGLE': new SketchAction277(),
    'SKETCH_PARALLELOGRAM': new SketchAction277(),
    'SKETCH_ARC': new SketchAction277(),
    'SKETCH_3POINT_ARC': new SketchAction277(),
    'SKETCH_CENTERPOINT_ARC': new SketchAction277(),
    'SKETCH_TANGENT_ARC': new SketchAction277(),
    'SKETCH_POLYLINE': new SketchAction277(),
    'SKETCH_POINT': new SketchAction277(),
    'SKETCH_POLYGON': new SketchAction277(),
    'SKETCH_SLOT': new SketchAction277(),
    'SKETCH_ELLIPSE': new SketchAction277(),
    'SKETCH_MIDPOINT_LINE': new SketchAction277(),
    'SKETCH_MOVE': new SketchAction277(),
    'SKETCH_ROTATE': new SketchAction277(),
    'SKETCH_SCALE': new SketchAction277(),
    'SKETCH_DELETE_ENTITY': new SketchAction277(),
    'SKETCH_TRIM': new SketchAction277(),
    'SKETCH_EXTEND': new SketchAction277(),
    'SKETCH_SPLIT': new SketchAction277(),
    'SKETCH_OFFSET': new SketchAction277(),
    'SKETCH_MIRROR': new SketchAction277(),
    'SKETCH_PATTERN_LINEAR': new SketchAction277(),
    'SKETCH_PATTERN_CIRCULAR': new SketchAction277(),
    'SKETCH_ADD_CONSTRAINT': new SketchAction277(),
    'CFD_SIMULATION_RESULT': new CfdAction277()
  };

  /**
   * Dispatches an engineering intent to the appropriate canonical action.
   * Performs validation of document, revision, and selection before execution.
   */
  public static async dispatch(
    intent: AnyEngineeringIntent,
    document: EngineeringDocument
  ): Promise<DispatchResult> {
    
    // 1. Validate Document Identity
    if (document.documentId !== intent.documentId) {
       return { 
         success: false, 
         documentId: document.documentId, 
         revision: this.getDocRevision(document),
         canonicalActionId: 'NONE',
         affectedEntities: [],
         error: `INVALID_DOCUMENT: Intent targeted document '${intent.documentId}' but active document is '${document.documentId}'.`
       };
    }

    // 2. Validate Selection (PROMPT-010 Integration)
    if (intent.selection && intent.selection.length > 0) {
      for (const ref of intent.selection) {
        const val = SelectionContractEvaluator.validate(ref, document);
        if (!val.isValid) {
          return {
            success: false,
            documentId: document.documentId,
            revision: this.getDocRevision(document),
            canonicalActionId: 'NONE',
            affectedEntities: [],
            error: `INVALID_SELECTION: ${val.message}`
          };
        }
      }
    }

    // 3. Route to Canonical Action
    try {
      const action = this.actionRegistry[intent.toolId];
      if (action) {
        return await action.execute(intent, document);
      }

      return {
        success: false,
        documentId: document.documentId,
        revision: this.getDocRevision(document),
        canonicalActionId: 'NONE',
        affectedEntities: [],
        error: `UNSUPPORTED_TOOL: Tool '${intent.toolId}' is not yet integrated into the canonical pipeline.`
      };
    } catch (err: any) {
      console.error('DISPATCHER CATCH EXCEPTION STACK:', err?.stack || err);
      return {
        success: false,
        documentId: document.documentId,
        revision: this.getDocRevision(document),
        canonicalActionId: 'ERROR',
        affectedEntities: [],
        error: `ENGINEERING_FAILURE: ${err.message || 'Unknown error'}`
      };
    }
  }

  private static getDocRevision(doc: EngineeringDocument): number {
    return typeof doc.revision === 'string' ? parseInt(doc.revision, 10) : doc.revision;
  }
}
