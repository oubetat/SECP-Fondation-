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
  private static artifacts: Map<string, EngineeringArtifact[]> = new Map(); // artifactId -> list of revisions
  private static ecos: Map<string, EngineeringChangeOrder> = new Map();
  private static dependencyGraph: Map<string, string[]> = new Map(); // artifactRevisionId -> list of dependent artifactRevisionIds

  /**
   * Registers a new engineering artifact or a new revision of an existing one.
   */
  public static registerArtifact(artifact: EngineeringArtifact): void {
    console.log(`[PLM] Registering ${artifact.artifactId}@${artifact.revision} (${artifact.status})`);
    const revisions = this.artifacts.get(artifact.artifactId) || [];
    const existingIndex = revisions.findIndex(r => r.revision === artifact.revision);
    
    // Mark old revisions as superseded if this is a new one
    const supersededRevs: string[] = [];
    for (const rev of revisions) {
      if (rev.revision !== artifact.revision && rev.status !== 'WITHDRAWN') {
        rev.status = 'SUPERSEDED';
        supersededRevs.push(rev.revision);
      }
    }
    
    let hashChanged = false;
    if (existingIndex >= 0) {
      const prev = revisions[existingIndex];
      hashChanged = prev.geometryHash !== artifact.geometryHash || prev.topologyHash !== artifact.topologyHash;
      revisions[existingIndex] = artifact;
    } else {
      revisions.push(artifact);
    }
    this.artifacts.set(artifact.artifactId, revisions);
    
    // If an existing revision was re-registered with changed hashes, invalidate its dependents
    if (hashChanged) {
      this.performInvalidation(artifact.artifactId, artifact.revision);
    }
    // Crucial: Invalidate downstream dependents that depended on superseded revisions!
    for (const oldRev of supersededRevs) {
      this.performInvalidation(artifact.artifactId, oldRev);
    }
  }

  /**
   * Resets all in-memory PLM state (for clean test isolation).
   */
  public static clear(): void {
    this.artifacts.clear();
    this.ecos.clear();
    this.dependencyGraph.clear();
  }

  /**
   * Enforces authoritative PLM lifecycle state transitions with strict gate checks.
   */
  public static transitionArtifactStatus(
    artifactId: string,
    revision: string,
    targetStatus: ArtifactStatus,
    actor: string,
    reason?: string
  ): { success: boolean; error?: string; artifact?: EngineeringArtifact } {
    const art = this.getArtifact(artifactId, revision);
    if (!art) {
      return { success: false, error: `Artifact ${artifactId}@${revision} not found` };
    }

    const currentStatus = art.status;
    if (currentStatus === targetStatus) {
      return { success: true, artifact: art };
    }

    // Enforce PLM state transition constraints
    const allowedTransitions: Record<ArtifactStatus, ArtifactStatus[]> = {
      DRAFT: ['UNDER_REVIEW', 'VALID'],
      VALID: ['UNDER_REVIEW', 'OUTDATED', 'SUPERSEDED', 'APPROVED'],
      UNDER_REVIEW: ['APPROVED', 'DRAFT', 'OUTDATED'],
      APPROVED: ['RELEASED', 'OUTDATED', 'SUPERSEDED', 'UNDER_REVIEW'],
      RELEASED: ['SUPERSEDED', 'WITHDRAWN', 'OUTDATED'],
      OUTDATED: ['DRAFT', 'SUPERSEDED', 'WITHDRAWN', 'VALID'],
      SUPERSEDED: ['WITHDRAWN'],
      WITHDRAWN: [],
      INVALIDATED: ['DRAFT', 'WITHDRAWN'],
      REQUIRES_RECALCULATION: ['DRAFT', 'VALID', 'OUTDATED']
    };

    const allowed = allowedTransitions[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      const errorMsg = `Illegal lifecycle transition: Cannot move ${artifactId}@${revision} from ${currentStatus} to ${targetStatus}. Direct jumps or regressions from RELEASED without ECO are forbidden.`;
      return { success: false, error: errorMsg };
    }

    art.status = targetStatus;
    if (targetStatus === 'OUTDATED' || targetStatus === 'SUPERSEDED' || targetStatus === 'INVALIDATED') {
      this.performInvalidation(artifactId, revision);
    }

    return { success: true, artifact: art };
  }

  /**
   * Recursively verifies that an artifact and all its dependencies are in a valid state for release.
   * Blocks if any dependency is SUPERSEDED, OUTDATED, or INVALIDATED.
   */
  private static verifyDependencyIntegrity(artifact: EngineeringArtifact, visited: Set<string> = new Set()): void {
    const key = `${artifact.artifactId}@${artifact.revision}`;
    if (visited.has(key)) return;
    visited.add(key);

    if (artifact.status === 'OUTDATED' || artifact.status === 'SUPERSEDED' || artifact.status === 'INVALIDATED') {
      throw new Error(`Release Blocked: Artifact ${key} is in ${artifact.status} state.`);
    }

    // Check all direct dependencies via the dependency graph
    const children = this.getDependencies(artifact.artifactId, artifact.revision);
    for (const childKey of children) {
      const [childId, childRev] = childKey.split('@');
      const childArt = this.getArtifact(childId, childRev);
      
      if (!childArt) {
        throw new Error(`Release Blocked: Dependency ${childKey} of ${key} not found in PLM engine.`);
      }

      if (childArt.status === 'OUTDATED' || childArt.status === 'SUPERSEDED' || childArt.status === 'INVALIDATED') {
        throw new Error(`Release Blocked: Artifact ${key} depends on stale/invalidated ${childKey} (${childArt.status}).`);
      }

      // Recurse
      this.verifyDependencyIntegrity(childArt, visited);
    }
  }

  /**
   * Queries all downstream dependents registered for a given dependency revision.
   */
  public static getDependents(dependencyId: string, dependencyRev: string): string[] {
    const depKey = `${dependencyId}@${dependencyRev}`;
    return [...(this.dependencyGraph.get(depKey) || [])];
  }

  /**
   * Queries all upstream dependencies for a given dependent artifact revision.
   */
  public static getDependencies(dependentId: string, dependentRev: string): string[] {
    const targetKey = `${dependentId}@${dependentRev}`;
    const result: string[] = [];
    this.dependencyGraph.forEach((dependents, depKey) => {
      if (dependents.includes(targetKey)) {
        result.push(depKey);
      }
    });
    return result;
  }

  /**
   * Establishes a dependency between two specific revisions.
   */
  public static addDependency(dependentId: string, dependentRev: string, dependencyId: string, dependencyRev: string): void {
    const depKey = `${dependencyId}@${dependencyRev}`;
    const dependentKey = `${dependentId}@${dependentRev}`;
    const dependents = this.dependencyGraph.get(depKey) || [];
    if (!dependents.includes(dependentKey)) {
      dependents.push(dependentKey);
      this.dependencyGraph.set(depKey, dependents);
    }
  }

  /**
   * Performs automatic invalidation of downstream artifacts when a dependency changes.
   */
  private static performInvalidation(sourceId: string, sourceRev: string): void {
    const sourceKey = `${sourceId}@${sourceRev}`;
    const dependents = this.dependencyGraph.get(sourceKey) || [];
    for (const depKey of dependents) {
      const [depId, depRev] = depKey.split('@');
      const revisions = this.artifacts.get(depId) || [];
      const artifact = revisions.find(r => r.revision === depRev);
      
      if (artifact && (artifact.status === 'VALID' || artifact.status === 'RELEASED' || artifact.status === 'APPROVED')) {
        artifact.status = 'OUTDATED';
        console.log(`[PLM] Artifact ${depKey} invalidated by change in ${sourceKey}`);
        // Recursively invalidate
        this.performInvalidation(depId, depRev);
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
      
      // Start with the latest revision of the target artifact
      const latest = this.getArtifact(request.artifactId);
      if (!latest) continue;

      const queue = [`${request.artifactId}@${latest.revision}`];

      while (queue.length > 0) {
        const currentKey = queue.shift()!;
        if (visited.has(currentKey)) continue;
        visited.add(currentKey);

        const dependents = this.dependencyGraph.get(currentKey) || [];
        for (const depKey of dependents) {
          const [depId, depRev] = depKey.split('@');
          const depArtifact = this.getArtifact(depId, depRev);
          if (depArtifact) {
            affectedDownstream.push({
              artifactId: depId,
              type: depArtifact.type,
              reason: `Direct or indirect dependency on ${currentKey}`,
              impactSeverity: this.calculateSeverity(depArtifact.type)
            });
            queue.push(depKey);
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
    const releaseRevisions: any = {};
    this.artifacts.forEach(revisions => {
      revisions.forEach(a => {
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
    });

    // Verification: Ensure all mandatory artifacts are present and valid
    const mandatory: ArtifactType[] = ['CAD_GEOMETRY', 'ASSEMBLY', 'BOM'];
    const artifactsInRelease: EngineeringArtifact[] = [];

    for (const m of mandatory) {
      const candidates = Array.from(this.artifacts.values())
        .flat()
        .filter(a => a.type === m && (a.status === 'VALID' || a.status === 'APPROVED' || a.status === 'RELEASED'))
        .sort((a, b) => (b.version || 0) - (a.version || 0));
      
      const art = candidates[0]; // Pick latest valid

      if (!art) throw new Error(`Release Blocked: Missing valid ${m} artifact.`);
      artifactsInRelease.push(art);
    }

    // Deep Dependency Validation: Ensure no artifact in the release depends on a SUPERSEDED or OUTDATED revision
    for (const rootArt of artifactsInRelease) {
      this.verifyDependencyIntegrity(rootArt);
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
    this.artifacts.forEach(revisions => {
      revisions.forEach(a => {
        if (Object.values(releaseRevisions).includes(a.revision)) {
          a.status = 'RELEASED';
        }
      });
    });

    return manifest;
  }

  public static getArtifact(id: string, revision?: string): EngineeringArtifact | undefined {
    const revisions = this.artifacts.get(id) || [];
    if (revision) {
      return revisions.find(r => r.revision === revision);
    }
    // Return latest if no revision specified
    return revisions[revisions.length - 1];
  }

  public static getAllArtifacts(): EngineeringArtifact[] {
    const all: EngineeringArtifact[] = [];
    this.artifacts.forEach(revs => all.push(...revs));
    return all;
  }

  public static getECO(id: string): EngineeringChangeOrder | undefined {
    return this.ecos.get(id);
  }

  public static getAllECOs(): EngineeringChangeOrder[] {
    return Array.from(this.ecos.values());
  }
}
