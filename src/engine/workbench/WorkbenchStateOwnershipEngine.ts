/**
 * SECP Engineering Kernel — Workbench State Ownership & Invalidation Architecture
 *
 * ARCHITECTURAL CONTRACT:
 * Classifies all state across the Engineering OS into precise ownership categories:
 * 
 * State                      | Classification
 * ---------------------------|----------------------------------
 * EngineeringDocument        | Canonical SOT
 * evaluated B-Rep            | Derived
 * render mesh                | Derived
 * selection                  | Derived/UI state
 * feature tree projection    | Derived
 * PatternEngine session      | Session
 * DirectModeling transaction  | Session
 * FeatureRecognitionSession  | Session
 * Reconstruction session      | Session
 * UI panel state             | UI
 * legacy FeatureTreeManager  | Legacy
 *
 * MUTATION DECISION TREE:
 * State Mutation
 *    ↓
 * Modifies EngineeringDocument?
 *    ├─ YES → CANONICAL_MUTATION (Valid SOT change; bumps revision, triggers invalidation of derived caches)
 *    └─ NO
 *        ↓
 *        Is Derived?
 *           ├─ YES → DERIVED_UPDATE (Acceptable; recomputed on SOT invalidation)
 *           └─ NO
 *               ↓
 *               Is Session/Staging?
 *                  ├─ YES → SESSION_MUTATION (Acceptable if non-canonical; can commit to SOT)
 *                  └─ NO
 *                      ↓
 *                      Is UI State?
 *                         ├─ YES → UI_STATE_UPDATE (Acceptable UI panel state)
 *                         └─ NO  → ARCHITECTURAL_GAP (Flagged & safely guarded/reconciled)
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { FeatureTreeManager } from '../patch035/FeatureTreeManager';

export type StateCategory =
  | 'CANONICAL_SOT'
  | 'DERIVED'
  | 'SESSION'
  | 'UI'
  | 'LEGACY';

export type StandardStateEntity =
  | 'EngineeringDocument'
  | 'evaluated B-Rep'
  | 'render mesh'
  | 'selection'
  | 'feature tree projection'
  | 'PatternEngine session'
  | 'DirectModeling transaction'
  | 'FeatureRecognitionSession'
  | 'Reconstruction session'
  | 'UI panel state'
  | 'legacy FeatureTreeManager';

export type MutationVerdict =
  | 'CANONICAL_MUTATION'
  | 'DERIVED_UPDATE'
  | 'SESSION_MUTATION'
  | 'UI_STATE_UPDATE'
  | 'ARCHITECTURAL_GAP';

export interface StateMutationRequest {
  workbenchId: string;
  entityName: StandardStateEntity | string;
  modifiesSOT: boolean;
  mutationType?: string;
  payload?: any;
}

export interface StateMutationAuditResult {
  workbenchId: string;
  entityName: string;
  classification: StateCategory;
  verdict: MutationVerdict;
  isAcceptable: boolean;
  invalidatedEntities: StandardStateEntity[];
  details: string;
  timestamp: string;
}

export interface WorkbenchAuditReport {
  workbenchId: string;
  registeredEntities: Array<{ name: string; category: StateCategory }>;
  totalMutationsAudited: number;
  canonicalMutations: number;
  derivedUpdates: number;
  sessionMutations: number;
  uiUpdates: number;
  architecturalGaps: number;
  isCompliant: boolean;
}

export interface SystemStateOwnershipAuditReport {
  timestamp: string;
  totalWorkbenchesAudited: number;
  compliantWorkbenches: number;
  architecturalGapCount: number;
  workbenchReports: WorkbenchAuditReport[];
  overallStatus: 'PASS_COMPLIANT' | 'FAIL_ARCHITECTURAL_GAP';
}

export interface ActiveSession {
  sessionId: string;
  workbenchId: string;
  sessionType:
    | 'PatternEngine session'
    | 'DirectModeling transaction'
    | 'FeatureRecognitionSession'
    | 'Reconstruction session'
    | string;
  createdAt: string;
  targetDocId?: string;
  stagedChanges: any[];
  isCommitted: boolean;
}

export type InvalidationCallback = (
  doc: EngineeringDocument,
  invalidatedEntities: StandardStateEntity[]
) => void;

export class WorkbenchStateOwnershipEngine {
  private static instance: WorkbenchStateOwnershipEngine;

  // Registered Canonical SOT Documents by documentId
  private canonicalDocuments: Map<string, EngineeringDocument> = new Map();

  // Active transient sessions
  private activeSessions: Map<string, ActiveSession> = new Map();

  // Derived state caches by documentId & entityName
  private derivedCaches: Map<string, Map<StandardStateEntity, any>> = new Map();

  // Registered Workbenches and their declared state entities
  private workbenchRegistrations: Map<
    string,
    Map<string, StateCategory>
  > = new Map();

  // Mutation Audit Logs
  private auditLogs: StateMutationAuditResult[] = [];

  // Invalidation Subscribers
  private invalidationSubscribers: Set<InvalidationCallback> = new Set();

  private constructor() {
    this.seedStandardClassifications();
  }

  public static getInstance(): WorkbenchStateOwnershipEngine {
    if (!WorkbenchStateOwnershipEngine.instance) {
      WorkbenchStateOwnershipEngine.instance = new WorkbenchStateOwnershipEngine();
    }
    return WorkbenchStateOwnershipEngine.instance;
  }

  /**
   * Seed standard classification taxonomy
   */
  private seedStandardClassifications() {
    const defaultWorkbench = 'GLOBAL_WORKBENCH_REGISTRY';
    const mapping: Record<StandardStateEntity, StateCategory> = {
      'EngineeringDocument': 'CANONICAL_SOT',
      'evaluated B-Rep': 'DERIVED',
      'render mesh': 'DERIVED',
      'selection': 'DERIVED', // Derived / UI
      'feature tree projection': 'DERIVED',
      'PatternEngine session': 'SESSION',
      'DirectModeling transaction': 'SESSION',
      'FeatureRecognitionSession': 'SESSION',
      'Reconstruction session': 'SESSION',
      'UI panel state': 'UI',
      'legacy FeatureTreeManager': 'LEGACY',
    };

    const map = new Map<string, StateCategory>();
    Object.entries(mapping).forEach(([entity, cat]) => map.set(entity, cat));
    this.workbenchRegistrations.set(defaultWorkbench, map);
  }

  /**
   * Classify any state entity name according to canonical taxonomy
   */
  public classifyState(entityName: string): StateCategory {
    if (entityName === 'EngineeringDocument') return 'CANONICAL_SOT';
    if (
      entityName === 'evaluated B-Rep' ||
      entityName === 'render mesh' ||
      entityName === 'selection' ||
      entityName === 'feature tree projection'
    ) {
      return 'DERIVED';
    }
    if (
      entityName === 'PatternEngine session' ||
      entityName === 'DirectModeling transaction' ||
      entityName === 'FeatureRecognitionSession' ||
      entityName === 'Reconstruction session' ||
      entityName.toLowerCase().includes('session') ||
      entityName.toLowerCase().includes('transaction')
    ) {
      return 'SESSION';
    }
    if (
      entityName === 'UI panel state' ||
      entityName.toLowerCase().includes('ui') ||
      entityName.toLowerCase().includes('panel')
    ) {
      return 'UI';
    }
    if (
      entityName === 'legacy FeatureTreeManager' ||
      entityName.toLowerCase().includes('legacy')
    ) {
      return 'LEGACY';
    }

    return 'LEGACY'; // Default unclassified
  }

  /**
   * Register a Workbench and its state entities
   */
  public registerWorkbench(
    workbenchId: string,
    entities: Array<{ name: string; category?: StateCategory }>
  ): void {
    let regMap = this.workbenchRegistrations.get(workbenchId);
    if (!regMap) {
      regMap = new Map();
      this.workbenchRegistrations.set(workbenchId, regMap);
    }
    for (const item of entities) {
      const cat = item.category || this.classifyState(item.name);
      regMap.set(item.name, cat);
    }
  }

  /**
   * Register or update a Canonical SOT Document
   */
  public registerCanonicalDocument(doc: EngineeringDocument): void {
    this.canonicalDocuments.set(doc.documentId, doc);
  }

  public getCanonicalDocument(docId: string): EngineeringDocument | undefined {
    return this.canonicalDocuments.get(docId);
  }

  /**
   * Evaluate a State Mutation against the Architectural Decision Tree:
   * State mutation
   *    ↓
   * Modifies EngineeringDocument?
   *    ├─ YES → CANONICAL_MUTATION
   *    └─ NO → Is Derived?
   *             ├─ YES → DERIVED_UPDATE
   *             └─ NO → Is Session/Staging?
   *                      ├─ YES → SESSION_MUTATION
   *                      └─ NO → Is UI state?
   *                         ├─ YES → UI_STATE_UPDATE
   *                         └─ NO → ARCHITECTURAL_GAP
   */
  public auditStateMutation(req: StateMutationRequest): StateMutationAuditResult {
    const classification = this.classifyState(req.entityName);
    let verdict: MutationVerdict;
    let isAcceptable = true;
    let invalidatedEntities: StandardStateEntity[] = [];
    let details = '';

    if (req.modifiesSOT) {
      if (req.entityName === 'EngineeringDocument' || classification === 'CANONICAL_SOT' || classification === 'SESSION') {
        verdict = 'CANONICAL_MUTATION';
        invalidatedEntities = [
          'evaluated B-Rep',
          'render mesh',
          'selection',
          'feature tree projection',
        ];
        details = `Canonical SOT mutation on ${req.entityName}. Bumping revision and invalidating derived states.`;
      } else {
        verdict = 'ARCHITECTURAL_GAP';
        isAcceptable = false;
        details = `Bypass error: Mutation claims to modify SOT, but targets non-canonical entity ${req.entityName}.`;
      }
    } else {
      switch (classification) {
        case 'DERIVED':
          verdict = 'DERIVED_UPDATE';
          details = `Derived state update on ${req.entityName}. Acceptable; recomputed on SOT invalidation.`;
          break;
        case 'SESSION':
          verdict = 'SESSION_MUTATION';
          details = `Transient session mutation on ${req.entityName}. Acceptable staging state; non-canonical until commit.`;
          break;
        case 'UI':
          verdict = 'UI_STATE_UPDATE';
          details = `UI panel state update on ${req.entityName}. Acceptable UI interaction state.`;
          break;
        case 'CANONICAL_SOT':
          verdict = 'ARCHITECTURAL_GAP';
          isAcceptable = false;
          details = `Architectural gap: Direct mutation of EngineeringDocument without specifying SOT modification flow.`;
          break;
        case 'LEGACY':
        default:
          verdict = 'ARCHITECTURAL_GAP';
          isAcceptable = false;
          details = `Architectural gap: Mutation on legacy or unbacked state ${req.entityName} without canonical SOT connection.`;
          break;
      }
    }

    const auditResult: StateMutationAuditResult = {
      workbenchId: req.workbenchId,
      entityName: req.entityName,
      classification,
      verdict,
      isAcceptable,
      invalidatedEntities,
      details,
      timestamp: new Date().toISOString(),
    };

    this.auditLogs.push(auditResult);
    return auditResult;
  }

  /**
   * Apply a Canonical Mutation to EngineeringDocument:
   * Increments revision and invalidates all derived state (evaluated B-Rep, render mesh, selection, feature tree projection).
   */
  public mutateCanonicalDocument(
    docId: string,
    mutatorFn: (doc: EngineeringDocument) => void,
    mutationDescription: string,
    workbenchId = 'GENERAL_WORKBENCH'
  ): { updatedDoc: EngineeringDocument; revision: number; audit: StateMutationAuditResult } {
    const doc = this.canonicalDocuments.get(docId);
    if (!doc) {
      throw new Error(`Canonical EngineeringDocument '${docId}' not found in WorkbenchStateOwnershipEngine.`);
    }

    const audit = this.auditStateMutation({
      workbenchId,
      entityName: 'EngineeringDocument',
      modifiesSOT: true,
      mutationType: mutationDescription,
    });

    // Perform mutation
    mutatorFn(doc);

    // Increment revision
    const currentRev = typeof doc.revision === 'number' ? doc.revision : parseInt(String(doc.revision), 10) || 1;
    doc.revision = currentRev + 1;

    // Clear derived caches for this document
    this.derivedCaches.delete(docId);

    // Notify invalidation subscribers
    this.notifyInvalidation(doc, audit.invalidatedEntities);

    return {
      updatedDoc: doc,
      revision: doc.revision as number,
      audit,
    };
  }

  /**
   * Session Management: Create staging session
   */
  public createSession(
    workbenchId: string,
    sessionType:
      | 'PatternEngine session'
      | 'DirectModeling transaction'
      | 'FeatureRecognitionSession'
      | 'Reconstruction session',
    targetDocId?: string
  ): ActiveSession {
    const sessionId = `SESS-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const session: ActiveSession = {
      sessionId,
      workbenchId,
      sessionType,
      createdAt: new Date().toISOString(),
      targetDocId,
      stagedChanges: [],
      isCommitted: false,
    };

    this.activeSessions.set(sessionId, session);

    // Audit session creation
    this.auditStateMutation({
      workbenchId,
      entityName: sessionType,
      modifiesSOT: false,
    });

    return session;
  }

  /**
   * Stage a change in an active session
   */
  public stageSessionChange(sessionId: string, change: any): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error(`Session '${sessionId}' not found.`);
    if (session.isCommitted) throw new Error(`Session '${sessionId}' is already committed.`);

    session.stagedChanges.push(change);

    this.auditStateMutation({
      workbenchId: session.workbenchId,
      entityName: session.sessionType,
      modifiesSOT: false,
    });
  }

  /**
   * Commit a Session to the Canonical SOT (EngineeringDocument)
   * Converts transient Session state into a Canonical Mutation.
   */
  public commitSessionToCanonicalSOT(
    sessionId: string,
    docId: string,
    commitFn: (doc: EngineeringDocument, stagedChanges: any[]) => void
  ): { updatedDoc: EngineeringDocument; revision: number; audit: StateMutationAuditResult } {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error(`Session '${sessionId}' not found.`);

    const doc = this.canonicalDocuments.get(docId);
    if (!doc) throw new Error(`Document '${docId}' not found.`);

    // Perform canonical commit
    const result = this.mutateCanonicalDocument(
      docId,
      (d) => commitFn(d, session.stagedChanges),
      `Commit Session ${session.sessionId} (${session.sessionType})`,
      session.workbenchId
    );

    session.isCommitted = true;
    return result;
  }

  /**
   * Bridge legacy FeatureTreeManager to canonical EngineeringDocument SOT
   */
  public bridgeLegacyFeatureTreeManager(
    manager: FeatureTreeManager,
    targetDoc: EngineeringDocument
  ): void {
    const legacyFeatures = manager.getFeatureTree();
    this.mutateCanonicalDocument(
      targetDoc.documentId,
      (doc) => {
        doc.features = legacyFeatures.map((f) => ({
          featureId: f.id,
          name: f.operation.command,
          type: f.operation.domain,
          status: f.status,
          parameters: f.operation.parameters || {},
          suppressed: f.suppressed,
          geometryHash: f.geometryHash,
        }));
      },
      'Bridge Legacy FeatureTreeManager to EngineeringDocument',
      'LEGACY_BRIDGE'
    );
  }

  /**
   * Register a subscriber for SOT invalidations
   */
  public subscribeInvalidation(cb: InvalidationCallback): () => void {
    this.invalidationSubscribers.add(cb);
    return () => this.invalidationSubscribers.delete(cb);
  }

  private notifyInvalidation(
    doc: EngineeringDocument,
    invalidatedEntities: StandardStateEntity[]
  ) {
    this.invalidationSubscribers.forEach((cb) => cb(doc, invalidatedEntities));
  }

  /**
   * Audit a single Workbench for compliance
   */
  public auditWorkbench(workbenchId: string): WorkbenchAuditReport {
    const logs = this.auditLogs.filter((l) => l.workbenchId === workbenchId);
    const regEntitiesMap = this.workbenchRegistrations.get(workbenchId);

    const registeredEntities: Array<{ name: string; category: StateCategory }> = [];
    if (regEntitiesMap) {
      regEntitiesMap.forEach((category, name) => {
        registeredEntities.push({ name, category });
      });
    }

    let canonicalMutations = 0;
    let derivedUpdates = 0;
    let sessionMutations = 0;
    let uiUpdates = 0;
    let architecturalGaps = 0;

    for (const log of logs) {
      switch (log.verdict) {
        case 'CANONICAL_MUTATION':
          canonicalMutations++;
          break;
        case 'DERIVED_UPDATE':
          derivedUpdates++;
          break;
        case 'SESSION_MUTATION':
          sessionMutations++;
          break;
        case 'UI_STATE_UPDATE':
          uiUpdates++;
          break;
        case 'ARCHITECTURAL_GAP':
          architecturalGaps++;
          break;
      }
    }

    return {
      workbenchId,
      registeredEntities,
      totalMutationsAudited: logs.length,
      canonicalMutations,
      derivedUpdates,
      sessionMutations,
      uiUpdates,
      architecturalGaps,
      isCompliant: architecturalGaps === 0,
    };
  }

  /**
   * Audit All Workbenches across the system
   */
  public auditAllWorkbenches(): SystemStateOwnershipAuditReport {
    const workbenchIds = new Set<string>();
    this.auditLogs.forEach((l) => workbenchIds.add(l.workbenchId));
    this.workbenchRegistrations.forEach((_, id) => workbenchIds.add(id));

    const reports: WorkbenchAuditReport[] = [];
    let totalGaps = 0;

    workbenchIds.forEach((id) => {
      const report = this.auditWorkbench(id);
      reports.push(report);
      totalGaps += report.architecturalGaps;
    });

    return {
      timestamp: new Date().toISOString(),
      totalWorkbenchesAudited: reports.length,
      compliantWorkbenches: reports.filter((r) => r.isCompliant).length,
      architecturalGapCount: totalGaps,
      workbenchReports: reports,
      overallStatus: totalGaps === 0 ? 'PASS_COMPLIANT' : 'FAIL_ARCHITECTURAL_GAP',
    };
  }

  /**
   * Authoritative Reset: Clears all internal engine state and registrations.
   */
  public resetAuditState(): void {
    this.auditLogs = [];
    this.canonicalDocuments.clear();
    this.activeSessions.clear();
    this.derivedCaches.clear();
    this.workbenchRegistrations.clear();
    this.seedStandardClassifications();
  }
}
