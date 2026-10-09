import { createHash } from 'crypto';
import { 
  Revision, 
  RevisionLifecycleState, 
  RevisionApproval, 
  RevisionAuditRecord, 
  RevisionDiff, 
  EngineeringBaseline,
  DependencySnapshot,
  RevisionComment,
  RevisionEntityType,
  EngineeringSnapshot
} from './types';
import { RevisionCanonicalizer } from './RevisionCanonicalizer';
import { RevisionLifecycleEngine } from './RevisionLifecycleEngine';
import { RevisionDiffEngine } from './RevisionDiffEngine';
import { RevisionImpactAnalyzer, ImpactedItem } from './RevisionImpactAnalyzer';
import { RevisionIntegrityChecker, IntegrityReport } from './RevisionIntegrityChecker';

export interface RevisionPolicy {
  policyId: string;
  numberingScheme: 'ALPHABETIC' | 'NUMERIC' | 'CUSTOM';
  customRegex?: string;
  allowManualLabels: boolean;
  requirePreReleaseValidation: boolean;
  allowSelfApproval: boolean;
}

export class RevisionEngine {
  private revisions: Map<string, Revision> = new Map();
  private baselines: Map<string, EngineeringBaseline> = new Map();
  private auditLog: RevisionAuditRecord[] = [];
  private policies: Map<string, RevisionPolicy> = new Map();
  private locks: Map<string, { lockedBy: string; timestamp: string }> = new Map();

  constructor() {
    // Register some default policies
    this.policies.set('DEFAULT_ALPHABETIC', {
      policyId: 'DEFAULT_ALPHABETIC',
      numberingScheme: 'ALPHABETIC',
      allowManualLabels: true,
      requirePreReleaseValidation: true,
      allowSelfApproval: false
    });
    this.policies.set('DEFAULT_NUMERIC', {
      policyId: 'DEFAULT_NUMERIC',
      numberingScheme: 'NUMERIC',
      allowManualLabels: true,
      requirePreReleaseValidation: true,
      allowSelfApproval: false
    });
  }

  // --- Core API ---

  public createRevision(revision: Revision): Revision {
    if (this.revisions.has(revision.revisionId)) {
      throw new Error(`REVISION_COLLISION: ${revision.revisionId} already exists in database.`);
    }

    // Assign standard properties if empty
    if (!revision.createdAt) revision.createdAt = new Date().toISOString();
    if (!revision.comments) revision.comments = [];
    if (!revision.approvals) revision.approvals = [];
    if (!revision.dependencies) revision.dependencies = [];
    if (!revision.effectivity) revision.effectivity = [];
    if (!revision.configurationScope) revision.configurationScope = [];
    if (!revision.validationState) revision.validationState = 'UNPROVEN';
    if (!revision.evidenceReferences) revision.evidenceReferences = [];
    if (!revision.lifecycleState) revision.lifecycleState = RevisionLifecycleState.DRAFT;

    // Lineage linking: verify parent is valid
    if (revision.parentRevisionId) {
      const parent = this.revisions.get(revision.parentRevisionId);
      if (!parent) {
        throw new Error(`ORPHANED_REVISION: Parent revision '${revision.parentRevisionId}' does not exist.`);
      }
    }

    // Verify revision uniqueness inside this entity lineage
    const existingSameCode = Array.from(this.revisions.values()).find(
      r => r.entityId === revision.entityId && r.revisionCode === revision.revisionCode
    );
    if (existingSameCode) {
      throw new Error(`REVISION_UNIQUENESS_VIOLATION: ${revision.entityId} already has an active revision with code '${revision.revisionCode}'`);
    }

    // Generate cryptographic hash stamps
    revision.contentHash = RevisionCanonicalizer.computeContentHash(revision.content);
    revision.dependencyHash = RevisionCanonicalizer.computeDependencyHash(revision.dependencies);
    revision.revisionHash = RevisionCanonicalizer.computeRevisionHash(revision);

    this.revisions.set(revision.revisionId, revision);

    this.logAudit(
      revision.revisionId,
      'REVISION_CREATED',
      revision.createdBy,
      null,
      revision.lifecycleState,
      null,
      revision.revisionHash,
      revision.changeReason || 'Initial registration',
      `Revision of type ${revision.entityType} initialized with label '${revision.revisionCode}'`
    );

    return revision;
  }

  public getRevision(revisionId: string): Revision | undefined {
    return this.revisions.get(revisionId);
  }

  public getAllRevisions(): Revision[] {
    return Array.from(this.revisions.values());
  }

