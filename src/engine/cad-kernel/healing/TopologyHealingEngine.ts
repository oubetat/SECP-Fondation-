/**
 * SECP CAD Kernel — Deterministic Topology Healing Engine
 * Phase 2 (PATCH-020)
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Transactional healing: original shape is never mutated if repair fails or is rejected.
 * 2. Strict defect detection, classification, repair planning, validation, and evidence generation.
 * 3. Never silently modifies geometry or topology.
 * 4. Never converts failed repair into PASS.
 * 5. Idempotent: Heal(Heal(Model)) === Heal(Model).
 * 6. Deterministic output & cryptographic evidence chain integration.
 */

import {
  HealingResult,
  HealingStatus,
  HealingDefect,
  HealingRepair,
  HealingRepairRejection,
  HealingProvenance,
  BeforeAfterComparison,
  HealingValidationResult
} from './HealingTypes';
import { TopologyDefectDetector } from './TopologyDefectDetector';
import { HealingRepairPlanner } from './HealingRepairPlanner';
import { HealingValidator } from './HealingValidator';
import { HealingEvidence } from './HealingEvidence';
import { ToleranceHealing } from './ToleranceHealing';
import { VertexHealing } from './VertexHealing';
import { EdgeHealing } from './EdgeHealing';
import { WireHealing } from './WireHealing';
import { FaceHealing } from './FaceHealing';
import { ShellHealing } from './ShellHealing';
import { SolidHealing } from './SolidHealing';
import { GeometryHealing } from './GeometryHealing';
import { GeometricTolerance, GeometricToleranceModel } from '../predicates/GeometricTolerance';

export class TopologyHealingEngine {
  private validator: HealingValidator;

  constructor() {
    this.validator = new HealingValidator();
  }

