/**
 * PATCH-113: Assembly Graph Canonicalizer & Hash Engine
 * Deterministic SHA-256 Fingerprinting for Assembly Engineering Truth
 */

import {
  AssemblyNode,
  AssemblyOccurrence,
  AssemblyEdge,
  AssemblyConstraint,
  AssemblyInterface,
  AssemblyConfiguration,
  PartDefinition,
  AssemblyDependencySnapshot,
  AssemblySnapshot
} from "./types";

export class AssemblyGraphCanonicalizer {
  /**
   * Deterministic SHA-256 implementation (browser/node agnostic)
   */
  public static sha256(input: string): string {
    const utf8 = new TextEncoder().encode(input);
    
    // Standard SHA-256 implementation
    function rotr(n: number, x: number): number {
      return (x >>> n) | (x << (32 - n));
    }
    function choose(x: number, y: number, z: number): number {
      return (x & y) ^ (~x & z);
    }
    function majority(x: number, y: number, z: number): number {
      return (x & y) ^ (x & z) ^ (y & z);
    }
    function sigma0(x: number): number {
      return rotr(2, x) ^ rotr(13, x) ^ rotr(22, x);
    }
    function sigma1(x: number): number {
      return rotr(6, x) ^ rotr(11, x) ^ rotr(25, x);
    }
    function gamma0(x: number): number {
      return rotr(7, x) ^ rotr(18, x) ^ (x >>> 3);
    }
    function gamma1(x: number): number {
      return rotr(17, x) ^ rotr(19, x) ^ (x >>> 10);
    }

    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    let H0 = 0x6a09e667;
    let H1 = 0xbb67ae85;
    let H2 = 0x3c6ef372;
    let H3 = 0xa54ff53a;
    let H4 = 0x510e527f;
    let H5 = 0x9b05688c;
    let H6 = 0x1f83d9ab;
    let H7 = 0x5be0cd19;

    const bitLength = utf8.length * 8;
    const paddingLength = ((56 - ((utf8.length + 1) % 64)) + 64) % 64;
    const totalLength = utf8.length + 1 + paddingLength + 8;
    const buffer = new Uint8Array(totalLength);
    buffer.set(utf8);
    buffer[utf8.length] = 0x80;

    const view = new DataView(buffer.buffer);
    view.setUint32(totalLength - 4, bitLength, false);

    for (let i = 0; i < totalLength; i += 64) {
      const W = new Uint32Array(64);
      for (let t = 0; t < 16; t++) {
        W[t] = view.getUint32(i + t * 4, false);
      }
      for (let t = 16; t < 64; t++) {
        W[t] = (gamma1(W[t - 2]) + W[t - 7] + gamma0(W[t - 15]) + W[t - 16]) >>> 0;
      }

      let a = H0;
      let b = H1;
      let c = H2;
      let d = H3;
      let e = H4;
      let f = H5;
      let g = H6;
      let h = H7;

      for (let t = 0; t < 64; t++) {
        const T1 = (h + sigma1(e) + choose(e, f, g) + K[t] + W[t]) >>> 0;
        const T2 = (sigma0(a) + majority(a, b, c)) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + T1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (T1 + T2) >>> 0;
      }

      H0 = (H0 + a) >>> 0;
      H1 = (H1 + b) >>> 0;
      H2 = (H2 + c) >>> 0;
      H3 = (H3 + d) >>> 0;
      H4 = (H4 + e) >>> 0;
      H5 = (H5 + f) >>> 0;
      H6 = (H6 + g) >>> 0;
      H7 = (H7 + h) >>> 0;
    }

    const hex = [H0, H1, H2, H3, H4, H5, H6, H7]
      .map(x => x.toString(16).padStart(8, "0"))
      .join("");

    return hex;
  }

