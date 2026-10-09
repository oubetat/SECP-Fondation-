import { createHash } from 'crypto';
import { BOMGraphData, BOMNode, BOMEdge, SubstituteRecord, BOMEffectivity } from './types';

export class BOMCanonicalizer {
  public static canonicalize(data: BOMGraphData): string {
    const nodes = [...data.nodes].sort((a, b) => a.bomNodeId.localeCompare(b.bomNodeId));
    const edges = [...data.edges].sort((a, b) => a.edgeId.localeCompare(b.edgeId));
    const substitutes = [...data.substitutes].sort((a, b) => a.substitutionId.localeCompare(b.substitutionId));

    const serializeEffectivity = (eff: BOMEffectivity[]) => {
      return [...eff].sort((a, b) => a.type.localeCompare(b.type)).map(e => ({
        type: e.type,
        start: e.start || null,
        end: e.end || null,
        condition: e.condition || null,
        configurationId: e.configurationId || null,
      }));
    };

    const obj = {
      bomId: data.bomId,
      bomRevision: data.bomRevision,
      configurationId: data.configurationId,
      nodes: nodes.map(n => ({
        bomNodeId: n.bomNodeId,
        itemType: n.itemType,
        partId: n.partId,
        partRevision: n.partRevision,
        assemblyId: n.assemblyId,
        assemblyRevision: n.assemblyRevision,
        occurrenceIds: [...n.occurrenceIds].sort(),
        parentBomNodeId: n.parentBomNodeId || null,
        quantity: this.formatFloat(n.quantity),
        unitOfMeasure: n.unitOfMeasure,
        quantityBasis: n.quantityBasis,
        configurationState: n.configurationState,
        effectivity: serializeEffectivity(n.effectivity),
        lifecycleState: n.lifecycleState,
        sourcingType: n.sourcingType,
        sourceReference: n.sourceReference
      })),
      edges: edges.map(e => ({
        edgeId: e.edgeId,
        parentNodeId: e.parentNodeId,
        childNodeId: e.childNodeId,
        edgeType: e.edgeType,
        quantity: this.formatFloat(e.quantity),
        unitOfMeasure: e.unitOfMeasure,
        sequence: e.sequence,
        effectivity: serializeEffectivity(e.effectivity)
      })),
      substitutes: substitutes.map(s => ({
        substitutionId: s.substitutionId,
        primaryItemId: s.primaryItemId,
        substituteItemId: s.substituteItemId,
        reason: s.reason,
        effectiveFrom: s.effectiveFrom,
        effectiveTo: s.effectiveTo
      }))
    };

    return JSON.stringify(obj);
  }

  public static computeHash(data: BOMGraphData): string {
    const canonical = this.canonicalize(data);
    return createHash('sha256').update(canonical).digest('hex');
  }

  private static formatFloat(val: number): string {
    if (isNaN(val)) return 'NaN';
    if (!isFinite(val)) return val > 0 ? 'Infinity' : '-Infinity';
    return Number(val.toFixed(6)).toString();
  }
}
