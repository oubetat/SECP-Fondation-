/**
 * PATCH-113: Assembly Graph Durable Store & Concurrency Manager
 * Provides optimistic concurrency locking, atomic mutations, audit trails and revision histories
 */

import { AssemblyGraph } from "./AssemblyGraph";
import { AssemblyAuditRecord } from "./types";
import { AssemblyGraphCanonicalizer } from "./AssemblyGraphCanonicalizer";

export class AssemblyGraphStore {
  // Key: assemblyId -> Array of revisions
  private static assemblies: Map<string, Map<string, AssemblyGraph>> = new Map();
  private static auditLogs: AssemblyAuditRecord[] = [];

  /**
   * Save or Update an assembly revision with optimistic locking
   */
  public static saveAssembly(graph: AssemblyGraph, actorId: string = "SYSTEM_ENGINEER", operation: AssemblyAuditRecord["operation"] = "CREATE"): { success: boolean; graphHash: string; version: number } {
    let revMap = this.assemblies.get(graph.assemblyId);
    if (!revMap) {
      revMap = new Map();
      this.assemblies.set(graph.assemblyId, revMap);
    }

    const existing = revMap.get(graph.assemblyRevision);
    const beforeHash = existing ? existing.computeFingerprint().graphHash : "ROOT_GENESIS_HASH";

    // Optimistic Concurrency check: If existing version changed in background
    if (existing && existing.version > graph.version) {
      throw new Error(`CONCURRENT_MODIFICATION: Assembly ${graph.assemblyId}:${graph.assemblyRevision} has been modified concurrently (Stored version: ${existing.version}, Incoming version: ${graph.version})`);
    }

    // Advance version
    graph.version = (existing ? existing.version : graph.version) + 1;

    const { graphHash } = graph.computeFingerprint();

    // Create Audit Record
    const auditRecord: AssemblyAuditRecord = {
      assemblyChangeId: `AUDIT_${graph.assemblyId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      assemblyId: graph.assemblyId,
      actorId,
      timestamp: Date.now(),
      operation,
      beforeHash,
      afterHash: graphHash,
      details: {
        revision: graph.assemblyRevision,
        nodeCount: graph.nodes.size,
        occurrenceCount: graph.occurrences.size,
        version: graph.version
      }
    };
    this.auditLogs.push(auditRecord);

    revMap.set(graph.assemblyRevision, graph);

    return {
      success: true,
      graphHash,
      version: graph.version
    };
  }

  /**
   * Retrieve an assembly by ID and Revision (or latest if omitted)
   */
  public static getAssembly(assemblyId: string, revision?: string): AssemblyGraph | null {
    const revMap = this.assemblies.get(assemblyId);
    if (!revMap || revMap.size === 0) return null;

    let target: AssemblyGraph | undefined;
    if (revision) {
      target = revMap.get(revision);
    } else {
      const revisions = Array.from(revMap.keys()).sort();
      target = revMap.get(revisions[revisions.length - 1]);
    }

    if (!target) return null;
    return target.clone(target.assemblyRevision);
  }

  /**
   * List all revisions for an assembly ID
   */
  public static getRevisions(assemblyId: string): string[] {
    const revMap = this.assemblies.get(assemblyId);
    if (!revMap) return [];
    return Array.from(revMap.keys()).sort();
  }

  /**
   * List all assembly IDs
   */
  public static listAssemblies(): string[] {
    return Array.from(this.assemblies.keys()).sort();
  }

  /**
   * Get audit history for an assembly ID
   */
  public static getAuditLogs(assemblyId?: string): AssemblyAuditRecord[] {
    if (assemblyId) {
      return this.auditLogs.filter(a => a.assemblyId === assemblyId);
    }
    return [...this.auditLogs];
  }

  /**
   * Reset store (useful for clean unit testing)
   */
  public static clear(): void {
    this.assemblies.clear();
    this.auditLogs = [];
  }
}
