import { ShapeHandle } from '../geometry/ShapeHandle';
import { SemanticReference } from './DesignIntentTypes';
import { TopologyReferenceResolver } from '../features/TopologyReferenceResolver';

/**
 * PATCH-SECP-048-A — Design Intent Resolver
 * Maps Semantic References to physical B-Rep entities.
 * Bridges the gap between intent and topology.
 */
export class DesignIntentResolver {
  
  /**
   * Resolves a semantic reference to a physical entity index in the current shape.
   */
  public static async resolveSemanticReference(
    semanticRef: SemanticReference,
    currentShape: ShapeHandle
  ): Promise<{ success: boolean; entityIndex?: number; error?: string }> {
    
    // We leverage the 047 TopologyReferenceResolver to find the entity
    const topoRef = {
      featureId: semanticRef.featureId,
      topologyType: this.mapSemanticToTopology(semanticRef.type),
      signature: semanticRef.topologySignature,
      index: semanticRef.indexHint
    };

    const res = await TopologyReferenceResolver.resolveReference(topoRef as any, currentShape);
    
    if (res.success) {
      return { success: true, entityIndex: res.index };
    } else {
      return { success: false, error: res.message || 'Reference resolution failed' };
    }
  }

  private static mapSemanticToTopology(type: string): 'FACE' | 'EDGE' | 'VERTEX' {
    if (type.includes('FACE') || type.includes('DATUM') || type.includes('PLANE') || type.includes('REGION')) {
      return 'FACE';
    }
    if (type.includes('AXIS') || type.includes('EDGE')) {
      return 'EDGE';
    }
    return 'VERTEX';
  }
}