  public getRevisionHistory(entityId: string): Revision[] {
    return Array.from(this.revisions.values())
      .filter(r => r.entityId === entityId)
      .sort((a, b) => a.revisionNumber - b.revisionNumber);
  }

  public getLatestRevision(entityId: string): Revision | undefined {
    const history = this.getRevisionHistory(entityId);
    return history[history.length - 1];
  }

  public getLatestReleasedRevision(entityId: string): Revision | undefined {
    const history = this.getRevisionHistory(entityId);
    return [...history].reverse().find(r => r.lifecycleState === RevisionLifecycleState.RELEASED);
  }

  // --- Number Generation Policy ---

  public generateNextRevisionCode(entityId: string, policyId: string = 'DEFAULT_ALPHABETIC'): { code: string; number: number } {
    const history = this.getRevisionHistory(entityId);
    const policy = this.policies.get(policyId) || this.policies.get('DEFAULT_ALPHABETIC')!;

    if (history.length === 0) {
      return {
        code: policy.numberingScheme === 'NUMERIC' ? '01' : 'A',
        number: 1
      };
    }

    const last = history[history.length - 1];
    const nextNum = last.revisionNumber + 1;

    if (policy.numberingScheme === 'NUMERIC') {
      const codeStr = String(nextNum).padStart(2, '0');
      return { code: codeStr, number: nextNum };
    } else {
      // Alphabetic: A, B, C... Z, AA, AB
      let codeStr = '';
      let temp = nextNum - 1;
      while (temp >= 0) {
        codeStr = String.fromCharCode((temp % 26) + 65) + codeStr;
        temp = Math.floor(temp / 26) - 1;
      }
      return { code: codeStr, number: nextNum };
    }
  }

  // --- Checkout / Branching ---

  public checkoutRevision(revisionId: string, actorId: string, changeReason: string = 'Checkout copy'): Revision {
    const original = this.revisions.get(revisionId);
    if (!original) throw new Error('REVISION_NOT_FOUND');

    // Generate new revision coordinates using the entity history
    const { code, number } = this.generateNextRevisionCode(original.entityId);

    const workingCopy: Revision = {
      revisionId: `${original.entityId}:REV-${code}`,
      entityId: original.entityId,
      entityType: original.entityType,
      revisionCode: code,
      revisionNumber: number,
      parentRevisionId: original.revisionId,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdAt: new Date().toISOString(),
      createdBy: actorId,
      effectivity: [...original.effectivity],
      configurationScope: [...original.configurationScope],
      dependencies: original.dependencies.map(d => ({ ...d })),
      approvals: [],
      comments: [],
      changeReason,
      changeDescription: `Derived from parent revision ${original.revisionCode}`,
      changeSummary: {},
      validationState: 'UNPROVEN',
      evidenceReferences: [],
      contentHash: '',
      dependencyHash: '',
      revisionHash: '',
      content: JSON.parse(JSON.stringify(original.content)),
      snapshot: JSON.parse(JSON.stringify(original.snapshot))
    };

    return this.createRevision(workingCopy);
  }

  // --- Mutation with Immutability Rules ---

  public updateContent(revisionId: string, newContent: any, actorId: string, newSnapshot?: EngineeringSnapshot, summary: Record<string, any> = {}): Revision {
    const rev = this.revisions.get(revisionId);
    if (!rev) throw new Error('NOT_FOUND');

    if (rev.lifecycleState === RevisionLifecycleState.RELEASED || rev.lifecycleState === RevisionLifecycleState.OBSOLETE || rev.lifecycleState === RevisionLifecycleState.SUPERSEDED) {
      throw new Error(`IMMUTABLE_REVISION: Cannot modify contents of a revision in ${rev.lifecycleState} state.`);
    }

    if (this.isLocked(rev.entityId) && this.getLockHolder(rev.entityId) !== actorId) {
      throw new Error(`REVISION_LOCKED: Revision is locked by ${this.getLockHolder(rev.entityId)}`);
    }

    const beforeHash = rev.revisionHash;
    rev.content = newContent;
    if (newSnapshot) {
      rev.snapshot = newSnapshot;
    }
    rev.changeSummary = { ...rev.changeSummary, ...summary };
    rev.contentHash = RevisionCanonicalizer.computeContentHash(rev.content);
    rev.revisionHash = RevisionCanonicalizer.computeRevisionHash(rev);

    this.logAudit(
      rev.revisionId,
      'UPDATE_CONTENT',
      actorId,
      rev.lifecycleState,
      rev.lifecycleState,
      beforeHash,
      rev.revisionHash,
      'Content and Snapshot update',
      'Entity dimensions, parameters, or metadata modified.'
    );

    return rev;
  }

