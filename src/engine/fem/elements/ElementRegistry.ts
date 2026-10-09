import { BAR2Element } from "./BAR2Element";
import { HEX8Element } from "./HEX8Element";
import { QUAD4Element } from "./QUAD4Element";
import { TET4Element } from "./TET4Element";
import { TRI3Element } from "./TRI3Element";
import { BeamElement } from "./BeamElement";
import { ShellElement } from "./ShellElement";
import { SolidElement } from "./SolidElement";
import { ElementDefinition, ElementStatus } from "./types";

export class ElementRegistry {
  private static definitions: Map<string, ElementDefinition> = new Map();

  static initialize() {
    if (this.definitions.size > 0) return;

    const bar2: ElementDefinition = {
      elementTypeId: 'BAR2',
      family: 'BAR',
      dimension: 1,
      nodeCount: 2,
      polynomialOrder: 1,
      dofsPerNode: 1,
      dofTypes: ['UX'],
      formulationVersion: BAR2Element.formulationVersion,
      defaultIntegrationRuleId: 'GAUSS_1D_2PT',
      materialModelCompatibility: ['LINEAR_ELASTIC_1D'],
      geometricRequirements: { minNodes: 2, maxNodes: 2, manifoldDimension: 1 },
      physicsCapabilities: { linearStatic: true, thermal: false, dynamic: true, nonlinear: false },
      implementationStatus: 'VERIFIED'
    };

    const tri3: ElementDefinition = {
      elementTypeId: 'TRI3',
      family: 'TRIANGLE',
      dimension: 2,
      nodeCount: 3,
      polynomialOrder: 1,
      dofsPerNode: 2,
      dofTypes: ['UX', 'UY'],
      formulationVersion: TRI3Element.formulationVersion,
      defaultIntegrationRuleId: 'TRI_2D_1PT',
      materialModelCompatibility: ['LINEAR_ELASTIC_ISOTROPIC_2D'],
      geometricRequirements: { minNodes: 3, maxNodes: 3, manifoldDimension: 2 },
      physicsCapabilities: { linearStatic: true, thermal: false, dynamic: true, nonlinear: false },
      implementationStatus: 'VERIFIED'
    };

    const quad4: ElementDefinition = {
      elementTypeId: 'QUAD4',
      family: 'QUADRILATERAL',
      dimension: 2,
      nodeCount: 4,
      polynomialOrder: 1,
      dofsPerNode: 2,
      dofTypes: ['UX', 'UY'],
      formulationVersion: QUAD4Element.formulationVersion,
      defaultIntegrationRuleId: 'GAUSS_QUAD_2X2',
      materialModelCompatibility: ['LINEAR_ELASTIC_ISOTROPIC_2D'],
      geometricRequirements: { minNodes: 4, maxNodes: 4, manifoldDimension: 2 },
      physicsCapabilities: { linearStatic: true, thermal: false, dynamic: true, nonlinear: false },
      implementationStatus: 'VERIFIED'
    };

    const tet4: ElementDefinition = {
      elementTypeId: 'TET4',
      family: 'TETRAHEDRON',
      dimension: 3,
      nodeCount: 4,
      polynomialOrder: 1,
      dofsPerNode: 3,
      dofTypes: ['UX', 'UY', 'UZ'],
      formulationVersion: TET4Element.formulationVersion,
      defaultIntegrationRuleId: 'TET_3D_1PT',
      materialModelCompatibility: ['LINEAR_ELASTIC_ISOTROPIC_3D'],
      geometricRequirements: { minNodes: 4, maxNodes: 4, manifoldDimension: 3 },
      physicsCapabilities: { linearStatic: true, thermal: false, dynamic: true, nonlinear: false },
      implementationStatus: 'VERIFIED'
    };

    const hex8: ElementDefinition = {
      elementTypeId: 'HEX8',
      family: 'HEXAHEDRON',
      dimension: 3,
      nodeCount: 8,
      polynomialOrder: 1,
      dofsPerNode: 3,
      dofTypes: ['UX', 'UY', 'UZ'],
      formulationVersion: HEX8Element.formulationVersion,
      defaultIntegrationRuleId: 'GAUSS_HEX_2X2X2',
      materialModelCompatibility: ['LINEAR_ELASTIC_ISOTROPIC_3D'],
      geometricRequirements: { minNodes: 8, maxNodes: 8, manifoldDimension: 3 },
      physicsCapabilities: { linearStatic: true, thermal: false, dynamic: true, nonlinear: false },
      implementationStatus: 'VERIFIED'
    };

    const beam: ElementDefinition = {
      elementTypeId: 'BEAM',
      family: 'BEAM',
      dimension: 3,
      nodeCount: 2,
      polynomialOrder: 3,
      dofsPerNode: 6,
      dofTypes: ['UX', 'UY', 'UZ', 'ROTX', 'ROTY', 'ROTZ'],
      formulationVersion: BeamElement.formulationVersion,
      defaultIntegrationRuleId: 'GAUSS_1D_2PT',
      materialModelCompatibility: ['LINEAR_ELASTIC_ISOTROPIC_3D'],
      geometricRequirements: { minNodes: 2, maxNodes: 2, manifoldDimension: 1 },
      physicsCapabilities: { linearStatic: true, thermal: false, dynamic: true, nonlinear: false },
      implementationStatus: 'VERIFIED'
    };

    const shell: ElementDefinition = {
      elementTypeId: 'SHELL',
      family: 'SHELL',
      dimension: 3,
      nodeCount: 4,
      polynomialOrder: 1,
      dofsPerNode: 6,
      dofTypes: ['UX', 'UY', 'UZ', 'ROTX', 'ROTY', 'ROTZ'],
      formulationVersion: ShellElement.formulationVersion,
      defaultIntegrationRuleId: 'GAUSS_QUAD_2X2',
      materialModelCompatibility: ['LINEAR_ELASTIC_ISOTROPIC_2D'],
      geometricRequirements: { minNodes: 4, maxNodes: 4, manifoldDimension: 2 },
      physicsCapabilities: { linearStatic: true, thermal: false, dynamic: true, nonlinear: false },
      implementationStatus: 'VERIFIED'
    };

    const solid: ElementDefinition = {
      elementTypeId: 'SOLID',
      family: 'SOLID',
      dimension: 3,
      nodeCount: 8,
      polynomialOrder: 1,
      dofsPerNode: 3,
      dofTypes: ['UX', 'UY', 'UZ'],
      formulationVersion: SolidElement.formulationVersion,
      defaultIntegrationRuleId: 'GAUSS_HEX_2X2X2',
      materialModelCompatibility: ['LINEAR_ELASTIC_ISOTROPIC_3D'],
      geometricRequirements: { minNodes: 4, maxNodes: 8, manifoldDimension: 3 },
      physicsCapabilities: { linearStatic: true, thermal: false, dynamic: true, nonlinear: false },
      implementationStatus: 'VERIFIED'
    };

    this.definitions.set(bar2.elementTypeId, bar2);
    this.definitions.set(tri3.elementTypeId, tri3);
    this.definitions.set(quad4.elementTypeId, quad4);
    this.definitions.set(tet4.elementTypeId, tet4);
    this.definitions.set(hex8.elementTypeId, hex8);
    this.definitions.set(beam.elementTypeId, beam);
    this.definitions.set(shell.elementTypeId, shell);
    this.definitions.set(solid.elementTypeId, solid);
  }

