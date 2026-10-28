import { Matrix } from "./MathUtils";
import { DOFComponent, ElementMatrixResult, ElementStressStrainResult, FEMElement, FEMModel } from "./FEMTypes";
import { FEMElementFormulation } from "./FEMElementFormulation";
import { FEMDOFManager } from "./FEMDOFManager";
import { CoordinateFrameTransformEngine } from "./GeometryMaterialAssignment";

export class Bar1DFormulation implements FEMElementFormulation {
  getRequiredDOFs(): DOFComponent[] {
    return [DOFComponent.UX];
  }

  private resolveEvaluationPoint(
    element: FEMElement,
    model: FEMModel,
    globalPoint: { x: number; y: number; z: number }
  ): { x: number; y: number; z: number } {
    let frame = model.geometryMetadata?.coordinateFrame;
    if (model.materialAssignments) {
      if (element.assignmentId && model.materialAssignments.has(element.assignmentId)) {
        frame = model.materialAssignments.get(element.assignmentId)!.coordinateFrame;
      } else {
        for (const assignment of model.materialAssignments.values()) {
          if (assignment.spatialFieldId === element.spatialFieldId) {
            frame = assignment.coordinateFrame;
            break;
          }
        }
      }
    }
    if (frame && frame.frameType !== 'GLOBAL_CARTESIAN') {
      return CoordinateFrameTransformEngine.toLocal(globalPoint, frame);
    }
    return globalPoint;
  }

  computeMatrices(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager
  ): ElementMatrixResult {
    const node1 = model.nodes.get(element.nodeIds[0])!;
    const node2 = model.nodes.get(element.nodeIds[1])!;
    const material = model.materials.get(element.materialId)!;
    const section = model.sections.get(element.sectionId)!;

    if (!section || !section.area) throw new Error("Bar element requires section area");
    if (!material || material.E <= 0 || !Number.isFinite(material.E)) {
      throw new Error(`[INVALID_MATERIAL] Invalid material Young's modulus E=${material?.E}`);
    }

    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    const dz = node2.z - node1.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (L <= 0 || !Number.isFinite(L)) throw new Error("[ZERO_LENGTH_ELEMENT] Zero or invalid length element");

    let E = material.E;
    if (element.spatialFieldId) {
      if (!model.spatialMaterialFields || !model.spatialMaterialFields.has(element.spatialFieldId)) {
        throw new Error(`[SPATIAL_FIELD_NOT_FOUND] Spatial material field '${element.spatialFieldId}' not found in model for element '${element.elementId}'.`);
      }
      const field = model.spatialMaterialFields.get(element.spatialFieldId)!;
      if (field.baseMaterialId && field.baseMaterialId !== element.materialId) {
        throw new Error(`[SPATIAL_FIELD_MATERIAL_MISMATCH] Field base material '${field.baseMaterialId}' does not match element material '${element.materialId}' on element '${element.elementId}'.`);
      }
      const midX = (node1.x + node2.x) / 2.0;
      const midY = (node1.y + node2.y) / 2.0;
      const midZ = (node1.z + node2.z) / 2.0;
      const evalPoint = this.resolveEvaluationPoint(element, model, { x: midX, y: midY, z: midZ });
      const props = field.evaluate(evalPoint);
      if (props.E === undefined) {
        throw new Error(`[SPATIAL_FIELD_MISSING_PROPERTY] Spatial field '${element.spatialFieldId}' does not define mandatory property 'E' required by Bar1DFormulation for element '${element.elementId}'.`);
      }
      if (props.E <= 0 || !Number.isFinite(props.E)) {
        throw new Error(`[INVALID_SPATIAL_FIELD_PROPERTY] Spatial field '${element.spatialFieldId}' evaluated to invalid Young's modulus E=${props.E} at evaluation point on element '${element.elementId}'.`);
      }
      E = props.E;
    }

    const A = section.area;
    const k = (E * A) / L;

    return {
      Ke: new Matrix(2, 2, [
        [k, -k],
        [-k, k]
      ]),
      Fe: [0, 0],
      globalDOFs: [
        dofManager.getDOF(node1.nodeId, DOFComponent.UX)!.globalId,
        dofManager.getDOF(node2.nodeId, DOFComponent.UX)!.globalId
      ]
    };
  }