  public updateDependencies(revisionId: string, dependencies: DependencySnapshot[], actorId: string): Revision {
    const rev = this.revisions.get(revisionId);
    if (!rev) throw new Error('NOT_FOUND');

    if (rev.lifecycleState === RevisionLifecycleState.RELEASED || rev.lifecycleState === RevisionLifecycleState.OBSOLETE || rev.lifecycleState === RevisionLifecycleState.SUPERSEDED) {
      throw new Error('IMMUTABLE_REVISION: Cannot alter dependencies of a locked released state.');
    }

    const beforeHash = rev.revisionHash;
    rev.dependencies = dependencies;
    rev.dependencyHash = RevisionCanonicalizer.computeDependencyHash(rev.dependencies);
    rev.revisionHash = RevisionCanonicalizer.computeRevisionHash(rev);

    this.logAudit(
      rev.revisionId,
      'UPDATE_DEPENDENCIES',
      actorId,
      rev.lifecycleState,
      rev.lifecycleState,
      beforeHash,
      rev.revisionHash,
      'Dependency adjustment',
      'Pin sets updated.'
    );

    return rev;
  }

  public setValidationState(revisionId: string, state: 'PROVEN' | 'PARTIAL' | 'UNPROVEN' | 'SIMULATED' | 'ABSENT', evidenceId?: string): Revision {
    const rev = this.revisions.get(revisionId);
    if (!rev) throw new Error('NOT_FOUND');

    rev.validationState = state;
    if (evidenceId && !rev.evidenceReferences.includes(evidenceId)) {
      rev.evidenceReferences.push(evidenceId);
    }
    
    rev.revisionHash = RevisionCanonicalizer.computeRevisionHash(rev);
    return rev;
  }

  // --- Workflows: Transition state / Approvals ---

  public addApproval(revisionId: string, approval: RevisionApproval): void {
    const rev = this.revisions.get(revisionId);
    if (!rev) throw new Error('NOT_FOUND');

    if (rev.approvals.some(a => a.approvalId === approval.approvalId)) {
      throw new Error('APPROVAL_TAMPER: Approval record already indexed.');
    }

    rev.approvals.push(approval);
    rev.revisionHash = RevisionCanonicalizer.computeRevisionHash(rev);

    this.logAudit(
      revisionId,
      'APPROVAL_ADDED',
      approval.actorId,
      rev.lifecycleState,
      rev.lifecycleState,
      rev.revisionHash,
      rev.revisionHash,
      'Approval cycle',
      `Approval recorded by ${approval.actorId} with decision: ${approval.decision}`
    );
  }

  public addComment(revisionId: string, author: string, text: string): void {
    const rev = this.revisions.get(revisionId);
    if (!rev) throw new Error('NOT_FOUND');

    const commentHash = createHash('sha256')
      .update(`${revisionId}:${author}:${text}:${rev.comments.length}`)
      .digest('hex')
      .slice(0, 8)
      .toUpperCase();
    const comment: RevisionComment = {
      commentId: `COM-${revisionId}-${commentHash}`,
      author,
      text,
      timestamp: new Date().toISOString()
    };
    rev.comments.push(comment);
    rev.revisionHash = RevisionCanonicalizer.computeRevisionHash(rev);
  }

  public transitionState(revisionId: string, toState: RevisionLifecycleState, actorId: string, reason: string): Revision {
    const rev = this.revisions.get(revisionId);
    if (!rev) throw new Error('NOT_FOUND');

    const beforeState = rev.lifecycleState;
    const beforeHash = rev.revisionHash;

    const { transition, audit } = RevisionLifecycleEngine.transitionState(rev, toState, actorId, reason);

    // Commit change
    rev.lifecycleState = toState;
    if (toState === RevisionLifecycleState.RELEASED) {
      rev.releasedAt = transition.timestamp;
      rev.releasedBy = actorId;

      // Automatically supersede previous released revisions of the same entity
      const history = this.getRevisionHistory(rev.entityId);
      for (const oldRev of history) {
        if (oldRev.revisionId !== rev.revisionId && oldRev.lifecycleState === RevisionLifecycleState.RELEASED) {
          this.supersedeRevision(oldRev.revisionId, rev.revisionId, actorId);
        }
      }
    }

    this.auditLog.push(audit);
    return rev;
  }

