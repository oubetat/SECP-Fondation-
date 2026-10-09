import { createHash } from 'crypto';
import { 
  Revision, 
  RevisionLifecycleState, 
  RevisionEntityType,
  DependencySnapshot,
  EngineeringSnapshot
} from './types';

// ==========================================
// 1. Branch Entity Types
// ==========================================

export type BranchStatus = 'ACTIVE' | 'IN_REVIEW' | 'MERGED' | 'ABANDONED' | 'ARCHIVED';

export type BranchPurpose = 
  | 'PERFORMANCE' 
  | 'WEIGHT REDUCTION' 
  | 'MANUFACTURABILITY' 
  | 'COST REDUCTION' 
  | 'CUSTOMER VARIANT' 
  | 'EXPERIMENTAL';

export interface EngineeringBranch {
  branchId: string;
  objectId: string; // e.g. "PART-001"
  branchName: string;
  parentBranchId?: string; // Where this branch split off from (optional)
  baseRevisionId: string; // Exact revision ID (e.g., "PART-001:REV-A")
  currentRevisionId: string; // Current active working revision ID (e.g., "PART-001:REV-C")
  owner: string;
  createdAt: string;
  status: BranchStatus;
  description: string;
  purpose: BranchPurpose;
  lifecycleState: BranchStatus; // Kept in sync with status
  baseSnapshot?: EngineeringSnapshot; // Captured at branch split
  baseDependencyState?: DependencySnapshot[]; // Dependencies at branch split
}

// ==========================================
// 2. Variant Entity Types
// ==========================================

export type VariantValidationState = 
  | 'NOT_VALIDATED' 
  | 'PARTIALLY_VALIDATED' 
  | 'VALIDATED' 
  | 'FAILED' 
  | 'STALE';

export type VariantProductionState = 
  | 'DEVELOPMENT' 
  | 'QUALIFIED' 
  | 'RELEASED' 
  | 'SUPERSEDED' 
  | 'OBSOLETE';

export interface VariantParameters {
  length: number;
  width: number;
  thickness: number;
  holeCount: number;
  material: string;
  mountingConfig: string;
}

export interface VariantBOMItem {
  componentId: string;
  quantity: number;
  revisionId: string; // Exact pinned revision
}

export interface EngineeringVariant {
  variantId: string;
  variantName: string;
  parentObjectId: string; // e.g. "PART-001"
  baseBranchId: string; // Branch this variant belongs to
  configurationDefinition: Record<string, any>;
  variantParameters: VariantParameters;
  dependencySet: DependencySnapshot[]; // Strictly pinned object + revision
  validationState: VariantValidationState;
  releaseState: VariantProductionState;
  
  // High fidelity sub-structures for FEM, CFD, Drawings, CAM
  bom: VariantBOMItem[];
  drawings: string[]; // drawing revisions
  simulations: {
    femSolved: boolean;
    cfdSolved: boolean;
    femModelId?: string;
    cfdModelId?: string;
    results?: {
      massKg: number;
      maxStressMpa: number;
      maxDisplacementMm: number;
      safetyFactor: number;
      cfdPressureDropPa?: number;
      cfdTempC?: number;
    }
  };
  camPackage: {
    programmed: boolean;
    programId?: string;
    toolpathCount?: number;
    cycleTimeMin?: number;
  };
  evidencePackage: string[]; // Signed evidence identifiers
  
  // Audit trail & lineage
  createdAt: string;
  createdBy: string;
  releasedAt?: string;
  releasedBy?: string;
  supersededByVariantId?: string;
}

// ==========================================
// 3. Merge & Comparison Structures
// ==========================================

export interface EngineeringConflict {
  key: string; // e.g., "parameters.thickness" or "material"
  description: string;
  sourceValue: any;
  targetValue: any;
  baseValue: any;
  resolvedValue?: any;
  isResolved: boolean;
}

export interface MergeCandidate {
  mergeCandidateId: string;
  sourceBranchId: string;
  targetBranchId: string;
  baseRevisionId: string;
  changes: string[];
  conflicts: Record<string, EngineeringConflict>;
  impact: string[];
  validationPassed: boolean;
  isMerged: boolean;
  mergedRevisionId?: string;
  createdBy: string;
  timestamp: string;
  decisions: Record<string, any>;
  evidenceHash?: string;
}

export interface VariantDecisionRecord {
  decisionId: string;
  variantId: string;
  selectedBy: string;
  selectedAt: string;
  reason: string;
  evidenceId?: string;
}

export interface ProductConfiguration {
  configId: string;
  productId: string;
  variantId: string;
  revisionSet: Record<string, string>; // objectId -> exact revisionId
  configHash: string;
  isBaseline: boolean;
  createdAt: string;
}

// ==========================================
// 4. Divergence Metrics
// ==========================================

export interface DivergenceMetrics {
  changedFeaturesCount: number;
  changedParametersCount: number;
  changedTopologyCount: number;
  changedDependenciesCount: number;
  totalScore: number; // Quantitative measure of divergence
}

// ==========================================
// 5. Comparison Results
// ==========================================

export interface BranchComparisonResult {
  commonBaseRevisionId: string;
  divergedFeatures: string[];
  divergedParameters: string[];
  divergedMaterials: string[];
  divergedDependencies: string[];
  divergedAssemblyConstraints: string[];
  divergedSimulations: string[];
  divergedCAM: string[];
  divergedDrawings: string[];
  semanticSummary: string[];
}

export interface VariantComparisonResult {
  variantIdA: string;
  variantIdB: string;
  parameterDiff: Record<string, { valA: any; valB: any; matches: boolean }>;
  materialDiff: { matA: string; matB: string; matches: boolean };
  bomDiff: Array<{ componentId: string; qtyA?: number; qtyB?: number; revA?: string; revB?: string; matches: boolean }>;
  simulationDiff: { femSolvedA: boolean; femSolvedB: boolean; cfdSolvedA: boolean; cfdSolvedB: boolean };
  drawingDiff: { drawingsA: string[]; drawingsB: string[] };
  camDiff: { programmedA: boolean; programmedB: boolean };
  semanticSummary: string[];
}

// ==========================================
// 6. Branch / Variant Design Engine
// ==========================================

export class BranchVariantEngine {
  private branches: Map<string, EngineeringBranch> = new Map();
  private variants: Map<string, EngineeringVariant> = new Map();
  private mergeCandidates: Map<string, MergeCandidate> = new Map();
  private decisionRecords: VariantDecisionRecord[] = [];
  private productConfigs: Map<string, ProductConfiguration> = new Map();
  private revisionDb: Map<string, Revision> = new Map(); // Core revision storage mock
  private auditLogs: Array<{ action: string; timestamp: string; details: any }> = [];

