/**
 * SECP Industrial OS v3 — PATCH-181: Engineering Object Graph & Design-in-Context
 * Orchestrates multi-domain engineering links across CAD, Features, Assemblies,
 * Drawings, Simulations, Materials, CAM Toolpaths, and BOMs.
 */

import { 
  EngineeringObject, 
  EngineeringDomainType, 
  DependencyLink,
  ReleaseLifecycleState 
} from './EngineeringDataOSTypes';

export interface WhereUsedResult {
  targetObjectId: string;
  targetName: string;
  domain: EngineeringDomainType;
  usedInParents: {
    objectId: string;
    name: string;
    domain: EngineeringDomainType;
    revision: string;
    relationType: string;
  }[];
}

export class EngineeringObjectGraph {
  private static objects: Map<string, EngineeringObject> = new Map();
  private static links: DependencyLink[] = [];

  public static clear(): void {
    this.objects.clear();
    this.links = [];
  }

  /**
   * Registers an Engineering Object in the graph.
   */
  public static registerObject(obj: EngineeringObject): void {
    this.objects.set(obj.objectId, { ...obj });
  }

  /**
   * Retrieves an object by ID.
   */
  public static getObject(objectId: string): EngineeringObject | undefined {
    return this.objects.get(objectId);
  }

  /**
   * Retrieves all objects in the system.
   */
  public static getAllObjects(): EngineeringObject[] {
    return Array.from(this.objects.values());
  }

  /**
   * Links two engineering objects with a typed relationship.
   */
  public static addLink(link: DependencyLink): void {
    // Check if link already exists
    const exists = this.links.some(
      l => l.sourceObjectId === link.sourceObjectId &&
           l.sourceRevisionId === link.sourceRevisionId &&
           l.targetObjectId === link.targetObjectId &&
           l.targetRevisionId === link.targetRevisionId &&
           l.relationType === link.relationType
    );
    if (!exists) {
      this.links.push({ ...link });
    }
  }

  /**
   * Design-in-Context: Returns the full contextual ancestry and hierarchy for an object.
   * Path: Project -> Product -> Assembly -> Part -> Feature -> Drawing -> Simulation -> Material -> CAM
   */
  public static getDesignInContext(objectId: string): {
    current: EngineeringObject | undefined;
    ancestors: { object: EngineeringObject; relation: string }[];
    descendants: { object: EngineeringObject; relation: string }[];
    linkedSimulations: EngineeringObject[];
    linkedCAM: EngineeringObject[];
    linkedDrawings: EngineeringObject[];
    linkedMaterial?: EngineeringObject;
    linkedBOMs: EngineeringObject[];
    whereUsed: WhereUsedResult;
  } {
    const current = this.objects.get(objectId);
    const ancestors: { object: EngineeringObject; relation: string }[] = [];
    const descendants: { object: EngineeringObject; relation: string }[] = [];

    // Find incoming links (parents / consumers)
    const incoming = this.links.filter(l => l.targetObjectId === objectId);
    for (const link of incoming) {
      const parentObj = this.objects.get(link.sourceObjectId);
      if (parentObj) {
        ancestors.push({ object: parentObj, relation: link.relationType });
      }
    }

    // Find outgoing links (children / dependencies)
    const outgoing = this.links.filter(l => l.sourceObjectId === objectId);
    for (const link of outgoing) {
      const childObj = this.objects.get(link.targetObjectId);
      if (childObj) {
        descendants.push({ object: childObj, relation: link.relationType });
      }
    }

    // Collect domain-specific connected artifacts
    const connectedObjs = outgoing.map(l => this.objects.get(l.targetObjectId)).filter(Boolean) as EngineeringObject[];
    const reverseConnectedObjs = incoming.map(l => this.objects.get(l.sourceObjectId)).filter(Boolean) as EngineeringObject[];
    const allLinked = [...connectedObjs, ...reverseConnectedObjs];

    const linkedSimulations = allLinked.filter(
      o => o.domain === 'SIMULATION_FEM' || o.domain === 'SIMULATION_CFD' || o.domain === 'SIMULATION_THERMAL'
    );
    const linkedCAM = allLinked.filter(
      o => o.domain === 'CAM_TOOLPATH' || o.domain === 'NC_PROGRAM' || o.domain === 'MANUFACTURING_OPERATION'
    );
    const linkedDrawings = allLinked.filter(o => o.domain === 'DRAWING');
    const linkedMaterial = allLinked.find(o => o.domain === 'MATERIAL');
    const linkedBOMs = allLinked.filter(o => o.domain === 'BOM');

    const whereUsed: WhereUsedResult = {
      targetObjectId: objectId,
      targetName: current?.name || 'Unknown',
      domain: current?.domain || 'PART',
      usedInParents: incoming.map(l => {
        const p = this.objects.get(l.sourceObjectId);
        return {
          objectId: l.sourceObjectId,
          name: p?.name || l.sourceObjectId,
          domain: p?.domain || 'ASSEMBLY',
          revision: l.sourceRevisionId,
          relationType: l.relationType
        };
      })
    };

    return {
      current,
      ancestors,
      descendants,
      linkedSimulations,
      linkedCAM,
      linkedDrawings,
      linkedMaterial,
      linkedBOMs,
      whereUsed
    };
  }

  /**
   * Retrieves all downstream dependent object IDs for a given source object.
   */
  public static getDownstreamDependents(objectId: string, revisionId?: string): DependencyLink[] {
    return this.links.filter(l => {
      const matchObj = l.targetObjectId === objectId;
      if (revisionId) {
        return matchObj && (l.targetRevisionId === revisionId || l.targetRevisionId === '*');
      }
      return matchObj;
    });
  }

  /**
   * Retrieves all direct dependencies (upstream) for an object.
   */
  public static getUpstreamDependencies(objectId: string, revisionId?: string): DependencyLink[] {
    return this.links.filter(l => {
      const matchObj = l.sourceObjectId === objectId;
      if (revisionId) {
        return matchObj && (l.sourceRevisionId === revisionId || l.sourceRevisionId === '*');
      }
      return matchObj;
    });
  }

  /**
   * Returns all registered dependency links.
   */
  public static getAllLinks(): DependencyLink[] {
    return [...this.links];
  }
}