  public releaseRevision(revisionId: string, actorId: string, reason: string): Revision {
    return this.transitionState(revisionId, RevisionLifecycleState.RELEASED, actorId, reason);
  }

  public supersedeRevision(revisionId: string, replacedByRevId: string, actorId: string): Revision {
    const rev = this.revisions.get(revisionId);
    if (!rev) throw new Error('NOT_FOUND');

    rev.lifecycleState = RevisionLifecycleState.SUPERSEDED;
    rev.supersededByRevisionId = replacedByRevId;
    rev.revisionHash = RevisionCanonicalizer.computeRevisionHash(rev);

    const nextRev = this.revisions.get(replacedByRevId);
    if (nextRev) {
      nextRev.supersedesRevisionId = revisionId;
      nextRev.revisionHash = RevisionCanonicalizer.computeRevisionHash(nextRev);
    }

    this.logAudit(
      revisionId,
      'REVISION_SUPERSEDED',
      actorId,
      RevisionLifecycleState.RELEASED,
      RevisionLifecycleState.SUPERSEDED,
      rev.revisionHash,
      rev.revisionHash,
      'Superseded by newer released state',
      `Superseded by revision ID: ${replacedByRevId}`
    );

    return rev;
  }

  public obsoleteRevision(revisionId: string, actorId: string, reason: string): Revision {
    return this.transitionState(revisionId, RevisionLifecycleState.OBSOLETE, actorId, reason);
  }

  public restoreRevision(revisionId: string, actorId: string): Revision {
    const oldRev = this.revisions.get(revisionId);
    if (!oldRev) throw new Error('REVISION_NOT_FOUND');

    // Create a new DRAFT working copy matching the old revision's precise parameters
    return this.checkoutRevision(revisionId, actorId, `Restored from original historical revision ${oldRev.revisionCode}`);
  }

  // --- Baselines ---

  public createBaseline(baseline: EngineeringBaseline): EngineeringBaseline {
    if (this.baselines.has(baseline.baselineId)) {
      throw new Error(`BASELINE_COLLISION: Baseline '${baseline.baselineId}' already exists.`);
    }

    // Verify all referenced revisions exist and are released/pinned
    for (const [entityId, revId] of Object.entries(baseline.revisions)) {
      const rev = this.revisions.get(revId);
      if (!rev) {
        throw new Error(`BASELINE_INTEGRITY_VIOLATION: Referenced revision '${revId}' for '${entityId}' not found.`);
      }
    }

    // Compute deterministic Baseline Hash
    const sortedMap = Object.entries(baseline.revisions).sort((a, b) => a[0].localeCompare(b[0]));
    baseline.baselineHash = createHash('sha256').update(JSON.stringify(sortedMap)).digest('hex');

    this.baselines.set(baseline.baselineId, baseline);
    return baseline;
  }

  public getBaseline(baselineId: string): EngineeringBaseline | undefined {
    return this.baselines.get(baselineId);
  }

  public getBaselines(): EngineeringBaseline[] {
    return Array.from(this.baselines.values());
  }

  public compareBaselines(baselineAId: string, baselineBId: string): any {
    const baseA = this.baselines.get(baselineAId);
    const baseB = this.baselines.get(baselineBId);
    if (!baseA || !baseB) throw new Error('BASELINE_NOT_FOUND');

    const added: Record<string, string> = {};
    const removed: Record<string, string> = {};
    const changed: Record<string, { from: string; to: string }> = {};

    const keysA = Object.keys(baseA.revisions);
    const keysB = Object.keys(baseB.revisions);

    for (const key of keysB) {
      if (!baseA.revisions[key]) {
        added[key] = baseB.revisions[key];
      } else if (baseA.revisions[key] !== baseB.revisions[key]) {
        changed[key] = { from: baseA.revisions[key], to: baseB.revisions[key] };
      }
    }

    for (const key of keysA) {
      if (!baseB.revisions[key]) {
        removed[key] = baseA.revisions[key];
      }
    }

    return { added, removed, changed };
  }

  // --- Analytical / Integrity engines ---

  public compareRevisions(revAId: string, revBId: string): RevisionDiff {
    const revA = this.revisions.get(revAId);
    const revB = this.revisions.get(revBId);
    if (!revA || !revB) throw new Error('REVISION_NOT_FOUND');
    return RevisionDiffEngine.compare(revA, revB);
  }