  computeStressStrain(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    U: number[] | Float64Array
  ): ElementStressStrainResult {
    const node1 = model.nodes.get(element.nodeIds[0])!;
    const node2 = model.nodes.get(element.nodeIds[1])!;
    const material = model.materials.get(element.materialId)!;
    const section = model.sections.get(element.sectionId)!;

    if (!material || material.E <= 0 || !Number.isFinite(material.E)) {
      throw new Error(`[INVALID_MATERIAL] Invalid material Young's modulus E=${material?.E}`);
    }
    if (!section || !section.area || section.area <= 0) {
      throw new Error("[INVALID_SECTION] Bar element requires valid positive area");
    }

    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    const dz = node2.z - node1.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (L <= 0 || !Number.isFinite(L)) throw new Error("[ZERO_LENGTH_ELEMENT] Zero length bar element");

    let E = material.E;
    if (element.spatialFieldId) {
      if (!model.spatialMaterialFields || !model.spatialMaterialFields.has(element.spatialFieldId)) {
        throw new Error(`[SPATIAL_FIELD_NOT_FOUND] Spatial material field '${element.spatialFieldId}' not found in model for element '${element.elementId}'.`);
      }
      const field = model.spatialMaterialFields.get(element.spatialFieldId)!;
      if (field.baseMaterialId && field.baseMaterialId !== element.materialId) {
        throw new Error(`[SPATIAL_FIELD_MATERIAL_MISMATCH] Field base material '${field.baseMaterialId}' does not match element material '${element.materialId}' on element '${element.elementId}'.`);
      }
      const midX = (node1.x + node2.x) / 2.0;
      const midY = (node1.y + node2.y) / 2.0;
      const midZ = (node1.z + node2.z) / 2.0;
      const evalPoint = this.resolveEvaluationPoint(element, model, { x: midX, y: midY, z: midZ });
      const props = field.evaluate(evalPoint);
      if (props.E === undefined) {
        throw new Error(`[SPATIAL_FIELD_MISSING_PROPERTY] Spatial field '${element.spatialFieldId}' does not define mandatory property 'E' required by Bar1DFormulation for element '${element.elementId}'.`);
      }
      if (props.E <= 0 || !Number.isFinite(props.E)) {
        throw new Error(`[INVALID_SPATIAL_FIELD_PROPERTY] Spatial field '${element.spatialFieldId}' evaluated to invalid Young's modulus E=${props.E} at evaluation point on element '${element.elementId}'.`);
      }
      E = props.E;
    }

    const dof1 = dofManager.getDOF(node1.nodeId, DOFComponent.UX);
    const dof2 = dofManager.getDOF(node2.nodeId, DOFComponent.UX);

    if (!dof1 || !dof2) {
      throw new Error(`[DOF_NOT_FOUND] Bar element DOFs missing for nodes ${node1.nodeId}, ${node2.nodeId}`);
    }

    const u1 = U[dof1.globalId];
    const u2 = U[dof2.globalId];

    if (!Number.isFinite(u1) || !Number.isFinite(u2)) {
      throw new Error(`[NUMERICAL_ERROR] Non-finite displacement encountered in Bar1D stress recovery: u1=${u1}, u2=${u2}`);
    }

    // Direction cosine along global X-axis (guarantees orientation invariance regardless of node sequence)
    const cx = dx !== 0 ? Math.sign(dx) : 1.0;
    const epsilon_x = (cx * (u2 - u1)) / L;

    // Constitutive relation: sigma = E * epsilon
    const sigma_x = E * epsilon_x;

    // Equivalent Von Mises stress for uniaxial state
    const vonMisesStress = Math.abs(sigma_x);

    // Strain energy: 0.5 * sigma * epsilon * Volume
    const volume = section.area * L;
    const strainEnergy = 0.5 * sigma_x * epsilon_x * volume;

    return {
      elementId: element.elementId,
      formulationId: "BAR_1D",
      strain: {
        epsilon_x
      },
      stress: {
        sigma_x
      },
      vonMisesStress,
      principalStresses: {
        sigma_1: Math.max(0, sigma_x),
        sigma_2: Math.min(0, sigma_x)
      },
      strainEnergy,
      location: 'CENTROID',
      units: {
        strain: 'dimensionless',
        stress: 'MPa',
        strainEnergy: 'N*mm'
      }
    };
  }
}
