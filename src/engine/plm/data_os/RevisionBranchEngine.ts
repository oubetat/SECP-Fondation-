/**
 * SECP Industrial OS v3 — PATCH-181: Revision Branching Engine
 * Provides Git-like branching, merging, conflict detection, and deterministic
 * revision identity graph for engineering objects.
 */

import { RevisionNode, RevisionBranch, ReleaseLifecycleState } from './EngineeringDataOSTypes';
import { generateDeterministicHashSync } from '../../../lib/hash';

export interface MergeResult {
  success: boolean;
  mergedRevision?: RevisionNode;
  hasConflicts: boolean;
  conflicts: {
    propertyKey: string;
    sourceBranchValue: any;
    targetBranchValue: any;
    baseValue: any;
    resolution?: any;
  }[];
  mergeType: 'FAST_FORWARD' | 'THREE_WAY' | 'ABORTED_CONFLICT';
}

export class RevisionBranchEngine {
  private static revisions: Map<string, RevisionNode> = new Map(); // revisionId -> RevisionNode
  private static branches: Map<string, RevisionBranch[]> = new Map(); // objectId -> list of branches
  private static objectRevisions: Map<string, string[]> = new Map(); // objectId -> ordered list of revisionIds

  public static clear(): void {
    this.revisions.clear();
    this.branches.clear();
    this.objectRevisions.clear();
  }

  /**
   * Generates a deterministic revision ID.
   */
  public static computeRevisionId(objectId: string, branchName: string, versionSeq: number, contentHash: string): string {
    const raw = `${objectId}:${branchName}:${versionSeq}:${contentHash}`;
    const hash = generateDeterministicHashSync({ raw });
    return `REV-${branchName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}-${versionSeq}-${hash.substring(0, 6)}`;
  }

  /**
   * Initializes a repository/object with its initial master revision (e.g. REV-A.0).
   */
  public static initializeObjectLineage(
    objectId: string,
    author: string,
    initialProperties: Record<string, any>,
    initialState: ReleaseLifecycleState = 'DRAFT'
  ): RevisionNode {
    const contentHash = generateDeterministicHashSync(initialProperties);
    const revisionId = this.computeRevisionId(objectId, 'master', 1, contentHash);

    const initialRev: RevisionNode = {
      revisionId,
      objectId,
      revisionLabel: 'REV-A.1',
      versionSequence: 1,
      branchName: 'master',
      state: initialState,
      author,
      timestamp: new Date().toISOString(),
      commitMessage: 'Initial engineering definition',
      contentHash,
      dependencyHash: 'DEP-ROOT',
      isImmutable: initialState === 'RELEASED',
      properties: { ...initialProperties }
    };

    this.revisions.set(revisionId, initialRev);
    this.objectRevisions.set(objectId, [revisionId]);

    const masterBranch: RevisionBranch = {
      branchName: 'master',
      objectId,
      headRevisionId: revisionId,
      baseRevisionId: revisionId,
      isProtected: true,
      createdAt: new Date().toISOString(),
      createdBy: author
    };

    this.branches.set(objectId, [masterBranch]);
    return initialRev;
  }

  /**
   * Creates a new branch from a base revision.
   */
  public static createBranch(objectId: string, branchName: string, baseRevisionId: string, author: string): RevisionBranch {
    const baseRev = this.revisions.get(baseRevisionId);
    if (!baseRev) {
      throw new Error(`Base revision ${baseRevisionId} not found for object ${objectId}`);
    }

    const existingBranches = this.branches.get(objectId) || [];
    if (existingBranches.some(b => b.branchName === branchName)) {
      throw new Error(`Branch '${branchName}' already exists on object ${objectId}`);
    }

    const newBranch: RevisionBranch = {
      branchName,
      objectId,
      headRevisionId: baseRevisionId,
      baseRevisionId: baseRevisionId,
      isProtected: false,
      createdAt: new Date().toISOString(),
      createdBy: author
    };

    existingBranches.push(newBranch);
    this.branches.set(objectId, existingBranches);
    return newBranch;
  }

  /**
   * Commits a new revision onto a specific branch.
   * Ensures that published revisions cannot be modified in-place.
   */
  public static commitRevision(
    objectId: string,
    branchName: string,
    author: string,
    commitMessage: string,
    updatedProperties: Record<string, any>,
    state: ReleaseLifecycleState = 'DRAFT'
  ): RevisionNode {
    const branches = this.branches.get(objectId) || [];
    const branch = branches.find(b => b.branchName === branchName);
    if (!branch) {
      throw new Error(`Branch '${branchName}' does not exist for object ${objectId}`);
    }

    const parentRev = this.revisions.get(branch.headRevisionId);
    const versionSeq = parentRev ? parentRev.versionSequence + 1 : 1;
    const contentHash = generateDeterministicHashSync(updatedProperties);
    const revisionId = this.computeRevisionId(objectId, branchName, versionSeq, contentHash);

    const revisionLabel = branchName === 'master' 
      ? `REV-${String.fromCharCode(65 + Math.floor((versionSeq - 1) / 5))}.${versionSeq}`
      : `REV-${branchName.substring(0, 8).toUpperCase()}.${versionSeq}`;

    const newRevision: RevisionNode = {
      revisionId,
      objectId,
      revisionLabel,
      versionSequence: versionSeq,
      branchName,
      parentRevisionId: branch.headRevisionId,
      state,
      author,
      timestamp: new Date().toISOString(),
      commitMessage,
      contentHash,
      dependencyHash: parentRev?.dependencyHash || 'DEP-INIT',
      isImmutable: state === 'RELEASED' || state === 'APPROVED',
      properties: { ...updatedProperties }
    };

    this.revisions.set(revisionId, newRevision);
    const revList = this.objectRevisions.get(objectId) || [];
    revList.push(revisionId);
    this.objectRevisions.set(objectId, revList);

    // Advance branch HEAD
    branch.headRevisionId = revisionId;
    return newRevision;
  }