  static get(elementTypeId: string): ElementDefinition {
    this.initialize();
    const def = this.definitions.get(elementTypeId);
    if (!def) throw new Error(`Element definition not found in registry: ${elementTypeId}`);
    return def;
  }

  static list(): ElementDefinition[] {
    this.initialize();
    return Array.from(this.definitions.values());
  }

  static register(def: ElementDefinition) {
    this.initialize();
    if (this.definitions.has(def.elementTypeId)) {
      throw new Error(`Element type ${def.elementTypeId} is already registered`);
    }
    this.definitions.set(def.elementTypeId, def);
  }

  static updateStatus(elementTypeId: string, status: ElementStatus) {
    this.initialize();
    const def = this.get(elementTypeId);
    def.implementationStatus = status;
  }

  static getCapabilityMatrix(): Record<string, any>[] {
    this.initialize();
    return this.list().map(def => ({
      elementTypeId: def.elementTypeId,
      family: def.family,
      dimension: `${def.dimension}D`,
      nodes: def.nodeCount,
      dofsPerNode: def.dofsPerNode,
      linearStatic: def.physicsCapabilities.linearStatic ? 'YES' : 'NO',
      thermal: def.physicsCapabilities.thermal ? 'YES' : 'NO',
      dynamic: def.physicsCapabilities.dynamic ? 'YES' : 'NO',
      nonlinear: def.physicsCapabilities.nonlinear ? 'YES' : 'NO',
      status: def.implementationStatus
    }));
  }
}
