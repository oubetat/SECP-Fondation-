/**
 * PATCH-SECP-088: Engineering PLM & ECO Engine
 * Orchestrates the full digital thread from CAD to Release, 
 * managing revisions, impact analysis, and state transitions.
 */

import { 
  EngineeringArtifact, 
  ArtifactType, 
  ArtifactStatus, 
  EngineeringChangeOrder, 
  ImpactAnalysisResult,
  ReleaseManifest,
  ECOChangeRequest
} from './PLMTypes';
import { SystemProvenanceEngine } from '../validation/SystemProvenanceEngine';

export class EngineeringPLMEngine {
  private static artifacts: Map<string, EngineeringArtifact> = new Map();
  private static ecos: Map<string, EngineeringChangeOrder> = new Map();
  private static dependencyGraph: Map<string, string[]> = new Map(); // artifactId -> list of dependent artifactIds

  /**
   * Registers a new engineering artifact or a new revision of an existing one.
   */
  public static registerArtifact(artifact: EngineeringArtifact): void {
    // If it's a new revision, supersedes the old one if it exists
    const existing = this.artifacts.get(artifact.artifactId);
    if (existing && existing.revision !== artifact.revision) {
      existing.status = 'SUPERSEDED';
    }
    
    this.artifacts.set(artifact.artifactId, artifact);
    
    // Check if this change invalidates downstream artifacts
    this.performInvalidation(artifact.artifactId);
  }

  /**
   * Establishes a dependency between two artifacts.
   * e.g., CAM_TOOLPATH depends on CAD_GEOMETRY
   */
  public static addDependency(dependentId: string, dependencyId: string): void {
    const dependents = this.dependencyGraph.get(dependencyId) || [];
    if (!dependents.includes(dependentId)) {
      dependents.push(dependentId);
      this.dependencyGraph.set(dependencyId, dependents);
    }
  }

  /**
   * Performs automatic invalidation of downstream artifacts when a dependency changes.
   */
  private static performInvalidation(sourceId: string): void {
    const dependents = this.dependencyGraph.get(sourceId) || [];
    for (const depId of dependents) {
      const artifact = this.artifacts.get(depId);
      if (artifact && (artifact.status === 'VALID' || artifact.status === 'RELEASED' || artifact.status === 'APPROVED')) {
        artifact.status = 'OUTDATED';
        console.log(`[PLM] Artifact ${depId} (${artifact.type}) invalidated by change in ${sourceId}`);
        // Recursively invalidate
        this.performInvalidation(depId);
      }
    }
  }

  /**
   * Analyzes the impact of a proposed change in an ECO.
   */
  public static analyzeImpact(ecoId: string): ImpactAnalysisResult[] {
    const eco = this.ecos.get(ecoId);
    if (!eco) throw new Error(`ECO ${ecoId} not found`);

    const results: ImpactAnalysisResult[] = [];

    for (const request of eco.changeRequests) {
      const affectedDownstream: any[] = [];
      const visited = new Set<string>();
      const queue = [request.artifactId];

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const dependents = this.dependencyGraph.get(currentId) || [];
        for (const depId of dependents) {
          const depArtifact = this.artifacts.get(depId);
          if (depArtifact) {
            affectedDownstream.push({
              artifactId: depId,
              type: depArtifact.type,
              reason: `Direct or indirect dependency on ${currentId}`,
              impactSeverity: this.calculateSeverity(depArtifact.type)
            });
            queue.push(depId);
          }
        }
      }

      results.push({
        ecoId,
        targetArtifactId: request.artifactId,
        affectedDownstreamArtifacts: affectedDownstream,
        isInvalidationRequired: affectedDownstream.length > 0
      });
    }