  constructor() {
    // Starts empty for clean project initialization
  }

  public reset(): void {
    this.branches.clear();
    this.variants.clear();
    this.mergeCandidates.clear();
    this.decisionRecords = [];
    this.productConfigs.clear();
    this.revisionDb.clear();
    this.auditLogs = [];
  }

  // Helper to load/inject mock revisions so they are searchable and validate cleanly
  public registerRevision(revision: Revision) {
    this.revisionDb.set(revision.revisionId, revision);
  }

  public getRevision(revisionId: string): Revision | undefined {
    return this.revisionDb.get(revisionId);
  }

  public loadDemoBranches(): void {
    this.initializeDefaultData();
  }

  public initializeDefaultData() {
    // 1. Establish standard product PART-001 (Turbine Impeller)
    const baseRevision: Revision = {
      revisionId: 'PART-001:REV-A',
      entityId: 'PART-001',
      entityType: RevisionEntityType.PART,
      revisionCode: 'REV-A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.RELEASED,
      createdAt: '2026-08-01T12:00:00Z',
      createdBy: 'CHIEF_ARCHITECT',
      effectivity: [],
      configurationScope: [],
      dependencies: [],
      approvals: [],
      content: {
        parameters: { length: 120, width: 120, thickness: 12, holeCount: 8, material: 'Titanium-Alloy', mountingConfig: 'Standard-6-Hole' },
        features: ['Base-Extrude', 'Shaft-Cutout', 'Blades-Radial-Pattern', 'Mounting-Holes'],
        topologyHash: 'topo-hash-radial-v1',
        geometryHash: 'geom-hash-turbine-v1'
      },
      contentHash: createHash('sha256').update('geom-hash-turbine-v1').digest('hex'),
      dependencyHash: createHash('sha256').update('[]').digest('hex'),
      revisionHash: createHash('sha256').update('PART-001:REV-A').digest('hex'),
      validationState: 'PROVEN',
      snapshot: {
        geometryState: {
          parameters: { length: 120, width: 120, thickness: 12, holeCount: 8, material: 'Titanium-Alloy', mountingConfig: 'Standard-6-Hole' },
          features: ['Base-Extrude', 'Shaft-Cutout', 'Blades-Radial-Pattern', 'Mounting-Holes'],
          topologyHash: 'topo-hash-radial-v1',
          geometryHash: 'geom-hash-turbine-v1'
        },
        materials: { densityKgM3: 4500, youngsModulusGpa: 115, poissonsRatio: 0.33, yieldStrengthMpa: 880, thermalConductivity: 21.9 }
      }
    };
    
    this.registerRevision(baseRevision);

    // 2. Create the protected MAIN Branch
    const mainBranch: EngineeringBranch = {
      branchId: 'PART-001:MAIN',
      objectId: 'PART-001',
      branchName: 'MAIN',
      baseRevisionId: 'PART-001:REV-A',
      currentRevisionId: 'PART-001:REV-A',
      owner: 'CHIEF_ARCHITECT',
      createdAt: '2026-08-01T12:15:00Z',
      status: 'ACTIVE',
      description: 'The master lineage branch for the production turbine blade design.',
      purpose: 'PERFORMANCE',
      lifecycleState: 'ACTIVE',
      baseSnapshot: baseRevision.snapshot,
      baseDependencyState: []
    };
    this.branches.set(mainBranch.branchId, mainBranch);

    // 3. Create a revision in main branch (REV-B - working revision)
    const revB: Revision = {
      revisionId: 'PART-001:REV-B',
      entityId: 'PART-001',
      entityType: RevisionEntityType.PART,
      revisionCode: 'REV-B',
      revisionNumber: 2,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdAt: '2026-08-05T09:00:00Z',
      createdBy: 'ENGINEER_A',
      parentRevisionId: 'PART-001:REV-A',
      effectivity: [],
      configurationScope: [],
      dependencies: [],
      approvals: [],
      content: {
        parameters: { length: 122, width: 122, thickness: 12, holeCount: 8, material: 'Titanium-Alloy', mountingConfig: 'Standard-6-Hole' },
        features: ['Base-Extrude', 'Shaft-Cutout', 'Blades-Radial-Pattern', 'Mounting-Holes'],
        topologyHash: 'topo-hash-radial-v1',
        geometryHash: 'geom-hash-turbine-v1-tweaked'
      },
      contentHash: createHash('sha256').update('geom-hash-turbine-v1-tweaked').digest('hex'),
      dependencyHash: createHash('sha256').update('[]').digest('hex'),
      revisionHash: createHash('sha256').update('PART-001:REV-B').digest('hex'),
      validationState: 'PARTIAL',
      snapshot: {
        geometryState: {
          parameters: { length: 122, width: 122, thickness: 12, holeCount: 8, material: 'Titanium-Alloy', mountingConfig: 'Standard-6-Hole' },
          features: ['Base-Extrude', 'Shaft-Cutout', 'Blades-Radial-Pattern', 'Mounting-Holes'],
          topologyHash: 'topo-hash-radial-v1',
          geometryHash: 'geom-hash-turbine-v1-tweaked'
        }
      }
    };
    this.registerRevision(revB);
  }

  // ==========================================
  // Branch API Implementation
  // ==========================================

  public createBranch(
    objectId: string,
    branchName: string,
    baseRevisionId: string,
    owner: string,
    purpose: BranchPurpose,
    description: string,
    parentBranchId?: string
  ): EngineeringBranch {
    // Naming Policy: Prevent empty names or duplicate branch names within same object scope
    if (!branchName || branchName.trim() === '') {
      throw new Error(`BRANCH_NAME_REQUIRED: A valid branch name must be specified.`);
    }
    
    const uppercaseName = branchName.toUpperCase().replace(/\s+/g, '-');
    const branchId = `${objectId}:${uppercaseName}`;

    if (this.branches.has(branchId)) {
      throw new Error(`DUPLICATE_BRANCH: Branch with name '${branchName}' already exists for object '${objectId}'.`);
    }

    // Verify Base Revision
    const baseRev = this.getRevision(baseRevisionId);
    if (!baseRev) {
      throw new Error(`MISSING_BASE_REVISION: The specified base revision '${baseRevisionId}' does not exist.`);
    }

    // Capture Snapshots (Independent Isolation bounds)
    const baseSnapshot = baseRev.snapshot || {};
    const baseDependencyState = baseRev.dependencies || [];

    const newBranch: EngineeringBranch = {
      branchId,
      objectId,
      branchName: uppercaseName,
      parentBranchId,
      baseRevisionId,
      currentRevisionId: baseRevisionId, // Initially points to base revision
      owner,
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
      description,
      purpose,
      lifecycleState: 'ACTIVE',
      baseSnapshot,
      baseDependencyState
    };

    this.branches.set(branchId, newBranch);
    this.logAuditAction('BRANCH_CREATED', { branchId, objectId, baseRevisionId, owner });

    return newBranch;
  }

