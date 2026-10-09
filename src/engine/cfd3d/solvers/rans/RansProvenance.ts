/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-062: RANS Provenance Engine
 */

export interface RansProvenanceNode {
  readonly id: string;
  readonly type: string;
  readonly metadata: any;
  readonly dependencies: string[];
}

export class RansProvenance {
  private readonly nodes: RansProvenanceNode[] = [];

  public addNode(node: RansProvenanceNode): void {
    this.nodes.push(node);
  }

  public getGraph(): RansProvenanceNode[] {
    return [...this.nodes];
  }
}
