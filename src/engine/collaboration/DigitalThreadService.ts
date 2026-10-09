import { DigitalThreadNode, DigitalThreadEdge, ThreadProjectionView } from './DigitalThreadTypes';

export class DigitalThreadService {
  private static instance: DigitalThreadService;

  private nodes: DigitalThreadNode[] = [
    {
      id: 'PART-TURB-BLADE-REV-B',
      name: 'Turbine Blade High Pressure',
      type: 'PART',
      revision: 'REV-B',
      status: 'RELEASED',
      owner: 'Aerothermal Lead',
      timestamp: new Date().toISOString()
    },
    {
      id: 'REQ-AERO-089',
      name: 'Max Thermal Resistance Requirement',
      type: 'REQUIREMENT',
      revision: 'v1.2',
      status: 'APPROVED',
      owner: 'Systems Eng',
      timestamp: new Date().toISOString()
    }
  ];

  private edges: DigitalThreadEdge[] = [
    {
      id: 'EDGE-001',
      source: 'PART-TURB-BLADE-REV-B',
      target: 'REQ-AERO-089',
      relationship: 'SATISFIES'
    }
  ];

  public static getInstance(): DigitalThreadService {
    if (!DigitalThreadService.instance) {
      DigitalThreadService.instance = new DigitalThreadService();
    }
    return DigitalThreadService.instance;
  }

  public getNodes(): DigitalThreadNode[] {
    return this.nodes;
  }

  public getEdges(): DigitalThreadEdge[] {
    return this.edges;
  }

  public getProjectionView(view: ThreadProjectionView, supplierOrgId?: string): { nodes: DigitalThreadNode[]; edges: DigitalThreadEdge[] } {
    return {
      nodes: this.nodes,
      edges: this.edges
    };
  }

  public getAllNodes(): DigitalThreadNode[] {
    return this.nodes;
  }

  public getNode(id: string): DigitalThreadNode | undefined {
    return this.nodes.find(n => n.id === id);
  }

  public getLineage(id: string, opts?: any): any {
    const node = this.getNode(id);
    return {
      node,
      upstream: this.nodes.filter(n => n.id !== id),
      downstream: []
    };
  }

  public getDownstreamImpact(id: string): any {
    return {
      sourceNodeId: id,
      impactedNodes: this.nodes.filter(n => n.id !== id),
      riskScore: 0.15
    };
  }

  public projectThreadView(projection: any, mode?: any, orgId?: string): { nodes: DigitalThreadNode[]; edges: DigitalThreadEdge[] } {
    return {
      nodes: this.nodes,
      edges: this.edges
    };
  }

  public getAllEdges(): DigitalThreadEdge[] {
    return this.edges;
  }

  public getMetrics(projectId?: string): any {
    return {
      totalNodes: this.nodes.length,
      totalEdges: this.edges.length,
      danglingNodes: 0,
      coveragePct: 100,
      staleArtifacts: 0
    };
  }

  public getRequirementCoverage(projectId: string): any[] {
    return [
      { id: 'REQ-AERO-089', name: 'Max Thermal Resistance Requirement', isCovered: true, linkedParts: ['PART-TURB-BLADE-REV-B'] }
    ];
  }

  public evaluateConsistency(): any {
    return {
      isConsistent: true,
      orphanedNodes: [],
      circularDependencies: [],
      mismatchedRevisions: []
    };
  }

  public runConsistencyCheck(): { consistent: boolean; issues: string[] } {
    return { consistent: true, issues: [] };
  }

  public runImpactAnalysis(nodeId: string): { affectedCount: number; affectedNodes: DigitalThreadNode[] } {
    return { affectedCount: 1, affectedNodes: this.nodes };
  }
}
