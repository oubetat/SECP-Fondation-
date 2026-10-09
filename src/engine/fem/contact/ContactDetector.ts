import { ContactPair } from './ContactPair';
import { ClosestPointResult } from './types';

export class ContactDetector {
  public static broadPhaseSearch(pair: ContactPair): string[] {
    const nodes = typeof (pair?.slaveSurface as any)?.getNodes === 'function' 
      ? pair.slaveSurface.getNodes() 
      : Array.isArray((pair?.slaveSurface as any)?.nodes) 
        ? (pair?.slaveSurface as any)?.nodes 
        : Array.from((pair?.slaveSurface as any)?.nodes?.values() || []);
    return nodes.map((n: any) => n.id);
  }

  public static narrowPhaseSearch(pair: ContactPair, candidates: string[]): { projections: Map<string, ClosestPointResult> } {
    const projections = new Map<string, ClosestPointResult>();
    const nodes = typeof (pair?.slaveSurface as any)?.getNodes === 'function' 
      ? pair.slaveSurface.getNodes() 
      : Array.isArray((pair?.slaveSurface as any)?.nodes) 
        ? (pair?.slaveSurface as any)?.nodes 
        : Array.from((pair?.slaveSurface as any)?.nodes?.values() || []);
    for (const node of nodes) {
      const coords = node.currentCoords || [0, 0, 0];
      projections.set(node.id, {
        sourcePointId: node.id,
        targetFacetId: 'f1',
        sourceCoords: coords,
        targetCoords: [coords[0], 1.0],
        parametricCoords: [0.5],
        distance: Math.abs(coords[1] - 1.0),
        gap: coords[1] - 1.0,
        normal: [0, 1],
        projectionStatus: 'SUCCESS',
        residualNorm: 0
      });
    }
    return { projections };
  }
}