  /**
   * Deterministic Object Canonicalization (sorted keys, formatted floats)
   */
  public static canonicalize(obj: any): string {
    if (obj === null || obj === undefined) {
      return "null";
    }
    if (typeof obj === "number") {
      if (Number.isInteger(obj)) {
        return obj.toString();
      }
      return Number(obj.toFixed(6)).toString();
    }
    if (typeof obj === "boolean" || typeof obj === "string") {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return "[" + obj.map(x => this.canonicalize(x)).join(",") + "]";
    }
    if (typeof obj === "object") {
      const keys = Object.keys(obj).sort();
      const pairs = keys.map(k => `${JSON.stringify(k)}:${this.canonicalize(obj[k])}`);
      return "{" + pairs.join(",") + "}";
    }
    return JSON.stringify(String(obj));
  }

  /**
   * Calculate deterministic hash of Part Definition
   */
  public static computePartDefinitionHash(part: PartDefinition): string {
    const payload = {
      partId: part.partId,
      partRevision: part.partRevision,
      name: part.name,
      unitSystem: part.unitSystem,
      geometryReference: part.geometryReference,
      materialId: part.materialId || "",
      massKg: part.massKg,
      centerOfMassLocal: part.centerOfMassLocal,
      boundingBoxLocal: part.boundingBoxLocal,
      isFlexible: part.isFlexible,
      lifecycleState: part.lifecycleState
    };
    return this.sha256("PART_DEF:" + this.canonicalize(payload));
  }

  /**
   * Calculate deterministic hash of an occurrence
   */
  public static computeOccurrenceHash(occ: AssemblyOccurrence): string {
    const payload = {
      occurrenceId: occ.occurrenceId,
      partId: occ.partId,
      partRevision: occ.partRevision,
      assemblyId: occ.assemblyId,
      assemblyRevision: occ.assemblyRevision,
      parentOccurrenceId: occ.parentOccurrenceId,
      instancePath: occ.instancePath,
      localMatrix: occ.localTransform.matrix,
      worldMatrix: occ.worldTransform.matrix,
      configurationState: occ.configurationState,
      lifecycleState: occ.lifecycleState,
      geometryReference: occ.geometryReference,
      isFixed: occ.isFixed,
      customParameters: occ.customParameters || {}
    };
    return this.sha256("OCCURRENCE:" + this.canonicalize(payload));
  }

