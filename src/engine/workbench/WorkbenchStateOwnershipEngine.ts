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

/**
 * Cycle-safe, prototype-preserving deep cloner for CAD & B-Rep structures.
 * Preserves topological incidence, class prototypes, arrays, maps, sets, dates.
 */
function deepCloneCAD<T>(source: T, seen = new Map<any, any>()): T {
  if (source === null || typeof source !== 'object') {
    return source;
  }

  if (seen.has(source)) {
    return seen.get(source);
  }

  if (source instanceof Date) {
    return new Date(source.getTime()) as any;
  }

  if (source instanceof RegExp) {
    return new RegExp(source.source, source.flags) as any;
  }

  if (source instanceof Map) {
    const copyMap = new Map();
    seen.set(source, copyMap);
    source.forEach((val, key) => {
      copyMap.set(deepCloneCAD(key, seen), deepCloneCAD(val, seen));
    });
    return copyMap as any;
  }

  if (source instanceof Set) {
    const copySet = new Set();
    seen.set(source, copySet);
    source.forEach((val) => {
      copySet.add(deepCloneCAD(val, seen));
    });
    return copySet as any;
  }

  if (Array.isArray(source)) {
    const copyArr: any[] = [];
    seen.set(source, copyArr);
    for (let i = 0; i < source.length; i++) {
      copyArr[i] = deepCloneCAD(source[i], seen);
    }
    return copyArr as any;
  }

  // Preserve class prototype (BRepSolid, TopoShape, custom geometric instances)
  const proto = Object.getPrototypeOf(source);
  const copyObj = Object.create(proto || Object.prototype);
  seen.set(source, copyObj);

  // Copy own properties and symbols
  const keys = Reflect.ownKeys(source);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (descriptor) {
      if ('value' in descriptor) {
        try {
          copyObj[key] = deepCloneCAD(descriptor.value, seen);
        } catch {
          try {
            Object.defineProperty(copyObj, key, {
              ...descriptor,
              value: deepCloneCAD(descriptor.value, seen),
            });
          } catch {
            // Ignore if non-configurable
          }
        }
      } else {
        try {
          Object.defineProperty(copyObj, key, descriptor);
        } catch {
          // Ignore accessor error
        }
      }
    }
  }

  return copyObj;
}

/**
 * Reverts an existing CAD entity/object in-place to the exact state of snapshotObj.
 * Restores all properties, removes any added corrupted keys, and preserves object identity.
 */
function restoreCADEntityInPlace(targetObj: any, snapshotObj: any, visited = new Set<any>()): void {
  if (!targetObj || !snapshotObj || typeof targetObj !== 'object' || typeof snapshotObj !== 'object') {
    return;
  }
  if (visited.has(targetObj)) return;
  visited.add(targetObj);

  // 1. Delete extra properties added to targetObj during the failed mutation
  const targetKeys = Reflect.ownKeys(targetObj);
  for (const key of targetKeys) {
    if (!Reflect.has(snapshotObj, key)) {
      try {
        delete (targetObj as any)[key];
      } catch {
        // Ignore if non-configurable
      }
    }
  }

  // 2. Revert / restore properties from snapshotObj
  const snapshotKeys = Reflect.ownKeys(snapshotObj);
  for (const key of snapshotKeys) {
    const targetVal = (targetObj as any)[key];
    const snapVal = (snapshotObj as any)[key];

    if (
      targetVal &&
      snapVal &&
      typeof targetVal === 'object' &&
      typeof snapVal === 'object' &&
      !Array.isArray(snapVal) &&
      !(snapVal instanceof Date) &&
      !(snapVal instanceof RegExp) &&
      !(snapVal instanceof Map) &&
      !(snapVal instanceof Set)
    ) {
      restoreCADEntityInPlace(targetVal, snapVal, visited);
    } else {
      try {
        (targetObj as any)[key] = deepCloneCAD(snapVal);
      } catch {
        try {
          Object.defineProperty(targetObj, key, {
            value: deepCloneCAD(snapVal),
            writable: true,
            configurable: true,
            enumerable: true,
          });
        } catch {
          // Ignore
        }
      }
    }
  }
}