  public heal(
    inputShape: any,
    provenanceOrigin: 'IMPORTED' | 'KERNEL_GENERATED' | 'BOOLEAN_OUTPUT' | 'UNKNOWN' = 'KERNEL_GENERATED',
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): HealingResult {
    const inputShapeId = inputShape?.id || 'unknown_shape';

    // 1. Validate basic input existence
    if (!inputShape || typeof inputShape !== 'object') {
      const defects = [
        {
          defectId: 'def_input_null',
          defectType: 'INVALID_CONTAINMENT' as const,
          severity: 'CRITICAL' as const,
          entityIds: [inputShapeId],
          description: 'Input shape is null or invalid object',
          repairability: 'UNSUPPORTED' as const
        }
      ];

      const validation: HealingValidationResult = {
        isValid: false,
        remainingDefects: defects,
        brepValidationStatus: 'INVALID',
        geometryPreserved: true,
        topologyPreserved: true,
        details: 'Invalid input artifact'
      };

      const result: HealingResult = {
        inputShapeId,
        status: 'INVALID_INPUT',
        defectsDetected: defects,
        repairsApplied: [],
        repairsRejected: [
          {
            repairId: 'rej_input_null',
            defectId: 'def_input_null',
            action: 'INSPECT_INPUT',
            targetEntityIds: [inputShapeId],
            reason: 'Input shape is null or malformed object',
            classification: 'UNSUPPORTED'
          }
        ],
        validation,
        tolerancePolicy: ToleranceHealing.getPolicyReference(model),
        provenance: HealingEvidence.createProvenance(provenanceOrigin, inputShapeId),
        determinismHash: ''
      };

      result.determinismHash = HealingEvidence.computeDeterminismHash(result);
      return result;
    }

    // 2. BEGIN TRANSACTION: Deep clone candidate shape
    const candidateShape = JSON.parse(JSON.stringify(inputShape));

    // 3. DETECT INITIAL DEFECTS
    const defectsDetected = TopologyDefectDetector.detectDefects(candidateShape, model);
    const initialValidation = this.validator.validateShape(candidateShape, defectsDetected);

    // 4. IF ALREADY VALID & NO DEFECTS -> UNCHANGED_VALID
    if (defectsDetected.length === 0 && initialValidation.isValid) {
      const comparison: BeforeAfterComparison = HealingEvidence.createComparison(
        inputShape,
        inputShape,
        0,
        0,
        'VALID',
        'VALID',
        ['Model verified valid. No topology repair required.']
      );

      const result: HealingResult = {
        inputShapeId,
        outputShapeId: inputShapeId,
        status: 'UNCHANGED_VALID',
        defectsDetected: [],
        repairsApplied: [],
        repairsRejected: [],
        validation: initialValidation,
        tolerancePolicy: ToleranceHealing.getPolicyReference(model),
        provenance: HealingEvidence.createProvenance(provenanceOrigin, inputShapeId),
        beforeAfterComparison: comparison,
        determinismHash: ''
      };

      result.determinismHash = HealingEvidence.computeDeterminismHash(result);
      return result;
    }

    // 5. PLAN REPAIRS
    const plan = HealingRepairPlanner.createPlan(defectsDetected, model);
    const repairsApplied: HealingRepair[] = [];
    const repairsRejected: HealingRepairRejection[] = [...plan.rejections];
    const justifications: string[] = [];

    let isModified = false;

    // 6. EXECUTE REPAIRS IN DETERMINISTIC ORDER
    for (const item of plan.plannedRepairs) {
      const { defect, action } = item;

      let repairRes: { repair?: HealingRepair; rejection?: HealingRepairRejection; modified: boolean } = { modified: false };

      switch (action) {
        case 'MERGE_VERTEX':
          repairRes = VertexHealing.healVertices(candidateShape, defect, model);
          break;
        case 'REMOVE_ZERO_LENGTH_EDGE':
        case 'CORRECT_EDGE_ENDPOINTS':
          repairRes = EdgeHealing.healEdge(candidateShape, defect, model);
          break;
        case 'REORDER_AND_CLOSE_WIRE':
          repairRes = WireHealing.healWire(candidateShape, defect, model);
          break;
        case 'FIX_FACE_ORIENTATION':
          repairRes = FaceHealing.healFace(candidateShape, defect, model);
          break;
        default:
          repairRes = {
            rejection: {
              repairId: `rep_${defect.defectId}`,
              defectId: defect.defectId,
              action,
              targetEntityIds: defect.entityIds,
              reason: `Unrecognized repair action ${action}`,
              classification: 'UNSUPPORTED'
            },
            modified: false
          };
      }

      if (repairRes.repair) {
        repairsApplied.push(repairRes.repair);
        justifications.push(`MODIFIED: ${repairRes.repair.justification}`);
      }
      if (repairRes.rejection) {
        repairsRejected.push(repairRes.rejection);
        justifications.push(`REJECTED: ${repairRes.rejection.reason}`);
      }
      if (repairRes.modified) {
        isModified = true;
      }
    }

    // 7. POST-REPAIR DEFECT DETECTION & VALIDATION
    const remainingDefects = TopologyDefectDetector.detectDefects(candidateShape, model);
    const postValidation = this.validator.validateShape(candidateShape, remainingDefects);

    // 8. DETERMINE STATUS & COMMIT/ROLLBACK
    let finalStatus: HealingStatus = 'REPAIR_FAILED';
    let outputShape: any = undefined;

    const hasCriticalDefect = remainingDefects.some(d => d.severity === 'CRITICAL' || d.severity === 'ERROR');

    if (postValidation.isValid && remainingDefects.length === 0) {
      finalStatus = 'REPAIRED_VALID';
      outputShape = candidateShape;
    } else if (isModified && !hasCriticalDefect && repairsApplied.length > 0) {
      finalStatus = 'PARTIALLY_REPAIRED';
      outputShape = candidateShape;
    } else {
      // ROLLBACK: Transaction failed, restore original input
      finalStatus = 'REPAIR_FAILED';
      outputShape = undefined;
    }

    const comparison: BeforeAfterComparison = HealingEvidence.createComparison(
      inputShape,
      outputShape || inputShape,
      defectsDetected.length,
      remainingDefects.length,
      initialValidation.brepValidationStatus,
      postValidation.brepValidationStatus,
      justifications
    );

    const result: HealingResult = {
      inputShapeId,
      outputShapeId: outputShape ? outputShape.id : undefined,
      status: finalStatus,
      defectsDetected,
      repairsApplied,
      repairsRejected,
      validation: postValidation,
      tolerancePolicy: ToleranceHealing.getPolicyReference(model),
      provenance: HealingEvidence.createProvenance(provenanceOrigin, inputShapeId),
      beforeAfterComparison: comparison,
      determinismHash: ''
    };

    result.determinismHash = HealingEvidence.computeDeterminismHash(result);
    return result;
  }
}