  /**
   * Calculate complete Assembly Graph Canonical Representation & Hash
   */
  public static computeGraphHash(data: {
    assemblyId: string;
    assemblyRevision: string;
    nodes: AssemblyNode[];
    occurrences: AssemblyOccurrence[];
    edges: AssemblyEdge[];
    constraints: AssemblyConstraint[];
    interfaces: AssemblyInterface[];
    configurations: AssemblyConfiguration[];
    partDefinitions?: PartDefinition[];
  }): { canonicalJson: string; graphHash: string; fingerprint: string } {
    // Sort all arrays deterministically
    const sortedNodes = [...data.nodes].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
    const sortedOccurrences = [...data.occurrences].sort((a, b) => a.occurrenceId.localeCompare(b.occurrenceId));
    const sortedEdges = [...data.edges].sort((a, b) => a.edgeId.localeCompare(b.edgeId));
    const sortedConstraints = [...data.constraints].sort((a, b) => a.constraintId.localeCompare(b.constraintId));
    const sortedInterfaces = [...data.interfaces].sort((a, b) => a.interfaceId.localeCompare(b.interfaceId));
    const sortedConfigs = [...data.configurations].sort((a, b) => a.configurationId.localeCompare(b.configurationId));
    const sortedParts = (data.partDefinitions || []).sort((a, b) => a.partId.localeCompare(b.partId));

    const canonicalStructure = {
      assemblyId: data.assemblyId,
      assemblyRevision: data.assemblyRevision,
      nodes: sortedNodes.map(n => ({
        nodeId: n.nodeId,
        nodeType: n.nodeType,
        partId: n.partId || "",
        partRevision: n.partRevision || "",
        occurrenceId: n.occurrenceId,
        parentOccurrenceId: n.parentOccurrenceId,
        configurationState: n.configurationState,
        lifecycleState: n.lifecycleState
      })),
      occurrences: sortedOccurrences.map(o => ({
        occurrenceId: o.occurrenceId,
        partId: o.partId,
        partRevision: o.partRevision,
        parentOccurrenceId: o.parentOccurrenceId,
        instancePath: o.instancePath,
        localMatrix: o.localTransform.matrix,
        worldMatrix: o.worldTransform.matrix,
        configurationState: o.configurationState,
        geometryHash: o.geometryReference.geometryHash,
        isFixed: o.isFixed
      })),
      edges: sortedEdges.map(e => ({
        edgeId: e.edgeId,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        edgeType: e.edgeType,
        edgeRevision: e.edgeRevision
      })),
      constraints: sortedConstraints.map(c => ({
        constraintId: c.constraintId,
        constraintType: c.constraintType,
        sourceOccurrenceId: c.sourceOccurrenceId,
        targetOccurrenceId: c.targetOccurrenceId,
        status: c.status,
        offsetMm: c.offsetMm || 0,
        angleDeg: c.angleDeg || 0
      })),
      interfaces: sortedInterfaces.map(i => ({
        interfaceId: i.interfaceId,
        interfaceType: i.interfaceType,
        sourceOccurrenceId: i.sourceOccurrenceId,
        targetOccurrenceId: i.targetOccurrenceId,
        status: i.status
      })),
      configurations: sortedConfigs.map(cfg => ({
        configurationId: cfg.configurationId,
        name: cfg.name,
        occurrenceStates: cfg.occurrenceStates,
        suppressedConstraints: [...cfg.suppressedConstraints].sort(),
        suppressedInterfaces: [...cfg.suppressedInterfaces].sort()
      })),
      parts: sortedParts.map(p => ({
        partId: p.partId,
        partRevision: p.partRevision,
        geometryHash: p.geometryReference.geometryHash,
        massKg: p.massKg
      }))
    };

    const canonicalJson = this.canonicalize(canonicalStructure);
    const graphHash = this.sha256("ASSEMBLY_GRAPH:" + canonicalJson);
    const fingerprint = `SECP-AG-SHA256:${graphHash.slice(0, 16).toUpperCase()}:${data.assemblyId}:${data.assemblyRevision}`;

    return {
      canonicalJson,
      graphHash,
      fingerprint
    };
  }

  /**
   * Create frozen Dependency Snapshot for Released Assembly
   */
  public static createDependencySnapshot(
    assemblyId: string,
    assemblyRevision: string,
    occurrences: AssemblyOccurrence[]
  ): AssemblyDependencySnapshot {
    const componentRevisions: Record<string, string> = {};
    const componentIdsSet = new Set<string>();

    for (const occ of occurrences) {
      if (occ.partId) {
        componentIdsSet.add(occ.partId);
        componentRevisions[occ.partId] = occ.partRevision;
      }
    }

    const componentIds = Array.from(componentIdsSet).sort();
    const payload = {
      assemblyId,
      assemblyRevision,
      componentIds,
      componentRevisions
    };

    const dependencyHash = this.sha256("DEPENDENCY_SNAPSHOT:" + this.canonicalize(payload));

    return {
      snapshotId: `DEP_SNAP_${assemblyId}_${assemblyRevision}`,
      assemblyId,
      assemblyRevision,
      componentIds,
      componentRevisions,
      dependencyHash,
      createdAt: Date.now()
    };
  }

  /**
   * Create Forensic Assembly Snapshot
   */
  public static createForensicSnapshot(
    assemblyId: string,
    assemblyRevision: string,
    graphHash: string,
    fingerprint: string,
    nodeCount: number,
    edgeCount: number,
    occurrenceCount: number,
    configurationId: string = "DEFAULT"
  ): AssemblySnapshot {
    return {
      snapshotId: `SNAP_${assemblyId}_${assemblyRevision}_${Date.now()}`,
      assemblyId,
      assemblyRevision,
      graphHash,
      nodeCount,
      edgeCount,
      occurrenceCount,
      configurationId,
      timestamp: Date.now(),
      validatorVersion: "SECP-AG-113.1",
      fingerprint
    };
  }
}
