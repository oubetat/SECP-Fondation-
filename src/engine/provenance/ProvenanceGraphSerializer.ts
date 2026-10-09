export class ProvenanceGraphSerializer {
  static computeNodeId(eid: string, type: string, hash: string, v: string) { return 'node_' + eid; }
  static computeEdgeId(f: string, t: string, to: string, h: string) { return 'edge_' + f + '_' + to; }
  static computeRelationHash(f: string, t: string, to: string, m: any) { return 'hash_' + f + '_' + to; }

  static sortNodes(nodes: any[]): any[] {
    return [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  }

  static sortEdges(edges: any[]): any[] {
    return [...edges].sort((a, b) => a.id.localeCompare(b.id));
  }

  static calculateGraphHash(nodes: any[], edges: any[]): string {
    const sortedN = this.sortNodes(nodes).map(n => `${n.id}:${n.canonicalHash}`).join('|');
    const sortedE = this.sortEdges(edges).map(e => `${e.fromNodeId}->${e.toNodeId}`).join('|');
    let hash = 0;
    const str = `NODES[${sortedN}]_EDGES[${sortedE}]`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `PROV_HASH_${Math.abs(hash).toString(16)}`;
  }
}