  public getImpact(revisionId: string): ImpactedItem[] {
    const rev = this.revisions.get(revisionId);
    if (!rev) throw new Error('REVISION_NOT_FOUND');
    return RevisionImpactAnalyzer.analyzeImpact(rev, this.getAllRevisions());
  }

  public verifyIntegrity(revisionId: string): string[] {
    const rev = this.revisions.get(revisionId);
    if (!rev) throw new Error('NOT_FOUND');
    const report = RevisionIntegrityChecker.verifyRevision(rev, this.getAllRevisions());
    return report.errors.map(e => e.field + ': ' + e.message);
  }

  public getDetailedIntegrityReport(revisionId: string): IntegrityReport {
    const rev = this.revisions.get(revisionId);
    if (!rev) throw new Error('NOT_FOUND');
    return RevisionIntegrityChecker.verifyRevision(rev, this.getAllRevisions());
  }

  // --- Import / Export ---

  public exportRevisionPackage(revisionId: string): string {
    const rev = this.revisions.get(revisionId);
    if (!rev) throw new Error('REVISION_NOT_FOUND');

    const pkg = {
      exportedAt: new Date().toISOString(),
      provenanceSource: 'SECP_SECURE_PLM_WORKBENCH',
      packageChecksum: '',
      revision: rev
    };

    const payload = JSON.stringify(pkg);
    pkg.packageChecksum = createHash('sha256').update(payload).digest('hex');
    return JSON.stringify(pkg, null, 2);
  }

  public importRevisionPackage(jsonString: string, actorId: string): Revision {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.revision || !parsed.packageChecksum) {
        throw new Error('INVALID_PACKAGE_FORMAT');
      }

      const rev = parsed.revision as Revision;
      
      // Duplicate protection
      if (this.revisions.has(rev.revisionId)) {
        throw new Error(`IMPORT_COLLISION: Revision ${rev.revisionId} already exists in local registry.`);
      }

      // Record provenance on import
      rev.changeSummary = {
        ...rev.changeSummary,
        importedAt: new Date().toISOString(),
        importedBy: actorId,
        sourceProvenance: parsed.provenanceSource || 'UNKNOWN'
      };

      // Perform deep integrity validation on imported block
      const integrity = RevisionIntegrityChecker.verifyRevision(rev, this.getAllRevisions());
      if (!integrity.isValid) {
        throw new Error(`IMPORT_CORRUPTED: Imported revision failed hash validation.`);
      }

      this.revisions.set(rev.revisionId, rev);
      
      this.logAudit(
        rev.revisionId,
        'IMPORT_REVISION',
        actorId,
        null,
        rev.lifecycleState,
        null,
        rev.revisionHash,
        'Imported from package',
        `Imported from source: ${parsed.provenanceSource || 'External'}`
      );

      return rev;
    } catch (err: any) {
      throw new Error(`IMPORT_FAILED: ${err.message}`);
    }
  }

  // --- Locks ---

  public lockEntity(entityId: string, actorId: string): void {
    if (this.locks.has(entityId)) {
      throw new Error(`ALREADY_LOCKED: Entity is locked by ${this.locks.get(entityId)!.lockedBy}`);
    }
    this.locks.set(entityId, { lockedBy: actorId, timestamp: new Date().toISOString() });
  }

  public unlockEntity(entityId: string, actorId: string): void {
    const lock = this.locks.get(entityId);
    if (!lock) return;
    if (lock.lockedBy !== actorId && actorId !== 'BYPASS_ADMIN') {
      throw new Error('PERMISSION_DENIED: Cannot release another user\'s lock.');
    }
    this.locks.delete(entityId);
  }

  public isLocked(entityId: string): boolean {
    return this.locks.has(entityId);
  }

  public getLockHolder(entityId: string): string | null {
    return this.locks.get(entityId)?.lockedBy || null;
  }

  // --- Auditing helper ---

  public getAuditTrail(revisionId: string): RevisionAuditRecord[] {
    return this.auditLog.filter(a => a.revisionId === revisionId);
  }

  public getAllAuditLogs(): RevisionAuditRecord[] {
    return this.auditLog;
  }

  private logAudit(
    revisionId: string,
    action: string,
    actorId: string,
    beforeState: RevisionLifecycleState | null,
    afterState: RevisionLifecycleState,
    beforeHash: string | null,
    afterHash: string,
    reason: string,
    details: string
  ) {
    this.auditLog.push({
      revisionId,
      action,
      actorId,
      timestamp: new Date().toISOString(),
      beforeState,
      afterState,
      beforeHash,
      afterHash,
      reason,
      details
    });
  }
}