    return results;
  }

  private static calculateSeverity(type: ArtifactType): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    switch (type) {
      case 'CAD_GEOMETRY': return 'CRITICAL';
      case 'ASSEMBLY': return 'HIGH';
      case 'BOM': return 'HIGH';
      case 'CAM_TOOLPATH': return 'CRITICAL';
      case 'FEA_RESULT': return 'MEDIUM';
      case 'MACHINE_SIMULATION': return 'HIGH';
      default: return 'LOW';
    }
  }

  /**
   * Creates a new Engineering Change Order.
   */
  public static createECO(eco: EngineeringChangeOrder): void {
    this.ecos.set(eco.ecoId, eco);
  }

  /**
   * Processes an ECO approval and triggers necessary state updates.
   */
  public static approveECO(ecoId: string, approver: string): void {
    const eco = this.ecos.get(ecoId);
    if (!eco) throw new Error(`ECO ${ecoId} not found`);

    eco.status = 'APPROVED';
    eco.approvalStatus = 'APPROVED';
    eco.approvedBy = approver;
    eco.approvalTimestamp = new Date().toISOString();

    // In a real system, this would move affected artifacts to UNDER_REVIEW or similar
  }

  /**
   * Generates a Release Manifest after all gates are passed.
   */
  public static generateReleaseManifest(
    productId: string,
    productName: string,
    ecoId: string
  ): ReleaseManifest {
    const eco = this.ecos.get(ecoId);
    if (!eco || eco.status !== 'APPROVED') {
      throw new Error(`Cannot release: ECO ${ecoId} is not approved.`);
    }

    // Collect current revisions of all artifacts involved in the release
    // For simplicity, we search the artifacts map
    const releaseRevisions: any = {};
    this.artifacts.forEach(a => {
      if (a.status === 'VALID' || a.status === 'APPROVED' || a.status === 'RELEASED') {
        switch (a.type) {
          case 'CAD_GEOMETRY': releaseRevisions.cadRevision = a.revision; break;
          case 'ASSEMBLY': releaseRevisions.assemblyRevision = a.revision; break;
          case 'BOM': releaseRevisions.bomRevision = a.revision; break;
          case 'PMI_GDNT': releaseRevisions.pmiRevision = a.revision; break;
          case 'FEA_RESULT': releaseRevisions.feaRevision = a.revision; break;
          case 'CAM_TOOLPATH': releaseRevisions.camRevision = a.revision; break;
          case 'MACHINE_SIMULATION': releaseRevisions.simulationRevision = a.revision; break;
          case 'INSPECTION_PLAN': releaseRevisions.inspectionPlanRevision = a.revision; break;
          case 'INSPECTION_REPORT': releaseRevisions.inspectionReportRevision = a.revision; break;
        }
      }
    });

    // Verification: Ensure all mandatory artifacts are present and valid
    const mandatory: ArtifactType[] = ['CAD_GEOMETRY', 'ASSEMBLY', 'BOM'];
    for (const m of mandatory) {
      const art = Array.from(this.artifacts.values()).find(a => a.type === m && (a.status === 'VALID' || a.status === 'APPROVED' || a.status === 'RELEASED'));
      if (!art) throw new Error(`Release Blocked: Missing valid ${m} artifact.`);
    }

    const timestamp = new Date().toISOString();
    const releaseId = `REL-${productId}-${Date.now().toString(36).toUpperCase()}`;

    // Provenance Root from SystemProvenanceEngine (mocking integration for now)
    const prov = SystemProvenanceEngine.recordStage('ENTERPRISE_RELEASE', {
      productId,
      revisions: releaseRevisions,
      ecoId,
      timestamp
    });

    const manifest: ReleaseManifest = {
      releaseId,
      productId,
      productName,
      ecoId,
      timestamp,
      status: 'RELEASED',
      revisions: releaseRevisions,
      provenanceRoot: prov.recordHash,
      releaseHash: `HASH-${prov.recordHash.substring(5)}`,
      approvalSignature: `SIG-REL-${eco.approvedBy}-${Date.now()}`
    };

    // Mark all included artifacts as RELEASED
    this.artifacts.forEach(a => {
      if (Object.values(releaseRevisions).includes(a.revision)) {
        a.status = 'RELEASED';
      }
    });

    return manifest;
  }

  public static getArtifact(id: string): EngineeringArtifact | undefined {
    return this.artifacts.get(id);
  }

  public static getAllArtifacts(): EngineeringArtifact[] {
    return Array.from(this.artifacts.values());
  }

  public static getECO(id: string): EngineeringChangeOrder | undefined {
    return this.ecos.get(id);
  }

  public static getAllECOs(): EngineeringChangeOrder[] {
    return Array.from(this.ecos.values());
  }
}