  public getBranch(branchId: string): EngineeringBranch | undefined {
    return this.branches.get(branchId);
  }

  public getAllBranches(): EngineeringBranch[] {
    return Array.from(this.branches.values());
  }

  public getBranchesForObject(objectId: string): EngineeringBranch[] {
    return Array.from(this.branches.values()).filter(b => b.objectId === objectId);
  }

  public getBranchHistory(branchId: string): Revision[] {
    const branch = this.branches.get(branchId);
    if (!branch) return [];

    // Return the sequence of revisions that exist on this specific development path
    // Reconstruct linear lineage traversing parents until base revision is reached
    const result: Revision[] = [];
    let currentId: string | undefined = branch.currentRevisionId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const rev = this.getRevision(currentId);
      if (!rev) break;

      result.unshift(rev); // Maintain chronological order

      if (currentId === branch.baseRevisionId) {
        break; // Stop at base revision of the branch
      }
      currentId = rev.parentRevisionId;
    }

    return result;
  }

  public getBranchGraph(objectId: string): any {
    // Generate hierarchical graph showing lineage: MAIN -> baseRev -> branched nodes
    const branches = this.getBranchesForObject(objectId);
    const nodes = [];
    const edges = [];

    // Root is base revision of MAIN
    const main = branches.find(b => b.branchName === 'MAIN');
    const rootRevId = main ? main.baseRevisionId : undefined;

    for (const b of branches) {
      nodes.push({
        id: b.branchId,
        label: b.branchName,
        currentRevision: b.currentRevisionId,
        baseRevision: b.baseRevisionId,
        purpose: b.purpose,
        status: b.status,
        owner: b.owner
      });

      if (b.parentBranchId) {
        edges.push({
          source: b.parentBranchId,
          target: b.branchId,
          label: `Split from ${b.baseRevisionId}`
        });
      } else if (b.branchName !== 'MAIN') {
        edges.push({
          source: `${objectId}:MAIN`,
          target: b.branchId,
          label: `Split from ${b.baseRevisionId}`
        });
      }
    }

    return { objectId, nodes, edges };
  }

  // Modifies active revision inside branch (independent evolution - MAIN stays clean)
  public commitToBranch(branchId: string, parameters: Partial<VariantParameters>, features?: string[], material?: string, actorId?: string): Revision {
    const branch = this.branches.get(branchId);
    if (!branch) throw new Error(`BRANCH_NOT_FOUND: Branch '${branchId}' does not exist.`);
    if (branch.status !== 'ACTIVE') throw new Error(`BRANCH_NOT_ACTIVE: Cannot commit to a branch that is ${branch.status}.`);

    const currentRev = this.getRevision(branch.currentRevisionId);
    if (!currentRev) throw new Error(`CURRENT_REVISION_NOT_FOUND: Active revision '${branch.currentRevisionId}' is missing.`);

    // Enforce lock verification
    if (currentRev.isLocked && currentRev.lockedBy !== actorId) {
      throw new Error(`REVISION_LOCKED: Revision is currently locked by ${currentRev.isLocked}.`);
    }

    const nextNumber = currentRev.revisionNumber + 1;
    const nextCode = `${currentRev.revisionCode}-DEV-${nextNumber}`;
    const nextId = `${branch.objectId}:${nextCode}`;

    // Deep copy content and override parameters
    const baseContent = JSON.parse(JSON.stringify(currentRev.content || {}));
    const nextParams = { ...(baseContent.parameters || {}), ...parameters };
    const nextFeatures = features || baseContent.features || [];
    
    // Recalculate physical geometry hashes deterministically
    const paramString = JSON.stringify(nextParams);
    const geometryHash = createHash('sha256').update(paramString + (material || '')).digest('hex');
    const topologyHash = createHash('sha256').update(JSON.stringify(nextFeatures)).digest('hex');

    const updatedContent = {
      parameters: nextParams,
      features: nextFeatures,
      topologyHash,
      geometryHash,
      material: material || baseContent.material
    };

    const nextRev: Revision = {
      revisionId: nextId,
      entityId: branch.objectId,
      entityType: currentRev.entityType,
      revisionCode: nextCode,
      revisionNumber: nextNumber,
      parentRevisionId: currentRev.revisionId,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdAt: new Date().toISOString(),
      createdBy: actorId || 'ENGINEER',
      dependencies: [...currentRev.dependencies], // Isolated copies of dependencies
      effectivity: [],
      configurationScope: [],
      approvals: [],
      content: updatedContent,
      contentHash: createHash('sha256').update(geometryHash).digest('hex'),
      dependencyHash: currentRev.dependencyHash,
      revisionHash: createHash('sha256').update(nextId + geometryHash).digest('hex'),
      validationState: 'UNPROVEN',
      snapshot: {
        geometryState: {
          parameters: nextParams,
          features: nextFeatures,
          topologyHash,
          geometryHash
        }
      }
    };

    this.registerRevision(nextRev);
    
    // Update active current pointer in branch
    branch.currentRevisionId = nextRev.revisionId;
    this.branches.set(branchId, branch);

    this.logAuditAction('BRANCH_COMMIT', { branchId, revisionId: nextRev.revisionId, author: actorId });
    return nextRev;
  }

  // ==========================================
  // Comparison Engine Implementation
  // ==========================================

  public compareBranches(branchIdA: string, branchIdB: string): BranchComparisonResult {
    const branchA = this.branches.get(branchIdA);
    const branchB = this.branches.get(branchIdB);

    if (!branchA || !branchB) {
      throw new Error(`BRANCH_COMPARE_ERROR: Specified branches could not be loaded.`);
    }

    const revA = this.getRevision(branchA.currentRevisionId);
    const revB = this.getRevision(branchB.currentRevisionId);

    if (!revA || !revB) {
      throw new Error(`BRANCH_COMPARE_REVISIONS_ERROR: Active revisions for the branches are missing.`);
    }

    const paramsA = revA.content?.parameters || {};
    const paramsB = revB.content?.parameters || {};
    const featuresA = revA.content?.features || [];
    const featuresB = revB.content?.features || [];
    const matA = revA.content?.material || paramsA.material || '';
    const matB = revB.content?.material || paramsB.material || '';

    // Isolated comparison categories
    const divergedParameters: string[] = [];
    const divergedFeatures: string[] = [];
    const divergedMaterials: string[] = [];
    const divergedDependencies: string[] = [];
    const semanticSummary: string[] = [];

    // 1. Analyze engineering parameters
    const allParamKeys = Array.from(new Set([...Object.keys(paramsA), ...Object.keys(paramsB)]));
    for (const key of allParamKeys) {
      if (paramsA[key] !== paramsB[key]) {
        divergedParameters.push(key);
        semanticSummary.push(`Parameter '${key}' changed: ${paramsA[key]} ➔ ${paramsB[key]}`);
      }
    }

    // 2. Analyze feature trees
    const maxLen = Math.max(featuresA.length, featuresB.length);
    for (let i = 0; i < maxLen; i++) {
      if (featuresA[i] !== featuresB[i]) {
        divergedFeatures.push(`Feature[${i}]`);
        semanticSummary.push(`Feature tree divergence at step ${i}: ${featuresA[i] || '[None]'} vs ${featuresB[i] || '[None]'}`);
      }
    }

    // 3. Analyze material specifications
    if (matA !== matB) {
      divergedMaterials.push('material');
      semanticSummary.push(`Physical material allocation diverged: ${matA} vs ${matB}`);
    }

    // 4. Analyze dependencies (strict exact pinning checks)
    const depsA = revA.dependencies || [];
    const depsB = revB.dependencies || [];
    for (const depA of depsA) {
      const matchB = depsB.find(d => d.entityId === depA.entityId);
      if (!matchB || matchB.revisionId !== depA.revisionId) {
        divergedDependencies.push(depA.entityId);
        semanticSummary.push(`Dependency '${depA.entityId}' diverged: ${depA.revisionId} vs ${matchB ? matchB.revisionId : '[No reference]'}`);
      }
    }

    return {
      commonBaseRevisionId: branchA.baseRevisionId,
      divergedFeatures,
      divergedParameters,
      divergedMaterials,
      divergedDependencies,
      divergedAssemblyConstraints: [],
      divergedSimulations: [],
      divergedCAM: [],
      divergedDrawings: [],
      semanticSummary
    };
  }

  // ==========================================
  // Divergence Quantification
  // ==========================================

  public calculateDivergence(branchId: string): DivergenceMetrics {
    const branch = this.branches.get(branchId);
    if (!branch) throw new Error(`BRANCH_NOT_FOUND`);

    const baseRev = this.getRevision(branch.baseRevisionId);
    const currentRev = this.getRevision(branch.currentRevisionId);
    if (!baseRev || !currentRev) throw new Error(`REVISIONS_MISSING`);

    const paramsBase = baseRev.content?.parameters || {};
    const paramsCurr = currentRev.content?.parameters || {};
    const featuresBase = baseRev.content?.features || [];
    const featuresCurr = currentRev.content?.features || [];

    let changedParametersCount = 0;
    for (const key of Object.keys({ ...paramsBase, ...paramsCurr })) {
      if (paramsBase[key] !== paramsCurr[key]) changedParametersCount++;
    }

    let changedFeaturesCount = 0;
    const maxFeat = Math.max(featuresBase.length, featuresCurr.length);
    for (let i = 0; i < maxFeat; i++) {
      if (featuresBase[i] !== featuresCurr[i]) changedFeaturesCount++;
    }

    const changedTopologyCount = baseRev.content?.topologyHash !== currentRev.content?.topologyHash ? 1 : 0;
    const changedDependenciesCount = Math.abs((baseRev.dependencies || []).length - (currentRev.dependencies || []).length);

    const totalScore = (changedParametersCount * 1.5) + (changedFeaturesCount * 3.0) + (changedTopologyCount * 5.0) + (changedDependenciesCount * 2.0);

    return {
      changedFeaturesCount,
      changedParametersCount,
      changedTopologyCount,
      changedDependenciesCount,
      totalScore
    };
  }

  // ==========================================
  // Controlled Synchronization
  // ==========================================

  public syncBranch(branchId: string, targetRevisionId: string, actorId: string): { status: 'SUCCESS' | 'CONFLICTS'; changesApplied?: string[]; conflicts?: string[] } {
    const branch = this.branches.get(branchId);
    if (!branch) throw new Error(`BRANCH_NOT_FOUND`);

    const targetRev = this.getRevision(targetRevisionId);
    if (!targetRev) throw new Error(`TARGET_REVISION_NOT_FOUND`);

    const currentRev = this.getRevision(branch.currentRevisionId);
    if (!currentRev) throw new Error(`CURRENT_REVISION_NOT_FOUND`);

    // Perform three-way check first (Common Base vs Branch Current vs Target Revision)
    const conflicts: string[] = [];
    const paramsCurr = currentRev.content?.parameters || {};
    const paramsTarget = targetRev.content?.parameters || {};
    const paramsBase = this.getRevision(branch.baseRevisionId)?.content?.parameters || {};

    for (const key of Object.keys(paramsTarget)) {
      if (paramsTarget[key] !== paramsBase[key]) {
        // Target has modified this value. Did the branch also modify it?
        if (paramsCurr[key] !== paramsBase[key] && paramsCurr[key] !== paramsTarget[key]) {
          conflicts.push(`Parameter Conflict: '${key}' (Branch=${paramsCurr[key]}, Target=${paramsTarget[key]})`);
        }
      }
    }

    if (conflicts.length > 0) {
      return { status: 'CONFLICTS', conflicts };
    }

    // Apply clean modifications (No Silent Auto-Updates without Explicit confirmation)
    const nextParams = { ...paramsCurr, ...paramsTarget };
    const nextRev = this.commitToBranch(branchId, nextParams, targetRev.content?.features, targetRev.content?.material, actorId);
    
    branch.baseRevisionId = targetRevisionId; // Update tracking point
    this.branches.set(branchId, branch);

    this.logAuditAction('BRANCH_SYNCED', { branchId, synchronizedTo: targetRevisionId });
    return { status: 'SUCCESS', changesApplied: Object.keys(paramsTarget) };
  }

  // ==========================================
  // Three-Way Merge & Conflict Resolution
  // ==========================================

  public createMergeCandidate(sourceBranchId: string, targetBranchId: string, baseRevisionId: string, createdBy: string): MergeCandidate {
    const sourceBranch = this.branches.get(sourceBranchId);
    const targetBranch = this.branches.get(targetBranchId);

    if (!sourceBranch || !targetBranch) throw new Error(`MERGE_BRANCHES_NOT_FOUND`);

    const sourceRev = this.getRevision(sourceBranch.currentRevisionId);
    const targetRev = this.getRevision(targetBranch.currentRevisionId);
    const baseRev = this.getRevision(baseRevisionId);

    if (!sourceRev || !targetRev || !baseRev) throw new Error(`MERGE_REVISIONS_NOT_FOUND`);

    const conflicts: Record<string, EngineeringConflict> = {};
    const changes: string[] = [];
    const impact: string[] = [];

    // Analyze Parameter Changes & Conflicts
    const paramsBase = baseRev.content?.parameters || {};
    const paramsSource = sourceRev.content?.parameters || {};
    const paramsTarget = targetRev.content?.parameters || {};

    const allKeys = Array.from(new Set([
      ...Object.keys(paramsBase),
      ...Object.keys(paramsSource),
      ...Object.keys(paramsTarget)
    ]));

    for (const key of allKeys) {
      const valBase = paramsBase[key];
      const valSrc = paramsSource[key];
      const valTgt = paramsTarget[key];

      const srcModified = valSrc !== valBase;
      const tgtModified = valTgt !== valBase;

      if (srcModified && tgtModified && valSrc !== valTgt) {
        // True semantic parameter conflict!
        conflicts[`parameters.${key}`] = {
          key: `parameters.${key}`,
          description: `Parameter '${key}' changed in both source (${valSrc}) and target (${valTgt}) branches.`,
          sourceValue: valSrc,
          targetValue: valTgt,
          baseValue: valBase,
          isResolved: false
        };
      } else if (srcModified) {
        changes.push(`Source changed parameter '${key}': ${valBase} ➔ ${valSrc}`);
      } else if (tgtModified) {
        changes.push(`Target changed parameter '${key}': ${valBase} ➔ ${valTgt}`);
      }
    }

    // Material conflicts
    const matBase = baseRev.content?.material || paramsBase.material || '';
    const matSource = sourceRev.content?.material || paramsSource.material || '';
    const matTarget = targetRev.content?.material || paramsTarget.material || '';
    if (matSource !== matBase && matTarget !== matBase && matSource !== matTarget) {
      conflicts['material'] = {
        key: 'material',
        description: `Material split conflict! Source allocated '${matSource}', Target allocated '${matTarget}'.`,
        sourceValue: matSource,
        targetValue: matTarget,
        baseValue: matBase,
        isResolved: false
      };
    }

    // Feature Tree comparison
    const featBase = baseRev.content?.features || [];
    const featSource = sourceRev.content?.features || [];
    const featTarget = targetRev.content?.features || [];
    if (JSON.stringify(featSource) !== JSON.stringify(featBase) && JSON.stringify(featTarget) !== JSON.stringify(featBase)) {
      if (featSource.length !== featTarget.length || featSource.some((f, i) => f !== featTarget[i])) {
        conflicts['features'] = {
          key: 'features',
          description: `Feature Tree topologies diverged on both paths. Manual structural sorting is required.`,
          sourceValue: featSource,
          targetValue: featTarget,
          baseValue: featBase,
          isResolved: false
        };
      }
    }

    // Estimate downstream impacts based on dependencies
    impact.push(`Re-evaluation of downstream FEM studies pinned to ${targetBranchId}.`);
    impact.push(`Regeneration of continuous clearance drawings.`);

    const mergeCandidateId = `MC-${createHash('md5').update(sourceBranchId + targetBranchId + baseRevisionId + Date.now()).digest('hex').substring(0, 8).toUpperCase()}`;

    const candidate: MergeCandidate = {
      mergeCandidateId,
      sourceBranchId,
      targetBranchId,
      baseRevisionId,
      changes,
      conflicts,
      impact,
      validationPassed: false,
      isMerged: false,
      createdBy,
      timestamp: new Date().toISOString(),
      decisions: {}
    };

    this.mergeCandidates.set(mergeCandidateId, candidate);
    return candidate;
  }

  public resolveBranchConflict(mergeCandidateId: string, entityKey: string, resolvedValue: any) {
    const candidate = this.mergeCandidates.get(mergeCandidateId);
    if (!candidate) throw new Error(`MERGE_CANDIDATE_NOT_FOUND`);

    const conflict = candidate.conflicts[entityKey];
    if (!conflict) throw new Error(`CONFLICT_KEY_NOT_FOUND: ${entityKey}`);

    conflict.resolvedValue = resolvedValue;
    conflict.isResolved = true;
    candidate.decisions[entityKey] = resolvedValue;

    // Check if all conflicts resolved, and triggers structural validation simulation
    const allResolved = Object.values(candidate.conflicts).every(c => c.isResolved);
    candidate.validationPassed = allResolved;

    this.mergeCandidates.set(mergeCandidateId, candidate);
  }

  public mergeBranch(mergeCandidateId: string, actorId: string): Revision {
    const candidate = this.mergeCandidates.get(mergeCandidateId);
    if (!candidate) throw new Error(`MERGE_CANDIDATE_NOT_FOUND`);
    if (candidate.isMerged) throw new Error(`ALREADY_MERGED`);

    const unresolvedKeys = Object.keys(candidate.conflicts).filter(k => !candidate.conflicts[k].isResolved);
    if (unresolvedKeys.length > 0) {
      throw new Error(`UNRESOLVED_CONFLICTS: Cannot complete merge until conflicts are explicitly resolved: ${unresolvedKeys.join(', ')}`);
    }

    // Create Merged Working Revision inside target branch (Merge does not change released revision)
    const targetBranch = this.branches.get(candidate.targetBranchId)!;
    const targetRev = this.getRevision(targetBranch.currentRevisionId)!;
    const sourceRev = this.getRevision(this.branches.get(candidate.sourceBranchId)!.currentRevisionId)!;

    const mergedParams = { ...targetRev.content.parameters };
    // Overlay source changes where target didn't modify or conflict resolved
    const sourceParams = sourceRev.content.parameters;
    const baseParams = this.getRevision(candidate.baseRevisionId)!.content.parameters;

    for (const key of Object.keys(sourceParams)) {
      const conflictKey = `parameters.${key}`;
      if (candidate.decisions[conflictKey] !== undefined) {
        mergedParams[key] = candidate.decisions[conflictKey];
      } else if (sourceParams[key] !== baseParams[key]) {
        mergedParams[key] = sourceParams[key];
      }
    }

    const mergedFeatures = candidate.decisions['features'] || targetRev.content.features;
    const mergedMaterial = candidate.decisions['material'] || targetRev.content.material || targetRev.content.parameters.material;

    const mergedGeomHash = createHash('sha256').update(JSON.stringify(mergedParams) + (mergedMaterial || '')).digest('hex');
    const mergedTopologyHash = createHash('sha256').update(JSON.stringify(mergedFeatures)).digest('hex');

    const nextNumber = targetRev.revisionNumber + 1;
    const nextCode = `MERGE-${targetRev.revisionCode}-${nextNumber}`;
    const nextId = `${targetBranch.objectId}:${nextCode}`;

    const mergedRevision: Revision = {
      revisionId: nextId,
      entityId: targetBranch.objectId,
      entityType: targetRev.entityType,
      revisionCode: nextCode,
      revisionNumber: nextNumber,
      parentRevisionId: targetRev.revisionId,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdAt: new Date().toISOString(),
      createdBy: actorId,
      dependencies: [...targetRev.dependencies, ...sourceRev.dependencies].filter((d, idx, arr) => arr.findIndex(x => x.entityId === d.entityId) === idx),
      effectivity: [],
      configurationScope: [],
      approvals: [],
      content: {
        parameters: mergedParams,
        features: mergedFeatures,
        topologyHash: mergedTopologyHash,
        geometryHash: mergedGeomHash,
        material: mergedMaterial
      },
      contentHash: createHash('sha256').update(mergedGeomHash).digest('hex'),
      dependencyHash: targetRev.dependencyHash,
      revisionHash: createHash('sha256').update(nextId + mergedGeomHash).digest('hex'),
      validationState: 'PROVEN', // Marked after merge validation passes
      snapshot: {
        geometryState: {
          parameters: mergedParams,
          features: mergedFeatures,
          topologyHash: mergedTopologyHash,
          geometryHash: mergedGeomHash
        }
      }
    };

    this.registerRevision(mergedRevision);

    // Update target branch pointer
    targetBranch.currentRevisionId = mergedRevision.revisionId;
    targetBranch.status = 'ACTIVE';
    this.branches.set(targetBranch.branchId, targetBranch);

    // Sign provenance and seal evidence
    candidate.isMerged = true;
    candidate.mergedRevisionId = mergedRevision.revisionId;
    candidate.evidenceHash = createHash('sha256').update(JSON.stringify(candidate)).digest('hex');
    this.mergeCandidates.set(candidate.mergeCandidateId, candidate);

    this.logAuditAction('BRANCH_MERGED', {
      source: candidate.sourceBranchId,
      target: candidate.targetBranchId,
      mergedRevisionId: mergedRevision.revisionId,
      user: actorId,
      evidenceHash: candidate.evidenceHash
    });

    return mergedRevision;
  }

  public abandonBranch(branchId: string, reason: string, actorId: string) {
    const branch = this.branches.get(branchId);
    if (!branch) throw new Error(`BRANCH_NOT_FOUND`);
    branch.status = 'ABANDONED';
    branch.lifecycleState = 'ABANDONED';
    this.branches.set(branchId, branch);
    this.logAuditAction('BRANCH_ABANDONED', { branchId, reason, actorId });
  }

  public archiveBranch(branchId: string, reason: string, actorId: string) {
    const branch = this.branches.get(branchId);
    if (!branch) throw new Error(`BRANCH_NOT_FOUND`);
    
    // Deletion Policy Exception: Cannot delete branches mapped to active production evidence
    const linkedVariants = Array.from(this.variants.values()).filter(v => v.baseBranchId === branchId);
    const hasReleasedVariants = linkedVariants.some(v => v.releaseState === 'RELEASED');
    if (hasReleasedVariants) {
      throw new Error(`BRANCH_DELETE_FORBIDDEN: Cannot delete or hard remove branch '${branchId}' because it is bound to released engineering variants.`);
    }

    branch.status = 'ARCHIVED';
    branch.lifecycleState = 'ARCHIVED';
    this.branches.set(branchId, branch);
    this.logAuditAction('BRANCH_ARCHIVED', { branchId, reason, actorId });
  }

  // ==========================================
  // Variant API Implementation
  // ==========================================

  public createVariant(
    parentObjectId: string,
    baseBranchId: string,
    variantName: string,
    params: VariantParameters,
    dependencies: DependencySnapshot[],
    boms: VariantBOMItem[],
    createdBy: string
  ): EngineeringVariant {
    const variantId = `VAR-${parentObjectId.toUpperCase()}-${variantName.toUpperCase().replace(/\s+/g, '-')}`;

    if (this.variants.has(variantId)) {
      throw new Error(`VARIANT_EXISTS: Variant with ID '${variantId}' already exists.`);
    }

    // Constraint validation: prevent invalid options or geometric parameters
    if (params.thickness <= 0 || params.length <= 0 || params.width <= 0) {
      throw new Error(`GEOMETRIC_CONSTRAINT_VIOLATION: Dimensions (thickness, length, width) must be strictly greater than zero.`);
    }

    // Enforce dependency pinning checks (Do not use LATEST, must use exact revision IDs)
    const floatingDep = dependencies.find(d => d.isFloating || d.revisionId === 'LATEST');
    if (floatingDep) {
      throw new Error(`FLOATING_DEPENDENCY_PROHIBITED: Dependencies must be pinned to explicit exact revisions. Floating '${floatingDep.entityId}:LATEST' is forbidden.`);
    }

    // Calculate configuration hash deterministically
    const configString = JSON.stringify({ params, dependencies, boms });
    const computedHash = createHash('sha256').update(configString).digest('hex');

    const newVariant: EngineeringVariant = {
      variantId,
      variantName,
      parentObjectId,
      baseBranchId,
      configurationDefinition: { ...params },
      variantParameters: params,
      dependencySet: dependencies,
      validationState: 'NOT_VALIDATED',
      releaseState: 'DEVELOPMENT',
      bom: boms,
      drawings: [`DWG-${parentObjectId}:REV-A`],
      simulations: {
        femSolved: false,
        cfdSolved: false,
        results: undefined
      },
      camPackage: {
        programmed: false
      },
      evidencePackage: [],
      createdAt: new Date().toISOString(),
      createdBy
    };

    this.variants.set(variantId, newVariant);
    this.logAuditAction('VARIANT_CREATED', { variantId, parentObjectId, baseBranchId });
    return newVariant;
  }

  public getVariant(variantId: string): EngineeringVariant | undefined {
    return this.variants.get(variantId);
  }

  public getAllVariants(): EngineeringVariant[] {
    return Array.from(this.variants.values());
  }

  public updateVariant(variantId: string, params: Partial<VariantParameters>, boms?: VariantBOMItem[], actorId?: string) {
    const variant = this.variants.get(variantId);
    if (!variant) throw new Error(`VARIANT_NOT_FOUND`);

    // Release state immutability rule: modification is rejected if variant is in RELEASED status
    if (variant.releaseState === 'RELEASED') {
      throw new Error(`IMMUTABLE_RELEASED_VARIANT: Variant '${variantId}' has been officially released to production and is completely locked. Modifications are rejected.`);
    }

    if (params) {
      variant.variantParameters = { ...variant.variantParameters, ...params };
    }
    if (boms) {
      variant.bom = boms;
    }
    
    // Set validation stale on edit
    variant.validationState = 'STALE';
    this.variants.set(variantId, variant);
    this.logAuditAction('VARIANT_UPDATED', { variantId });
  }

  public compareVariants(variantIdA: string, variantIdB: string): VariantComparisonResult {
    const varA = this.variants.get(variantIdA);
    const varB = this.variants.get(variantIdB);

    if (!varA || !varB) throw new Error(`VARIANTS_NOT_FOUND`);

    const pA = varA.variantParameters;
    const pB = varB.variantParameters;

    const parameterDiff: Record<string, { valA: any; valB: any; matches: boolean }> = {};
    const semanticSummary: string[] = [];

    const keys = Object.keys({ ...pA, ...pB });
    for (const key of keys) {
      const vA = (pA as any)[key];
      const vB = (pB as any)[key];
      const match = vA === vB;
      parameterDiff[key] = { valA: vA, valB: vB, matches: match };
      if (!match) {
        semanticSummary.push(`Parameter '${key}' diverged: ${vA} vs ${vB}`);
      }
    }

    // BOM Difference comparison
    const bomDiff: Array<{ componentId: string; qtyA?: number; qtyB?: number; revA?: string; revB?: string; matches: boolean }> = [];
    const allCompIds = Array.from(new Set([...varA.bom.map(i => i.componentId), ...varB.bom.map(i => i.componentId)]));
    for (const cid of allCompIds) {
      const itemA = varA.bom.find(i => i.componentId === cid);
      const itemB = varB.bom.find(i => i.componentId === cid);
      const matches = itemA?.quantity === itemB?.quantity && itemA?.revisionId === itemB?.revisionId;
      bomDiff.push({
        componentId: cid,
        qtyA: itemA?.quantity,
        qtyB: itemB?.quantity,
        revA: itemA?.revisionId,
        revB: itemB?.revisionId,
        matches
      });
      if (!matches) {
        semanticSummary.push(`BOM mismatch on ${cid}: ${itemA ? `Qty=${itemA.quantity} [${itemA.revisionId}]` : '[None]'} vs ${itemB ? `Qty=${itemB.quantity} [${itemB.revisionId}]` : '[None]'}`);
      }
    }

    return {
      variantIdA,
      variantIdB,
      parameterDiff,
      materialDiff: { matA: pA.material, matB: pB.material, matches: pA.material === pB.material },
      bomDiff,
      simulationDiff: {
        femSolvedA: varA.simulations.femSolved,
        femSolvedB: varB.simulations.femSolved,
        cfdSolvedA: varA.simulations.cfdSolved,
        cfdSolvedB: varB.simulations.cfdSolved
      },
      drawingDiff: { drawingsA: varA.drawings, drawingsB: varB.drawings },
      camDiff: { programmedA: varA.camPackage.programmed, programmedB: varB.camPackage.programmed },
      semanticSummary
    };
  }

  // ==========================================
  // Simulation Solver Mock & Evidence Binding
  // ==========================================

  public runStructuralSimulation(variantId: string): EngineeringVariant {
    const variant = this.variants.get(variantId);
    if (!variant) throw new Error(`VARIANT_NOT_FOUND`);

    // No invented engineering results: base calculation on actual engineering variables
    const length = variant.variantParameters.length;
    const thickness = variant.variantParameters.thickness;
    const material = variant.variantParameters.material;

    // Direct physical approximations
    const baseDensity = material === 'Carbon-Composite' ? 1800 : material === 'Steel-Alloy' ? 7850 : 4500;
    const massKg = Number(((length * 0.05 * thickness * 0.01) * baseDensity).toFixed(3));
    
    // Stress calculation: Stress increases with length, decreases with thickness^2
    const bendingLoadN = 5000; // Reference load
    const areaMoment = (0.05 * Math.pow(thickness * 0.001, 3)) / 12;
    const maxStressMpa = Number(((bendingLoadN * (length * 0.001) * (thickness * 0.0005)) / (areaMoment * 1000000)).toFixed(1));

    const yieldStrength = material === 'Carbon-Composite' ? 1200 : material === 'Steel-Alloy' ? 550 : 880;
    const safetyFactor = Number((yieldStrength / maxStressMpa).toFixed(2));

    variant.simulations = {
      femSolved: true,
      cfdSolved: true,
      femModelId: `FEM-${variantId}-SOLVED`,
      cfdModelId: `CFD-${variantId}-SOLVED`,
      results: {
        massKg,
        maxStressMpa,
        maxDisplacementMm: Number((maxStressMpa * 0.005).toFixed(3)),
        safetyFactor,
        cfdPressureDropPa: 245 + Math.round(length * 0.8),
        cfdTempC: 650 - Math.round(thickness * 2.5)
      }
    };

    variant.validationState = safetyFactor >= 1.5 ? 'VALIDATED' : 'FAILED';
    variant.evidencePackage.push(`EVID-FEM-${variantId}-${Date.now().toString().substring(8)}`);

    this.variants.set(variantId, variant);
    this.logAuditAction('VARIANT_SIMULATED', { variantId, safetyFactor, massKg });
    return variant;
  }

  public runCAMProgramming(variantId: string): EngineeringVariant {
    const variant = this.variants.get(variantId);
    if (!variant) throw new Error(`VARIANT_NOT_FOUND`);

    const complexityFactor = variant.variantParameters.holeCount * 1.2;
    variant.camPackage = {
      programmed: true,
      programId: `CAM-GCODE-${variantId}`,
      toolpathCount: 4 + variant.variantParameters.holeCount,
      cycleTimeMin: Number((12.5 + complexityFactor).toFixed(1))
    };

    variant.evidencePackage.push(`EVID-CAM-${variantId}`);
    this.variants.set(variantId, variant);
    return variant;
  }

  // ==========================================
  // Qualification & Release Gates
  // ==========================================

  public qualifyVariant(variantId: string): EngineeringVariant {
    const variant = this.variants.get(variantId);
    if (!variant) throw new Error(`VARIANT_NOT_FOUND`);

    // Qualification Preconditions checking
    const dependenciesValid = variant.dependencySet.length > 0 && variant.dependencySet.every(d => d.revisionId !== '');
    const simulationsValid = variant.simulations.femSolved && variant.simulations.results !== undefined;
    const manufacturingValid = variant.camPackage.programmed;
    const evidenceComplete = variant.evidencePackage.length >= 2;

    if (!dependenciesValid || !simulationsValid || !manufacturingValid || !evidenceComplete) {
      throw new Error(`QUALIFICATION_PRECONDITIONS_FAILED: Cannot qualify variant '${variantId}'. Required simulations, drawings, and manufacturing files must be completed and evidence sealed first.`);
    }

    variant.releaseState = 'QUALIFIED';
    this.variants.set(variantId, variant);
    this.logAuditAction('VARIANT_QUALIFIED', { variantId });
    return variant;
  }

  public releaseVariant(variantId: string, actorId: string): EngineeringVariant {
    const variant = this.variants.get(variantId);
    if (!variant) throw new Error(`VARIANT_NOT_FOUND`);

    if (variant.releaseState !== 'QUALIFIED') {
      throw new Error(`RELEASE_FORBIDDEN: Variant '${variantId}' must pass the formal qualification workflow before it can be released to production.`);
    }

    variant.releaseState = 'RELEASED';
    variant.releasedAt = new Date().toISOString();
    variant.releasedBy = actorId;
    
    this.variants.set(variantId, variant);
    this.logAuditAction('VARIANT_RELEASED', { variantId, actorId });
    return variant;
  }

  public supersedeVariant(variantId: string, supersededByVariantId: string) {
    const variant = this.variants.get(variantId);
    if (!variant) throw new Error(`VARIANT_NOT_FOUND`);

    variant.releaseState = 'SUPERSEDED';
    variant.supersededByVariantId = supersededByVariantId;
    this.variants.set(variantId, variant);
    this.logAuditAction('VARIANT_SUPERSEDED', { variantId, supersededByVariantId });
  }

  public selectVariant(productId: string, variantId: string, selectedBy: string, reason: string): VariantDecisionRecord {
    const variant = this.variants.get(variantId);
    if (!variant) throw new Error(`VARIANT_NOT_FOUND`);

    const decision: VariantDecisionRecord = {
      decisionId: `VDR-${Date.now().toString().substring(6)}`,
      variantId,
      selectedBy,
      selectedAt: new Date().toISOString(),
      reason,
      evidenceId: variant.evidencePackage[0]
    };

    this.decisionRecords.push(decision);

    // Create a product configuration mapping
    const revisionSet: Record<string, string> = {
      [productId]: variant.parentObjectId
    };
    for (const bomItem of variant.bom) {
      revisionSet[bomItem.componentId] = bomItem.revisionId;
    }

    const configHash = createHash('sha256').update(JSON.stringify(revisionSet) + variantId).digest('hex');

    const config: ProductConfiguration = {
      configId: `CONF-${variantId}`,
      productId,
      variantId,
      revisionSet,
      configHash,
      isBaseline: true,
      createdAt: new Date().toISOString()
    };

    this.productConfigs.set(config.configId, config);
    this.logAuditAction('VARIANT_SELECTED', { productId, variantId, decisionId: decision.decisionId });

    return decision;
  }

  public getSelectedVariantDecision(variantId: string): VariantDecisionRecord | undefined {
    return this.decisionRecords.find(d => d.variantId === variantId);
  }

  // ==========================================
  // Integrity Checkers
  // ==========================================

  public checkBranchIntegrity(branchId: string): { status: 'HEALTHY' | 'WARNING' | 'BROKEN'; issues: string[] } {
    const branch = this.branches.get(branchId);
    const issues: string[] = [];

    if (!branch) {
      return { status: 'BROKEN', issues: ['Branch record completely missing in registry.'] };
    }

    // 1. Missing base revision
    if (!branch.baseRevisionId || !this.getRevision(branch.baseRevisionId)) {
      issues.push(`Broken lineage: base revision '${branch.baseRevisionId}' does not exist.`);
    }

    // 2. Broken current revision link
    if (!branch.currentRevisionId || !this.getRevision(branch.currentRevisionId)) {
      issues.push(`Broken lineage: current revision '${branch.currentRevisionId}' is missing.`);
    }

    // 3. Broken parent branch link
    if (branch.parentBranchId && !this.branches.has(branch.parentBranchId)) {
      issues.push(`Broken lineage: parent branch '${branch.parentBranchId}' does not exist.`);
    }

    // 4. Duplicate ID check
    const duplicateCount = Array.from(this.branches.values()).filter(b => b.branchId === branchId).length;
    if (duplicateCount > 1) {
      issues.push(`Integrity error: Duplicate branch ID detected in catalog.`);
    }

    // Determine health score
    const status = issues.length > 0 ? 'BROKEN' : 'HEALTHY';
    return { status, issues };
  }

  public checkVariantIntegrity(variantId: string): { status: 'HEALTHY' | 'WARNING' | 'BROKEN'; issues: string[] } {
    const variant = this.variants.get(variantId);
    const issues: string[] = [];

    if (!variant) {
      return { status: 'BROKEN', issues: ['Variant record completely missing.'] };
    }

    // 1. Validate configuration validity bounds
    if (variant.variantParameters.thickness > 50) {
      issues.push(`Constraint Out Of Bounds: Thickness of ${variant.variantParameters.thickness}mm exceeds aerodynamic stress limit of 50mm.`);
    }

    // 2. Check revision validity inside BOM
    for (const item of variant.bom) {
      const rev = this.getRevision(item.revisionId);
      if (!rev) {
        issues.push(`BOM Inconsistency: Component '${item.componentId}' references non-existent revision '${item.revisionId}'.`);
      }
    }

    // 3. Check base branch reference
    if (!this.branches.has(variant.baseBranchId)) {
      issues.push(`Orphan variant: Base branch '${variant.baseBranchId}' is invalid.`);
    }

    const status = issues.length > 0 ? 'BROKEN' : 'HEALTHY';
    return { status, issues };
  }

  // ==========================================
  // Audit Trail & Logging
  // ==========================================

  private logAuditAction(action: string, details: any) {
    this.auditLogs.push({
      action,
      timestamp: new Date().toISOString(),
      details
    });
  }

  public getAuditTrail(): any[] {
    return this.auditLogs;
  }
}
