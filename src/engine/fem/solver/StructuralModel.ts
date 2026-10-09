import { ElementInput, NodalLoadInput, NodeInput, PrescribedDisplacementInput } from './types';
import { MaterialProperties, DOFType } from '../elements/types';
import { FEAMesh } from '../../cad-kernel/fea/FEAAdapter';

export interface ModelValidationResult {
  isValid: boolean;
  errors: string[];
  nodeCount: number;
  elementCount: number;
  dofsPerNode: number;
  dimension: 1 | 2 | 3;
}

export interface StructuralModelFromMeshOptions {
  id?: string;
  material?: MaterialProperties;
  loads?: NodalLoadInput[];
  constraints?: PrescribedDisplacementInput[];
}

export class StructuralModel {
  readonly id: string;
  readonly nodes: NodeInput[];
  readonly elements: ElementInput[];
  readonly loads: NodalLoadInput[];
  readonly constraints: PrescribedDisplacementInput[];

  private nodeMap: Map<string, NodeInput>;
  private elementMap: Map<string, ElementInput>;

  constructor(
    id: string,
    nodes: NodeInput[],
    elements: ElementInput[],
    loads: NodalLoadInput[] = [],
    constraints: PrescribedDisplacementInput[] = []
  ) {
    this.id = id;
    this.nodes = nodes;
    this.elements = elements;
    this.loads = loads;
    this.constraints = constraints;

    this.nodeMap = new Map();
    nodes.forEach((n) => this.nodeMap.set(n.id, n));

    this.elementMap = new Map();
    elements.forEach((e) => this.elementMap.set(e.id, e));
  }

  /**
   * Constructs a StructuralModel directly from a FEAMesh derived from a BRep solid.
   */
  public static fromMesh(mesh: FEAMesh, options?: StructuralModelFromMeshOptions): StructuralModel {
    const id = options?.id || `MODEL_${mesh.id || mesh.brepSourceId || 'FEA'}`;
    const defaultMat: MaterialProperties = options?.material || {
      E: 210e9,
      nu: 0.3,
      thickness: 0.01,
      area: 0.001
    };

    const elements: ElementInput[] = mesh.elements.map(e => ({
      ...e,
      material: e.material || defaultMat
    }));

    let loads = options?.loads;
    if (!loads || loads.length === 0) {
      if (mesh.boundaryNodes?.loadNodeIds?.length > 0) {
        loads = mesh.boundaryNodes.loadNodeIds.map(nid => ({
          nodeId: nid,
          dof: 'UY' as DOFType,
          magnitude: -10000
        }));
      } else if (mesh.nodes.length > 0) {
        const lastNode = mesh.nodes[mesh.nodes.length - 1];
        loads = [{ nodeId: lastNode.id, dof: 'UY' as DOFType, magnitude: -10000 }];
      } else {
        loads = [];
      }
    }

    let constraints = options?.constraints;
    if (!constraints || constraints.length === 0) {
      if (mesh.boundaryNodes?.fixedNodeIds?.length > 0) {
        constraints = [];
        for (const nid of mesh.boundaryNodes.fixedNodeIds) {
          constraints.push({ nodeId: nid, dof: 'UX' as DOFType, value: 0 });
          constraints.push({ nodeId: nid, dof: 'UY' as DOFType, value: 0 });
        }
      } else if (mesh.nodes.length > 0) {
        const firstNode = mesh.nodes[0];
        constraints = [
          { nodeId: firstNode.id, dof: 'UX' as DOFType, value: 0 },
          { nodeId: firstNode.id, dof: 'UY' as DOFType, value: 0 }
        ];
      } else {
        constraints = [];
      }
    }

    return new StructuralModel(id, mesh.nodes, elements, loads, constraints);
  }

  getNode(id: string): NodeInput | undefined {
    return this.nodeMap.get(id);
  }

  getElement(id: string): ElementInput | undefined {
    return this.elementMap.get(id);
  }

  validate(): ModelValidationResult {
    const errors: string[] = [];

    if (this.nodes.length === 0) {
      errors.push('StructuralModel must contain at least one node.');
    }
    if (this.elements.length === 0) {
      errors.push('StructuralModel must contain at least one element.');
    }

    // Check duplicate node IDs or indices
    const nodeIds = new Set<string>();
    const nodeIndices = new Set<number>();
    for (const node of this.nodes) {
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID found: ${node.id}`);
      }
      nodeIds.add(node.id);

      if (nodeIndices.has(node.index)) {
        errors.push(`Duplicate node index found: ${node.index}`);
      }
      nodeIndices.add(node.index);

      if (!node.coordinates || node.coordinates.some((c) => !Number.isFinite(c))) {
        errors.push(`Node ${node.id} has invalid non-finite coordinates.`);
      }
    }

    // Determine spatial dimension & DOFs per node from first element
    let dimension: 1 | 2 | 3 = 2;
    let dofsPerNode = 2;

    if (this.elements.length > 0) {
      const firstElem = this.elements[0];
      switch (firstElem.type) {
        case 'BAR2':
          dimension = (this.nodes[0]?.coordinates?.length || 1) as 1 | 2 | 3;
          dofsPerNode = this.nodes[0]?.coordinates?.length || 1;
          break;
        case 'TRI3':
        case 'QUAD4':
          dimension = 2;
          dofsPerNode = 2;
          break;
        case 'TET4':
        case 'HEX8':
          dimension = 3;
          dofsPerNode = 3;
          break;
      }
    }

    // Validate elements
    const elemIds = new Set<string>();
    for (const elem of this.elements) {
      if (elemIds.has(elem.id)) {
        errors.push(`Duplicate element ID found: ${elem.id}`);
      }
      elemIds.add(elem.id);

      // Check node exists
      for (const nodeId of elem.nodeIds) {
        if (!this.nodeMap.has(nodeId)) {
          errors.push(`Element ${elem.id} references non-existent node: ${nodeId}`);
        }
      }

      // Material validation
      if (!elem.material || !Number.isFinite(elem.material.E) || elem.material.E <= 0) {
        errors.push(`Element ${elem.id} has invalid Young's modulus E=${elem.material?.E}`);
      }
      if (elem.type === 'BAR2') {
        if (!elem.material.area || !Number.isFinite(elem.material.area) || elem.material.area <= 0) {
          errors.push(`BAR2 element ${elem.id} has invalid area A=${elem.material.area}`);
        }
      }
      if (['TRI3', 'QUAD4'].includes(elem.type)) {
        if (elem.material.nu === undefined || !Number.isFinite(elem.material.nu) || elem.material.nu < -0.99 || elem.material.nu >= 0.5) {
          errors.push(`Plane element ${elem.id} has invalid Poisson's ratio nu=${elem.material.nu}`);
        }
      }
    }

    // Validate loads
    for (const load of this.loads) {
      if (!this.nodeMap.has(load.nodeId)) {
        errors.push(`Nodal load references non-existent node: ${load.nodeId}`);
      }
      if (!Number.isFinite(load.magnitude)) {
        errors.push(`Nodal load on ${load.nodeId} has non-finite magnitude.`);
      }
    }

    // Validate constraints
    for (const constraint of this.constraints) {
      if (!this.nodeMap.has(constraint.nodeId)) {
        errors.push(`Constraint references non-existent node: ${constraint.nodeId}`);
      }
      if (!Number.isFinite(constraint.value)) {
        errors.push(`Constraint on ${constraint.nodeId} has non-finite value.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      nodeCount: this.nodes.length,
      elementCount: this.elements.length,
      dofsPerNode,
      dimension
    };
  }
}
