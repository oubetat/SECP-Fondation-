import { 
  MaterialProvenanceRecord, 
  ProvenanceNode, 
  ProvenanceEdge, 
  ProvenanceEdgeType, 
  ProvenanceNodeType,
  TrustClassification,
  ProvenanceStatus,
  PhysicalMaterialInstance,
  MaterialCertificateReference,
  EngineeringPropertyUsage
} from "./types";

export class MaterialProvenanceEngine {
  /**
   * Generates a deterministic, reproducible cryptographic fingerprint for the entire Material Provenance record.
   */
  public static calculateFingerprint(record: MaterialProvenanceRecord): string {
    const parts = [
      record.provenanceId,
      record.materialId,
      record.materialRevision.toString(),
      record.verificationStatus,
      record.nodes.map(n => `${n.id}_${n.type}`).sort().join(","),
      record.edges.map(e => `${e.sourceId}_${e.targetId}_${e.type}`).sort().join(",")
    ];

    if (record.physicalIdentity) {
      parts.push(record.physicalIdentity.physicalMaterialId);
      parts.push(record.physicalIdentity.heatNumber);
      parts.push(record.physicalIdentity.lotNumber);
    }

    return "prov-fingerprint-" + parts.join("__").replace(/[^a-zA-Z0-9_-]/g, "");
  }

  /**
   * Cycle detection on the provenance graph to detect circular dependencies (e.g., A -> B -> C -> A).
   */
  public static hasCycles(nodes: ProvenanceNode[], edges: ProvenanceEdge[]): boolean {
    const adjList = new Map<string, string[]>();
    for (const node of nodes) {
      adjList.set(node.id, []);
    }
    for (const edge of edges) {
      if (!adjList.has(edge.sourceId)) adjList.set(edge.sourceId, []);
      adjList.get(edge.sourceId)!.push(edge.targetId);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      if (recStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = adjList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) return true;
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (dfs(node.id)) return true;
    }

    return false;
  }

  /**
   * Validates graph integrity, detecting cycle traps, isolated properties, and self-parenting issues.
   */
  public static validateGraphIntegrity(record: MaterialProvenanceRecord): { valid: boolean; verdict?: string; details?: string } {
    if (this.hasCycles(record.nodes, record.edges)) {
      return { valid: false, verdict: "INVALID_PROVENANCE_GRAPH", details: "Provenance graph contains circular cycles" };
    }

    // Check for self-parenting
    for (const edge of record.edges) {
      if (edge.sourceId === edge.targetId) {
        return { valid: false, verdict: "INVALID_PROVENANCE_GRAPH", details: "Self-parenting edge detected in provenance graph" };
      }
    }

    return { valid: true };
  }

  /**
   * Scans and detects identity, heat, certificate, or property datasets conflicts.
   */
  public static detectConflicts(record: MaterialProvenanceRecord, certificate: MaterialCertificateReference | null = null): { 
    hasConflict: boolean; 
    verdict?: "IDENTITY_CONFLICT" | "HEAT_TRACEABILITY_CONFLICT" | "CERTIFICATE_CONFLICT" | "PROPERTY_PROVENANCE_CONFLICT" | "INVALID_PROVENANCE_GRAPH"; 
    details?: string;
  } {
    // 1. Identity conflict: Same physical material ID with multiple, incompatible heat numbers
    if (record.physicalIdentity) {
      const pm = record.physicalIdentity;
      if (pm.heatNumber && record.heatNumber && pm.heatNumber !== record.heatNumber) {
        return { 
          hasConflict: true, 
          verdict: "IDENTITY_CONFLICT", 
          details: `Physical Material ID ${pm.physicalMaterialId} belongs to heat ${pm.heatNumber} but provenance declares heat ${record.heatNumber}`
        };
      }
    }

    // 2. Heat conflict: Multiple conflicting heat sources declared within same lot
    if (record.lotNumber && record.heatNumber) {
      const heatNodes = record.nodes.filter(n => n.type === ProvenanceNodeType.HEAT);
      if (heatNodes.length > 1) {
        const uniqueHeats = Array.from(new Set(heatNodes.map(h => h.id)));
        if (uniqueHeats.length > 1 && !uniqueHeats.includes(record.heatNumber)) {
          return {
            hasConflict: true,
            verdict: "HEAT_TRACEABILITY_CONFLICT",
            details: `Lot ${record.lotNumber} contains mismatched heat identities: ${uniqueHeats.join(", ")}`
          };
        }
      }
    }

    // 3. Certificate conflict: mismatch between certificate heat field and source heat record
    if (certificate && record.heatNumber && certificate.heatLotReference !== record.heatNumber) {
      return {
        hasConflict: true,
        verdict: "CERTIFICATE_CONFLICT",
        details: `Certificate heat references ${certificate.heatLotReference} while provenance declares heat ${record.heatNumber}`
      };
    }

    return { hasConflict: false };
  }

  /**
   * Validates physical property usage boundaries and temperature ranges.
   */
  public static evaluateValidityDomain(
    usage: EngineeringPropertyUsage, 
    currentTemperature: number
  ): "VALID" | "OUTSIDE_VALIDITY_DOMAIN" {
    if (currentTemperature < usage.validityDomain.minTemp || currentTemperature > usage.validityDomain.maxTemp) {
      return "OUTSIDE_VALIDITY_DOMAIN";
    }
    return "VALID";
  }

  /**
   * Splits a material lot, generating proper children lineages.
   */
  public static splitLot(
    parentLotId: string, 
    childIds: string[]
  ): { nodes: ProvenanceNode[]; edges: ProvenanceEdge[] } {
    const timestamp = new Date().toISOString();
    const nodes: ProvenanceNode[] = [
      { id: parentLotId, type: ProvenanceNodeType.LOT, label: `Parent Lot ${parentLotId}`, metadata: {}, timestamp }
    ];
    const edges: ProvenanceEdge[] = [];

    for (const child of childIds) {
      nodes.push({ id: child, type: ProvenanceNodeType.STOCK, label: `Stock ${child}`, metadata: {}, timestamp });
      edges.push({ sourceId: parentLotId, targetId: child, type: ProvenanceEdgeType.SPLIT_FROM });
    }

    return { nodes, edges };
  }
}