  /**
   * Merges a source branch into a target branch (e.g. feat -> master).
   * Performs 3-way merge conflict detection.
   */
  public static mergeBranch(
    objectId: string,
    sourceBranchName: string,
    targetBranchName: string,
    author: string,
    commitMessage?: string
  ): MergeResult {
    const branches = this.branches.get(objectId) || [];
    const srcBranch = branches.find(b => b.branchName === sourceBranchName);
    const tgtBranch = branches.find(b => b.branchName === targetBranchName);

    if (!srcBranch || !tgtBranch) {
      throw new Error(`Branch '${sourceBranchName}' or '${targetBranchName}' not found`);
    }

    const srcHead = this.revisions.get(srcBranch.headRevisionId);
    const tgtHead = this.revisions.get(tgtBranch.headRevisionId);
    const baseRev = this.revisions.get(srcBranch.baseRevisionId);

    if (!srcHead || !tgtHead) {
      throw new Error('Branch HEADs could not be resolved');
    }

    // Fast-Forward Check: target head is same as source base
    if (tgtHead.revisionId === srcBranch.baseRevisionId) {
      tgtBranch.headRevisionId = srcHead.revisionId;
      return {
        success: true,
        mergedRevision: srcHead,
        hasConflicts: false,
        conflicts: [],
        mergeType: 'FAST_FORWARD'
      };
    }

    // 3-Way Merge & Conflict Detection
    const conflicts: MergeResult['conflicts'] = [];
    const mergedProps: Record<string, any> = { ...(tgtHead.properties || {}) };
    const baseProps = baseRev ? baseRev.properties || {} : {};
    const srcProps = srcHead.properties || {};

    const allKeys = Array.from(new Set([
      ...Object.keys(baseProps),
      ...Object.keys(srcProps),
      ...Object.keys(tgtHead.properties || {})
    ]));

    for (const key of allKeys) {
      const bVal = JSON.stringify(baseProps[key]);
      const sVal = JSON.stringify(srcProps[key]);
      const tVal = JSON.stringify(tgtHead.properties?.[key]);

      if (sVal !== bVal && tVal !== bVal && sVal !== tVal) {
        // Both branches changed the same property differently => CONFLICT
        conflicts.push({
          propertyKey: key,
          sourceBranchValue: srcProps[key],
          targetBranchValue: tgtHead.properties?.[key],
          baseValue: baseProps[key]
        });
      } else if (sVal !== bVal && tVal === bVal) {
        // Only source changed it => accept source
        mergedProps[key] = srcProps[key];
      }
    }

    if (conflicts.length > 0) {
      return {
        success: false,
        hasConflicts: true,
        conflicts,
        mergeType: 'ABORTED_CONFLICT'
      };
    }

    // Create merge revision node
    const versionSeq = tgtHead.versionSequence + 1;
    const contentHash = generateDeterministicHashSync(mergedProps);
    const revisionId = this.computeRevisionId(objectId, targetBranchName, versionSeq, contentHash);

    const mergedRev: RevisionNode = {
      revisionId,
      objectId,
      revisionLabel: `REV-MERGE-${versionSeq}`,
      versionSequence: versionSeq,
      branchName: targetBranchName,
      parentRevisionId: tgtHead.revisionId,
      secondaryParentId: srcHead.revisionId,
      state: 'DRAFT',
      author,
      timestamp: new Date().toISOString(),
      commitMessage: commitMessage || `Merge branch '${sourceBranchName}' into '${targetBranchName}'`,
      contentHash,
      dependencyHash: `${tgtHead.dependencyHash}+${srcHead.dependencyHash}`,
      isImmutable: false,
      properties: mergedProps
    };

    this.revisions.set(revisionId, mergedRev);
    const revList = this.objectRevisions.get(objectId) || [];
    revList.push(revisionId);
    this.objectRevisions.set(objectId, revList);

    tgtBranch.headRevisionId = revisionId;

    return {
      success: true,
      mergedRevision: mergedRev,
      hasConflicts: false,
      conflicts: [],
      mergeType: 'THREE_WAY'
    };
  }

  /**
   * Retrieves a revision by ID.
   */
  public static getRevision(revisionId: string): RevisionNode | undefined {
    return this.revisions.get(revisionId);
  }

  /**
   * Retrieves all revisions for an object.
   */
  public static getRevisionsForObject(objectId: string): RevisionNode[] {
    const revIds = this.objectRevisions.get(objectId) || [];
    return revIds.map(id => this.revisions.get(id)).filter(Boolean) as RevisionNode[];
  }

  /**
   * Retrieves all branches for an object.
   */
  public static getBranchesForObject(objectId: string): RevisionBranch[] {
    return this.branches.get(objectId) || [];
  }

  /**
   * Enforces that a published revision cannot be modified in-place.
   */
  public static updateRevisionState(revisionId: string, newState: ReleaseLifecycleState): RevisionNode {
    const rev = this.revisions.get(revisionId);
    if (!rev) throw new Error(`Revision ${revisionId} not found`);

    if (rev.isImmutable && newState === 'DRAFT') {
      throw new Error(`Cannot revert immutable revision ${revisionId} back to DRAFT. Create a new revision.`);
    }

    rev.state = newState;
    if (newState === 'RELEASED' || newState === 'APPROVED') {
      rev.isImmutable = true;
    }
    return rev;
  }
}
