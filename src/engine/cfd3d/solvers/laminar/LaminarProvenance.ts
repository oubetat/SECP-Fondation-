/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Laminar Solver Provenance
 */

export interface ProvenanceNode {
  readonly id: string;
  readonly type: string;
  readonly metadata: any;
  readonly dependencies: string[];
}

export class LaminarProvenance {
  private readonly nodes: ProvenanceNode[] = [];

  public addNode(node: ProvenanceNode): void {
    this.nodes.push(node);
  }

  public getGraph(): ProvenanceNode[] {
    return [...this.nodes];
  }
}