export interface DocumentSnapshotRecord {
  documentSnapshot: EngineeringDocument;
  shapeReference?: any;
  solidReference?: any;
}

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
   * Seed standard classification taxonomy and system workbenches
   */
  private seedStandardClassifications() {
    const defaultMapping: Record<StandardStateEntity, StateCategory> = {
      'EngineeringDocument': 'CANONICAL_SOT',
      'evaluated B-Rep': 'DERIVED',
      'render mesh': 'DERIVED',
      'selection': 'DERIVED',
      'feature tree projection': 'DERIVED',
      'PatternEngine session': 'SESSION',
      'DirectModeling transaction': 'SESSION',
      'FeatureRecognitionSession': 'SESSION',
      'Reconstruction session': 'SESSION',
      'UI panel state': 'UI',
      'legacy FeatureTreeManager': 'LEGACY',
    };

    const workbenchesToSeed: Array<{ id: string; entities: Array<{ name: string; category?: StateCategory }> }> = [
      {
        id: 'GLOBAL_WORKBENCH_REGISTRY',
        entities: Object.entries(defaultMapping).map(([name, category]) => ({ name, category: category as StateCategory })),
      },
      {
        id: 'DESIGN',
        entities: [
          { name: 'EngineeringDocument', category: 'CANONICAL_SOT' },
          { name: 'evaluated B-Rep', category: 'DERIVED' },
          { name: 'render mesh', category: 'DERIVED' },
          { name: 'selection', category: 'DERIVED' },
          { name: 'feature tree projection', category: 'DERIVED' },
        ],
      },
      {
        id: 'PARAMETRIC_FEATURE_WORKBENCH',
        entities: [
          { name: 'EngineeringDocument', category: 'CANONICAL_SOT' },
          { name: 'evaluated B-Rep', category: 'DERIVED' },
          { name: 'render mesh', category: 'DERIVED' },
          { name: 'feature tree projection', category: 'DERIVED' },
        ],
      },
      {
        id: 'FEATURE_TREE_WORKBENCH',
        entities: [
          { name: 'EngineeringDocument', category: 'CANONICAL_SOT' },
          { name: 'feature tree projection', category: 'DERIVED' },
          { name: 'selection', category: 'DERIVED' },
        ],
      },
      {
        id: 'PARAMETRIC_WORKBENCH',
        entities: [
          { name: 'EngineeringDocument', category: 'CANONICAL_SOT' },
          { name: 'evaluated B-Rep', category: 'DERIVED' },
          { name: 'render mesh', category: 'DERIVED' },
        ],
      },
      {
        id: 'PATTERN_WORKBENCH',
        entities: [
          { name: 'PatternEngine session', category: 'SESSION' },
          { name: 'EngineeringDocument', category: 'CANONICAL_SOT' },
          { name: 'evaluated B-Rep', category: 'DERIVED' },
        ],
      },
      {
        id: 'DIRECT_MODELING_WORKBENCH',
        entities: [
          { name: 'DirectModeling transaction', category: 'SESSION' },
          { name: 'EngineeringDocument', category: 'CANONICAL_SOT' },
          { name: 'evaluated B-Rep', category: 'DERIVED' },
        ],
      },
      {
        id: 'VIEWPORT_WORKBENCH',
        entities: [
          { name: 'render mesh', category: 'DERIVED' },
          { name: 'selection', category: 'DERIVED' },
          { name: 'evaluated B-Rep', category: 'DERIVED' },
          { name: 'UI panel state', category: 'UI' },
        ],
      },
      {
        id: 'UI_PANEL_WORKBENCH',
        entities: [
          { name: 'UI panel state', category: 'UI' },
        ],
      },
      {
        id: 'GOVERNANCE',
        entities: [
          { name: 'EngineeringDocument', category: 'CANONICAL_SOT' },
        ],
      },
      {
        id: 'SIMULATION',
        entities: [
          { name: 'EngineeringDocument', category: 'CANONICAL_SOT' },
          { name: 'evaluated B-Rep', category: 'DERIVED' },
          { name: 'render mesh', category: 'DERIVED' },
        ],
      },
      {
        id: 'MANUFACTURING',
        entities: [
          { name: 'EngineeringDocument', category: 'CANONICAL_SOT' },
          { name: 'evaluated B-Rep', category: 'DERIVED' },
          { name: 'render mesh', category: 'DERIVED' },
        ],
      },
      {
        id: 'DOCUMENTATION',
        entities: [
          { name: 'EngineeringDocument', category: 'CANONICAL_SOT' },
          { name: 'feature tree projection', category: 'DERIVED' },
        ],
      },
      {
        id: 'GENERAL_WORKBENCH',
        entities: [
          { name: 'EngineeringDocument', category: 'CANONICAL_SOT' },
          { name: 'evaluated B-Rep', category: 'DERIVED' },
        ],
      },
      {
        id: 'LEGACY_BRIDGE',
        entities: [
          { name: 'legacy FeatureTreeManager', category: 'LEGACY' },
          { name: 'EngineeringDocument', category: 'CANONICAL_SOT' },
        ],
      },
    ];

    for (const wb of workbenchesToSeed) {
      const map = new Map<string, StateCategory>();
      wb.entities.forEach(e => map.set(e.name, e.category || this.classifyState(e.name)));
      this.workbenchRegistrations.set(wb.id, map);
    }
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
   * Create an isolated deep snapshot of an EngineeringDocument to ensure transactional atomicity.
   * Deep clones all CAD structures and retains original shape/solid identity references for in-place restoration.
   */
  private createDocumentSnapshot(doc: EngineeringDocument): DocumentSnapshotRecord {
    return {
      documentSnapshot: deepCloneCAD(doc),
      shapeReference: doc.evaluatedShape,
      solidReference: doc.evaluatedSolid,
    };
  }

  /**
   * In-place atomic restoration of an EngineeringDocument to its snapshot state.
   * Restores all internal fields of evaluatedShape and evaluatedSolid in-place,
   * reverses any added or deleted keys, and preserves object identity for downstream references.
   */
  private restoreDocumentSnapshot(target: EngineeringDocument, snapshotRecord: DocumentSnapshotRecord): void {
    const { documentSnapshot, shapeReference, solidReference } = snapshotRecord;

    // 1. In-place restoration of evaluatedShape
    if (shapeReference && documentSnapshot.evaluatedShape) {
      restoreCADEntityInPlace(shapeReference, documentSnapshot.evaluatedShape);
      target.evaluatedShape = shapeReference;
    } else if (documentSnapshot.evaluatedShape) {
      target.evaluatedShape = deepCloneCAD(documentSnapshot.evaluatedShape);
    } else {
      delete target.evaluatedShape;
    }

    // 2. In-place restoration of evaluatedSolid
    if (solidReference && documentSnapshot.evaluatedSolid) {
      restoreCADEntityInPlace(solidReference, documentSnapshot.evaluatedSolid);
      target.evaluatedSolid = solidReference;
    } else if (documentSnapshot.evaluatedSolid) {
      target.evaluatedSolid = deepCloneCAD(documentSnapshot.evaluatedSolid);
    } else {
      delete target.evaluatedSolid;
    }

    // 3. Clear extra keys on target
    const targetKeys = Reflect.ownKeys(target);
    for (const key of targetKeys) {
      if (key === 'evaluatedShape' || key === 'evaluatedSolid') continue;
      if (!Reflect.has(documentSnapshot, key)) {
        try {
          delete (target as any)[key];
        } catch {
          // ignore
        }
      }
    }

    // 4. Restore all other fields from snapshot
    const snapKeys = Reflect.ownKeys(documentSnapshot);
    for (const key of snapKeys) {
      if (key === 'evaluatedShape' || key === 'evaluatedSolid') continue;
      (target as any)[key] = deepCloneCAD((documentSnapshot as any)[key]);
    }
  }

  /**
   * Apply a Canonical Mutation to EngineeringDocument:
   * Increments revision and invalidates all derived state (evaluated B-Rep, render mesh, selection, feature tree projection).
   * GUARANTEES TRANSACTIONAL ATOMICITY:
   * If mutatorFn throws or fails midway, the document is rolled back in place to its exact pre-mutation state,
   * including in-place rollback of B-Rep geometry and topology,
   * revision is NOT incremented, derived caches are NOT touched, subscribers are NOT notified,
   * and the failure is audited as an aborted transaction before rethrowing.
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

    // Capture deep snapshot for transactional rollback guarantees
    const snapshotRecord = this.createDocumentSnapshot(doc);

    // Execute mutator in isolated transactional block
    try {
      mutatorFn(doc);
    } catch (err: any) {
      // Rollback document state in-place to pre-mutation snapshot
      this.restoreDocumentSnapshot(doc, snapshotRecord);

      // Audit aborted transaction to preserve full forensic history
      const abortedAudit: StateMutationAuditResult = {
        workbenchId,
        entityName: 'EngineeringDocument',
        classification: 'CANONICAL_SOT',
        verdict: 'ARCHITECTURAL_GAP',
        isAcceptable: false,
        invalidatedEntities: [],
        details: `Transactional abort & rollback: mutatorFn failed midway (${err?.message || String(err)}). Document restored to rev ${doc.revision}.`,
        timestamp: new Date().toISOString(),
      };
      this.auditLogs.push(abortedAudit);

      throw new Error(
        `Canonical mutation transaction failed and was rolled back atomically: ${err?.message || String(err)}`
      );
    }

    // Only audit and commit upon successful completion of mutatorFn
    const audit = this.auditStateMutation({
      workbenchId,
      entityName: 'EngineeringDocument',
      modifiesSOT: true,
      mutationType: mutationDescription,
    });

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
   * Session Management: Discard / Rollback an uncommitted session.
   * Completely purges transient staged changes and removes the session from memory.
   * Guarantees zero side effects on Canonical SOT.
   */
  public discardSession(sessionId: string): { discardedSession: ActiveSession; audit: StateMutationAuditResult } {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session '${sessionId}' not found for discard.`);
    }
    if (session.isCommitted) {
      throw new Error(`Cannot discard already committed session '${sessionId}'.`);
    }

    this.activeSessions.delete(sessionId);

    const audit: StateMutationAuditResult = {
      workbenchId: session.workbenchId,
      entityName: session.sessionType,
      classification: 'SESSION',
      verdict: 'SESSION_MUTATION',
      isAcceptable: true,
      invalidatedEntities: [],
      details: `Session '${sessionId}' (${session.sessionType}) discarded with ${session.stagedChanges.length} staged changes. Zero SOT impact.`,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.push(audit);

    return { discardedSession: session, audit };
  }

  /**
   * Retrieve active session by ID
   */
  public getActiveSession(sessionId: string): ActiveSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Derived state cache management: Store evaluated derived state
   */
  public setDerivedCache(docId: string, entity: StandardStateEntity, value: any): void {
    let docMap = this.derivedCaches.get(docId);
    if (!docMap) {
      docMap = new Map();
      this.derivedCaches.set(docId, docMap);
    }
    docMap.set(entity, value);
  }

  /**
   * Derived state cache management: Retrieve cached derived state
   */
  public getDerivedCache(docId: string, entity: StandardStateEntity): any | undefined {
    return this.derivedCaches.get(docId)?.get(entity);
  }

  /**
   * Explicitly invalidate derived state caches for a document and notify subscribers
   */
  public invalidateDerivedCache(docId: string, entity?: StandardStateEntity): void {
    if (entity) {
      this.derivedCaches.get(docId)?.delete(entity);
    } else {
      this.derivedCaches.delete(docId);
    }
    const doc = this.canonicalDocuments.get(docId);
    if (doc) {
      const invalidatedList: StandardStateEntity[] = entity
        ? [entity]
        : ['evaluated B-Rep', 'render mesh', 'selection', 'feature tree projection'];
      this.notifyInvalidation(doc, invalidatedList);
    }
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
          id: f.id,
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
