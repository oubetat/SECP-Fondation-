import { Matrix } from "../core/MathUtils";
import { J2PlasticityModel } from "./J2PlasticityModel";
import { MaterialPoint } from "./MaterialState";
import { NonlinearElementIntegrator } from "./NonlinearElementIntegrator";

export interface NonlinearNode {
  id: string;
  index: number;
  coordinates: number[];
}

export interface NonlinearElement {
  id: string;
  type: 'BAR2' | 'QUAD4' | 'HEX8' | 'TET4';
  nodeIds: string[];
  area?: number;
  thickness?: number;
  materialModel: J2PlasticityModel;
  materialPoints: MaterialPoint[];
}

export interface PrescribedDisplacement {
  nodeId: string;
  dofIndex: number;
  value: number;
}

export class NonlinearStructuralSystem {
  readonly nodes: NonlinearNode[];
  readonly elements: NonlinearElement[];
  readonly totalDOFs: number;
  readonly dofsPerNode: number;

  constructor(nodes: NonlinearNode[], elements: NonlinearElement[], dofsPerNode: number = 1) {
    this.nodes = nodes;
    this.elements = elements;
    this.dofsPerNode = dofsPerNode;
    this.totalDOFs = nodes.length * dofsPerNode;
  }

  /**
   * Assembles global internal force vector and consistent tangent stiffness matrix.
   */
  assembleSystem(displacements: number[]): {
    internalForce: number[];
    tangentStiffness: Matrix;
    plasticityOccurred: boolean;
  } {
    const F_int = new Array(this.totalDOFs).fill(0);
    const Kt = Matrix.zeros(this.totalDOFs, this.totalDOFs);
    let anyPlasticity = false;

    for (const elem of this.elements) {
      // Extract element displacements
      const elemDOFIndices: number[] = [];
      for (const nid of elem.nodeIds) {
        const node = this.nodes.find(n => n.id === nid)!;
        for (let d = 0; d < this.dofsPerNode; d++) {
          elemDOFIndices.push(node.index * this.dofsPerNode + d);
        }
      }

      const u_elem = elemDOFIndices.map(idx => displacements[idx]);
      const nodeCoords = elem.nodeIds.map(nid => this.nodes.find(n => n.id === nid)!.coordinates);

      let elemResult;
      if (elem.type === 'BAR2') {
        elemResult = NonlinearElementIntegrator.evaluateBAR2(
          elem.id,
          nodeCoords,
          elem.area ?? 0.01,
          u_elem,
          elem.materialModel,
          elem.materialPoints
        );
      } else if (elem.type === 'HEX8') {
        elemResult = NonlinearElementIntegrator.evaluateHEX8(
          elem.id,
          nodeCoords,
          u_elem,
          elem.materialModel,
          elem.materialPoints
        );
      } else {
        throw new Error(`Unsupported nonlinear element type: ${elem.type}`);
      }

      if (elemResult.plasticityOccurred) {
        anyPlasticity = true;
      }

      // Assemble into global internal force vector
      for (let i = 0; i < elemDOFIndices.length; i++) {
        const gI = elemDOFIndices[i];
        F_int[gI] += elemResult.internalForce[i];
      }

      // Assemble into global tangent stiffness matrix
      for (let i = 0; i < elemDOFIndices.length; i++) {
        const gI = elemDOFIndices[i];
        for (let j = 0; j < elemDOFIndices.length; j++) {
          const gJ = elemDOFIndices[j];
          Kt.add(gI, gJ, elemResult.tangentStiffness.get(i, j));
        }
      }
    }

    return {
      internalForce: F_int,
      tangentStiffness: Kt,
      plasticityOccurred: anyPlasticity
    };
  }

  commitAllMaterialStates(): void {
    for (const elem of this.elements) {
      for (const mp of elem.materialPoints) {
        mp.commit();
      }
    }
  }

  revertAllMaterialStates(): void {
    for (const elem of this.elements) {
      for (const mp of elem.materialPoints) {
        mp.revert();
      }
    }
  }
}
