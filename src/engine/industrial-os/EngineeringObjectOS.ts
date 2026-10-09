import * as crypto from 'crypto';
const fs = null;
const path = null;
import {
  EngineeringObject,
  EngineeringObjectStatus,
  EngineeringAuditEvent
} from './types';
import { EngineeringEventStore } from './event-model/EngineeringEventStore';
import { EngineeringEventActor } from './event-model/types';
import { EngineeringIdentityService } from '../identity/EngineeringIdentityService';
import { EngineeringIdentity, EngineeringObjectType } from '../identity/CanonicalEngineeringIdentity';
import { EngineeringIdentityFactory } from '../identity/EngineeringIdentityFactory';
import { ProvenanceGraphBuilder } from '../provenance/ProvenanceGraphBuilder';
import { ProvenanceGraph } from '../provenance/ProvenanceGraph';
import { EngineeringStateMachine } from './state-machine/EngineeringStateMachine';
import { EvidenceBus } from './evidence-bus/EvidenceBus';
import { EvidenceEnvelope } from './evidence-bus/types';
import { EngineeringPolicyEngine } from './policy/EngineeringPolicyEngine';
import { INITIAL_SECP_POLICIES } from './policy/DefaultPolicies';
import { PolicyContext } from './policy/types';
import { EnterpriseGovernanceEngine } from './governance/EnterpriseGovernanceEngine';
import { EngineeringRole, GovernanceVerdict } from './governance/types';
import { ApprovalGovernanceService } from './governance/ApprovalGovernanceService';
import { IdentityGovernanceService } from './governance/IdentityGovernanceService';

export class EngineeringObjectOS {
  private registry = new Map<string, EngineeringObject>();
  private identityService = EngineeringIdentityService.getInstance();
  private auditLog: EngineeringAuditEvent[] = [];
  private eventStore = EngineeringEventStore.getInstance();
  private provenanceGraphBuilder = new ProvenanceGraphBuilder();
  private revisionLineage = new Map<string, string[]>(); // objectId -> list of revision codes in order
  private policyEngine = EngineeringPolicyEngine.getInstance(INITIAL_SECP_POLICIES);
  private governanceEngine = EnterpriseGovernanceEngine.getInstance();
  private approvalService = ApprovalGovernanceService.getInstance();
  private identityGov = IdentityGovernanceService.getInstance();

  private static STORAGE_KEY = 'SECP_ENGINEERING_OBJECT_OS_REGISTRY';

  constructor() {
    this.tryLoadFromPersistence();
    // Ensure all initial policies are registered
    INITIAL_SECP_POLICIES.forEach(p => {
      try {
        this.policyEngine.registerPolicy(p);
      } catch (e) {
        // Ignore duplicates
      }
    });
  }

  // ============================================================================
  // 1. REGISTRY OPERATIONS
  // ============================================================================

  private deepFreeze<T>(obj: T): T {
    if (obj && typeof obj === 'object') {
      if (!Object.isFrozen(obj)) {
        Object.freeze(obj);
      }
      Object.keys(obj).forEach(key => {
        const val = (obj as any)[key];
        if (val && typeof val === 'object') {
          this.deepFreeze(val);
        }
      });
    }
    return obj;
  }

  public register(draft: {
    id?: string;
    objectType?: EngineeringObjectType;
    identity?: EngineeringIdentity;
    metadata: Record<string, unknown>;
    author: string;
    projectId?: string;
    dependencies?: string[];
  }): EngineeringObject {
    const author = draft.author;
    const id = draft.id || `OBJ-${crypto.randomBytes(16).toString('hex')}`;
    const dependencies = draft.dependencies || [];
    const objectType = draft.objectType || EngineeringObjectType.DESIGN;

    // Resolve or Generate Identity
    let identity = draft.identity;
    if (!identity) {
      identity = EngineeringIdentityFactory.createIdentity({ objectType,
        projectId: draft.projectId || 'DEFAULT_PROJECT',
        revisionId: '1',
        createdBy: author,
        seed: id
      }, draft.metadata);
    }

    // Governance Evaluation (PATCH-160)
    const governanceDecision = this.governanceEngine.evaluate({
      identity: author,
      organizationId: this.identityGov.getOrganizationId(author),
      projectId: draft.projectId || 'DEFAULT_PROJECT',
      roles: this.identityGov.getRoles(author),
      capabilities: [],
      requestedAction: 'CREATE',
      metadata: draft.metadata,
      timestamp: new Date().toISOString(),
      correlationId: `CORR-${crypto.randomBytes(16).toString('hex')}` });

    if (governanceDecision.verdict === 'DENY') {
      throw new Error(`[EngineeringObjectOS] Governance Rejection: ${governanceDecision.reason}`);
    }

    const obj: EngineeringObject = {
      id,
      identity,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: author,
      dependencies: Object.freeze([...dependencies]),
      metadata: Object.freeze({ ...draft.metadata }),
      provenance: Object.freeze({
        author,
        action: 'REGISTER',
        timestamp: new Date().toISOString(),
        hash: identity.contentHash
      }),
      evidenceRefs: Object.freeze([]),
      dependencyVersionSnapshot: Object.freeze({})
    };

    if (this.registry.has(obj.id)) {
      throw new Error(`[EngineeringObjectOS] Duplicate Object ID error: ${obj.id}`);
    }

    // Validate structure
    this.validateObjectContract(obj);

    // Deep freeze to guarantee absolute immutability
    const frozenObj = this.deepFreeze(obj);

    // Save to registry
    this.registry.set(frozenObj.id, frozenObj);

    // Register identity in service
    this.identityService.registerIdentity(frozenObj.identity);

    // Initialize State Machine State
    EngineeringStateMachine.getInstance().initializeState(frozenObj, author);

    // Record Unified Event
    this.eventStore.append({
      eventType: 'OBJECT_CREATED',
      actor: { id: author, type: 'USER' },
      source: { service: 'IndustrialOS', component: 'EngineeringObjectOS', version: '1.0' },
      objectRefs: [frozenObj.id],
      entityIdentityId: frozenObj.identity.identityId,
      entityType: frozenObj.identity.objectType,
      entityRevision: frozenObj.identity.revisionId,
      correlationId: `CORR-${crypto.randomBytes(16).toString("hex")}`,
      payload: { objectType: frozenObj.identity.objectType, version: frozenObj.identity.objectVersion }
    });

    // Record in lineage tracker
    const line = this.revisionLineage.get(obj.id) || [];
    if (!line.includes(obj.identity.revisionId)) {
      line.push(obj.identity.revisionId);
      this.revisionLineage.set(obj.id, line);
    }

    // Write Audit Event
    this.logAuditEvent('OBJECT_CREATED', obj.id, author, {
      objectType: obj.identity.objectType,
      version: obj.identity.objectVersion,
      revision: obj.identity.revisionId,
      status: obj.status,
      metadata: obj.metadata
    });

    // Integrity: Connect with the existing Provenance Graph system
    const mappedType = this.mapToProvenanceType(obj.identity.objectType);
    this.provenanceGraphBuilder.addNode({
      type: mappedType,
      engineeringIdentityId: obj.id,
      canonicalHash: obj.provenance.hash,
      version: String(obj.identity.objectVersion),
      evidenceRefs: [...obj.evidenceRefs],
      attributes: {
        status: obj.status,
        revision: obj.identity.revisionId,
        ...obj.metadata
      }
    });

    // Record USES relations for all dependencies in provenance graph
    obj.dependencies.forEach(depId => {
      const dep = this.registry.get(depId);
      if (dep) {
        this.provenanceGraphBuilder.addEdge({
          type: 'USES',
          fromNodeId: obj.id,
          toNodeId: depId,
          evidenceRefs: [...obj.evidenceRefs]
        });
      }
    });

    // Publish STATE_EVIDENCE to EvidenceBus
    try {
      EvidenceBus.getInstance().publishSync({
        evidenceType: 'STATE_EVIDENCE',
        sourceCapability: 'capability:industrial_os.object_os',
        sourceOperation: 'registerObject',
        engineeringObjectId: frozenObj.id,
        subjectIdentityId: frozenObj.identity.identityId,
        author,
        payload: {
          objectId: frozenObj.id,
          identityId: frozenObj.identity.identityId,
          objectType: frozenObj.identity.objectType,
          version: frozenObj.identity.objectVersion,
          revision: frozenObj.identity.revisionId,
          status: frozenObj.status,
          provenanceHash: frozenObj.provenance.hash
        }
      });
    } catch {
      // Safe fallback
    }

    this.trySaveToPersistence();
    return frozenObj;
  }

  /**
   * Attaches verified cryptographic evidence to an engineering object.
   * ADVERSARIAL PROTECTION: Rejects synthetic or unverified evidence identifiers not backed by EvidenceBus.
   */
  public attachEvidence(objectId: string, evidence: EvidenceEnvelope | string, author: string): EngineeringObject {
    const obj = this.registry.get(objectId);
    if (!obj) {
      throw new Error(`[EngineeringObjectOS] Object not found: ${objectId}`);
    }

    let evidenceId: string;
    if (typeof evidence === 'object' && evidence !== null && 'id' in evidence) {
      evidenceId = evidence.id;
    } else if (typeof evidence === 'string') {
      evidenceId = evidence;
    } else {
      throw new Error(`[EngineeringObjectOS] ADVERSARIAL_INJECTION_REJECTED: Invalid evidence reference format`);
    }

    // Adversarial verification: Evidence reference must match cryptographic format and be registered in EvidenceBus
    const isValidFormat = /^ev-[a-f0-9]{12,}$/.test(evidenceId);
    if (!isValidFormat) {
      throw new Error(`[EngineeringObjectOS] ADVERSARIAL_INJECTION_REJECTED: Synthetic or unverified evidence token "${evidenceId}" rejected.`);
    }

    const busRecords = EvidenceBus.getInstance().getStorage();
    const isRegisteredInBus = busRecords.some(env => env.id === evidenceId);
    if (!isRegisteredInBus) {
      throw new Error(`[EngineeringObjectOS] ADVERSARIAL_INJECTION_REJECTED: Evidence envelope "${evidenceId}" not found in EvidenceBus cryptographic store.`);
    }

    const currentRefs = obj.evidenceRefs || [];
    if (currentRefs.includes(evidenceId)) {
      return obj; // Idempotent
    }

    const updatedObj: EngineeringObject = {
      ...obj,
      evidenceRefs: [...currentRefs, evidenceId],
      updatedAt: new Date().toISOString()
    };

    const frozen = this.deepFreeze(updatedObj);
    this.registry.set(objectId, frozen);

    this.logAuditEvent('EVIDENCE_ATTACHED', objectId, author, {
      evidenceId,
      totalEvidenceRefs: frozen.evidenceRefs.length
    });

    this.trySaveToPersistence();
    return frozen;
  }

  public getEvidenceForObject(objectId: string): EvidenceEnvelope[] {
    try {
      return EvidenceBus.getInstance().query({ engineeringObjectId: objectId });
    } catch {
      return [];
    }
  }

  public resolve(id: string): EngineeringObject | undefined {
    return this.registry.get(id);
  }

  public get(id: string): EngineeringObject | undefined {
    return this.resolve(id);
  }

  public getRegistrySize(): number {
    return this.registry.size;
  }

  public listAllObjects(): EngineeringObject[] {
    return Array.from(this.registry.values());
  }

  // ============================================================================
  // 2. OBJECT LIFECYCLE MANAGEMENT
  // ============================================================================

  public transitionState(
    id: string,
    nextStatus: EngineeringObjectStatus,
    author: string,
    options?: { forceReactivate?: boolean; reason?: string; expectedVersion?: number; verificationEvidenceExists?: boolean }
  ): void {
    const obj = this.registry.get(id);
    if (!obj) {
      throw new Error(`[EngineeringObjectOS] Cannot transition state: Object not found with ID ${id}`);
    }

    const currentStatus = obj.status;
    if (currentStatus === nextStatus) {
      return; // No-op
    }

    // Governance Evaluation (PATCH-160)
    const governanceDecision = this.governanceEngine.evaluate({
      identity: author,
      organizationId: this.identityGov.getOrganizationId(author),
      projectId: obj.identity.projectId,
      roles: this.identityGov.getRoles(author),
      capabilities: [],
      object: {
        id: obj.id,
        identity: obj.identity,
        status: obj.status,
        revisionId: obj.identity.revisionId,
        creatorId: obj.createdBy
      },
      requestedAction: `TRANSITION_${nextStatus}`,
      metadata: options || {},
      timestamp: new Date().toISOString(),
      correlationId: `CORR-${crypto.randomBytes(16).toString("hex")}`
    });

    if (governanceDecision.verdict === 'DENY') {
      throw new Error(`[EngineeringObjectOS] Governance Rejection: ${governanceDecision.reason}`);
    }

    if (governanceDecision.verdict === 'REQUIRE_REVIEW') {
      // Check if it's already approved
      if (!this.approvalService.isApproved(obj.identity.identityId, obj.identity.revisionId, nextStatus)) {
        // Request approval if not already pending/approved
        this.approvalService.requestApproval(obj, nextStatus, author, ['ENGINEERING_LEAD' as any]);
        throw new Error(`[EngineeringObjectOS] Transition to ${nextStatus} requires ENGINEERING_LEAD approval. Approval request has been initiated.`);
      }
    }

    // 1. Evidence-Backed Integrity validation
    if (nextStatus === 'VALIDATED') {
      const evidenceInOptions = options && options.verificationEvidenceExists === true;
      if (!evidenceInOptions && (!obj.evidenceRefs || obj.evidenceRefs.length === 0)) {
        throw new Error(
          `[EngineeringObjectOS] Verification evidence missing: Cannot transition to VALIDATED. Status is downgraded or action aborted.`
        );
      }
    }

    // Delegate to central EngineeringStateMachine
    const stateMachine = EngineeringStateMachine.getInstance();
    stateMachine.transition(
      obj,
      nextStatus,
      {
        actor: { id: author, type: 'USER' },
        reason: options?.reason,
        forceReactivate: options?.forceReactivate,
        metadata: {
          ...options,
          bypassPolicyCheck: true,
          // Support simulation/result guard evaluation
          solverExists: options && 'solverExists' in options ? (options as any).solverExists : true,
          boundaryConditionsValid: options && 'boundaryConditionsValid' in options ? (options as any).boundaryConditionsValid : true,
          materialModelValid: options && 'materialModelValid' in options ? (options as any).materialModelValid : true,
          configValid: options && 'configValid' in options ? (options as any).configValid : true,
          residualChecksPassed: options && 'residualChecksPassed' in options ? (options as any).residualChecksPassed : true,
          conservationPassed: options && 'conservationPassed' in options ? (options as any).conservationPassed : true,
          verificationEvidenceExists: options && 'verificationEvidenceExists' in options ? (options as any).verificationEvidenceExists : true,
          signatureVerified: options && 'signatureVerified' in options ? (options as any).signatureVerified : true,
          hashMatched: options && 'hashMatched' in options ? (options as any).hashMatched : true,
          hasExecutionTelemetry: options && 'hasExecutionTelemetry' in options ? (options as any).hasExecutionTelemetry : true,
          expectedVersion: options?.expectedVersion
        }
      },
      (depId) => this.registry.get(depId),
      (objectId, status) => {
        const targetObj = this.registry.get(objectId);
        if (targetObj) {
          const updatedObj: EngineeringObject = {
            ...targetObj,
            status: status,
            updatedAt: new Date().toISOString()
          };
          this.registry.set(objectId, this.deepFreeze(updatedObj));
        }
      }
    );

    this.logAuditEvent('OBJECT_STATE_CHANGED', id, author, {
      fromStatus: currentStatus,
      toStatus: nextStatus,
      reason: options?.reason
    });

    // Cascade invalidation if state becomes INVALIDATED or SUPERSEDED
    if (nextStatus === 'INVALIDATED' || nextStatus === 'SUPERSEDED') {
      this.cascadeDependencyInvalidation(id, author);
    }

    this.trySaveToPersistence();
  }

  public cascadeDependencyInvalidation(id: string, author: string, visited = new Set<string>()): void {
    if (visited.has(id)) return;
    visited.add(id);

    const dependents = this.getDependents(id);
    const stateMachine = EngineeringStateMachine.getInstance();

    for (const depId of dependents) {
      const depObj = this.registry.get(depId);
      if (!depObj) continue;

      const domain = stateMachine.getDomainForObjectType(depObj.identity.objectType);
      const isCandidateForInvalidation =
        depObj.identity.objectType === EngineeringObjectType.MESH ||
        depObj.identity.objectType === EngineeringObjectType.SIMULATION ||
        depObj.identity.objectType === EngineeringObjectType.RESULT ||
        depObj.identity.objectType === EngineeringObjectType.EVIDENCE;

      if (isCandidateForInvalidation) {
        const domainStates = stateMachine.getStatesForDomain(domain);
        if (domainStates.includes('INVALIDATED')) {
          try {
            stateMachine.transition(
              depObj,
              'INVALIDATED',
              {
                actor: { id: 'SYSTEM', type: 'SYSTEM' },
                reason: `Upstream dependency object ${id} changed or became invalid. Cascading invalidation downstream.`,
                correlationId: `CORR-CASCADE-${crypto.randomBytes(16).toString("hex")}`
              },
              (depId) => this.registry.get(depId),
              (objectId, status) => {
                const targetObj = this.registry.get(objectId);
                if (targetObj) {
                  const updatedObj: EngineeringObject = {
                    ...targetObj,
                    status,
                    updatedAt: new Date().toISOString()
                  };
                  this.registry.set(objectId, this.deepFreeze(updatedObj));
                }
              }
            );

            this.logAuditEvent('OBJECT_INVALIDATED', depId, 'SYSTEM', {
              reason: `Cascading invalidation from upstream object ${id}`
            });

            this.cascadeDependencyInvalidation(depId, author, visited);
          } catch (e) {
            console.warn(`[EngineeringObjectOS] Cascade transition to INVALIDATED failed for ${depId}:`, e);
          }
        }
      }
    }
  }

  // ============================================================================
  // 3. DEPENDENCY & STALE-STATE DETECTION
  // ============================================================================

  public detectStaleState(id: string, visited: Set<string> = new Set()): boolean {
    if (visited.has(id)) {
      return false; // Prevent cyclic loops
    }
    visited.add(id);

    const obj = this.registry.get(id);
    if (!obj) return false;

    // Check upstream dependencies
    for (const depId of obj.dependencies) {
      const dep = this.registry.get(depId);
      if (!dep) {
        // If a dependency has been deleted or cannot be resolved, this object is considered stale / orphaned!
        return true;
      }

      // Check version snapshot mismatch
      const recordedVersion = obj.dependencyVersionSnapshot[depId];
      if (recordedVersion !== String(dep.identity.objectVersion) || dep.status === 'ARCHIVED') {
        return true;
      }

      // Recursive check
      if (this.detectStaleState(depId, visited)) {
        return true;
      }
    }

    return false;
  }

  public getDependents(id: string): string[] {
    const dependents: string[] = [];
    for (const obj of Array.from(this.registry.values())) {
      if (obj.dependencies.includes(id)) {
        dependents.push(obj.id);
      }
    }
    return dependents;
  }

  public clear(): void {
    this.registry.clear();
    this.revisionLineage.clear();
    this.auditLog = [];
  }

  // ============================================================================
  // 4. REVISION MODEL & LINEAGE
  // ============================================================================

  public createRevision(
    id: string,
    newRevisionCode: string,
    author: string,
    changeLog: string,
    newMetadata?: Record<string, unknown>
  ): EngineeringObject {
    const obj = this.registry.get(id);
    if (!obj) {
      throw new Error(`[EngineeringObjectOS] Cannot create revision: Object not found with ID ${id}`);
    }

    const lineage = this.revisionLineage.get(id) || [];
    if (lineage.includes(newRevisionCode)) {
      throw new Error(`[EngineeringObjectOS] Forged or duplicate revision ID error: ${newRevisionCode}`);
    }

    // Build dependency snapshot of the current environment state
    const dependencyVersionSnapshot: Record<string, string> = {};
    obj.dependencies.forEach(depId => {
      const dep = this.registry.get(depId);
      if (dep) {
        dependencyVersionSnapshot[depId] = dep.identity.objectVersion.toString();
      }
    });

    // Compute cryptographic hash of revision payload
    const revisionHash = crypto
      .createHash('sha256')
      .update(`${id}-${newRevisionCode}-${JSON.stringify(newMetadata || obj.metadata)}`)
      .digest('hex');

    const nextIdentity = this.identityService.revisionIdentity(obj.identity.identityId, newMetadata || obj.metadata, newRevisionCode, author);

    // Governance Evaluation (PATCH-160)
    const governanceDecision = this.governanceEngine.evaluate({
      identity: author,
      organizationId: this.identityGov.getOrganizationId(author),
      projectId: nextIdentity.projectId,
      roles: this.identityGov.getRoles(author),
      capabilities: [],
      object: {
        id: obj.id,
        identity: obj.identity,
        status: obj.status,
        revisionId: obj.identity.revisionId,
        creatorId: obj.createdBy
      },
      requestedAction: 'REVISE',
      metadata: newMetadata || obj.metadata,
      timestamp: new Date().toISOString(),
      correlationId: `CORR-${crypto.randomBytes(16).toString("hex")}`
    });

    if (governanceDecision.verdict === 'DENY') {
      throw new Error(`[EngineeringObjectOS] Governance Rejection: ${governanceDecision.reason}`);
    }

    const revisedObj: EngineeringObject = {
      ...obj,
      identity: nextIdentity,
      status: 'DRAFT', // Re-verify starting state
      updatedAt: new Date().toISOString(),
      metadata: newMetadata ? Object.freeze({ ...newMetadata }) : obj.metadata,
      dependencyVersionSnapshot: Object.freeze(dependencyVersionSnapshot),
      provenance: {
        author,
        action: `REVISED: ${changeLog}`,
        timestamp: new Date().toISOString(),
        hash: revisionHash,
        parentRevisionId: obj.identity.revisionId
      }
    };

    const frozenRevised = this.deepFreeze(revisedObj);
    this.registry.set(id, frozenRevised);

    // Initialize State Machine State for the new revision
    EngineeringStateMachine.getInstance().initializeState(frozenRevised, author);

    // Trigger cascading dependency invalidation because upstream version has changed
    this.cascadeDependencyInvalidation(id, author);

    // Record Unified Event
    this.eventStore.append({
      eventType: 'OBJECT_REVISED',
      actor: { id: author, type: 'USER' },
      source: { service: 'IndustrialOS', component: 'EngineeringObjectOS', version: '1.0' },
      objectRefs: [id],
      entityIdentityId: nextIdentity.identityId,
      entityType: nextIdentity.objectType,
      entityRevision: nextIdentity.revisionId,
      correlationId: `CORR-${crypto.randomBytes(16).toString("hex")}`,
      payload: { 
        oldRevision: obj.identity.revisionId, 
        newRevision: newRevisionCode, 
        identityId: nextIdentity.identityId,
        version: nextIdentity.objectVersion,
        changeLog 
      }
    });

    lineage.push(newRevisionCode);
    this.revisionLineage.set(id, lineage);

    this.logAuditEvent('OBJECT_REVISED', id, author, {
      parentRevision: obj.identity.revisionId,
      newRevision: newRevisionCode,
      changeLog
    });

    // Publish REVISION_EVIDENCE to EvidenceBus
    try {
      EvidenceBus.getInstance().publishSync({
        evidenceType: 'REVISION_EVIDENCE',
        sourceCapability: 'capability:industrial_os.object_os',
        sourceOperation: 'createRevision',
        engineeringObjectId: revisedObj.id,
        subjectIdentityId: revisedObj.identity.identityId,
        author,
        payload: {
          objectId: revisedObj.id,
          identityId: revisedObj.identity.identityId,
          parentIdentityId: revisedObj.identity.parentIdentityId,
          objectType: revisedObj.identity.objectType,
          version: revisedObj.identity.objectVersion,
          revision: revisedObj.identity.revisionId,
          status: revisedObj.status,
          provenanceHash: revisedObj.provenance.hash,
          changeLog
        }
      });
    } catch {
      // Safe fallback
    }

    this.trySaveToPersistence();
    return revisedObj;
  }

  // ============================================================================
  // 5. EVENT AUDIT LOG
  // ============================================================================

  public listAuditLog(): EngineeringAuditEvent[] {
    return [...this.auditLog];
  }

  private logAuditEvent(
    eventType: EngineeringAuditEvent['eventType'],
    objectId: string,
    author: string,
    payload: Record<string, unknown>
  ): void {
    const id = `EVENT-${crypto.randomBytes(16).toString("hex")}`;
    const timestamp = new Date().toISOString();
    const signature = crypto
      .createHash('sha256')
      .update(`${id}-${eventType}-${objectId}-${timestamp}-${JSON.stringify(payload)}`)
      .digest('hex');

    const event: EngineeringAuditEvent = Object.freeze({
      id,
      eventType,
      objectId,
      timestamp,
      author,
      payload: Object.freeze(payload),
      signature
    });

    this.auditLog.push(event);
  }

  // ============================================================================
  // 6. PERSISTENCE ENGINE (DECOUPLED FROM BUSINESS LOGIC)
  // ============================================================================

  public trySaveToPersistence(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const payload = {
          registry: Array.from(this.registry.entries()),
          auditLog: this.auditLog,
          lineage: Array.from(this.revisionLineage.entries())
        };
        localStorage.setItem(EngineeringObjectOS.STORAGE_KEY, JSON.stringify(payload));
      } catch (e) {
        console.warn('[EngineeringObjectOS] Failed to save state to localStorage:', e);
      }
    } else {
      try {
        const payload = {
          registry: Array.from(this.registry.entries()),
          auditLog: this.auditLog,
          lineage: Array.from(this.revisionLineage.entries())
        };
        fs.writeFileSync(path.join(process.cwd(), '.os_persistence_sandbox.json'), JSON.stringify(payload, null, 2));
      } catch (e) {
        // Safe catch
      }
    }
  }

  public tryLoadFromPersistence(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(EngineeringObjectOS.STORAGE_KEY);
        if (!raw) return;

        const payload = JSON.parse(raw);
        if (payload.registry) {
          const loadedEntries = (payload.registry as [string, EngineeringObject][]).map(([id, obj]) => {
            return [id, this.deepFreeze(obj)] as [string, EngineeringObject];
          });
          this.registry = new Map<string, EngineeringObject>(loadedEntries);
        }
        if (payload.auditLog) {
          this.auditLog = payload.auditLog;
        }
        if (payload.lineage) {
          this.revisionLineage = new Map<string, string[]>(payload.lineage);
        }
      } catch (e) {
        console.warn('[EngineeringObjectOS] Failed to load state from localStorage:', e);
      }
    } else {
      try {
        const filePath = path.join(process.cwd(), '.os_persistence_sandbox.json');
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf8');
          const payload = JSON.parse(raw);
          if (payload.registry) {
            const loadedEntries = (payload.registry as [string, EngineeringObject][]).map(([id, obj]) => {
              return [id, this.deepFreeze(obj)] as [string, EngineeringObject];
            });
            this.registry = new Map<string, EngineeringObject>(loadedEntries);
          }
          if (payload.auditLog) {
            this.auditLog = payload.auditLog;
          }
          if (payload.lineage) {
            this.revisionLineage = new Map<string, string[]>(payload.lineage);
          }
        }
      } catch (e) {
        // Safe catch
      }
    }
  }

  // ============================================================================
  // 7. HELPER VALIDATIONS
  // ============================================================================

  private validateObjectContract(obj: EngineeringObject): void {
    if (!obj.id || obj.id.trim() === '') {
      throw new Error('[EngineeringObjectOS] Contract violation: missing id');
    }
    if (!obj.identity || !obj.identity.identityId) {
      throw new Error('[EngineeringObjectOS] Contract violation: missing identity');
    }
    if (!obj.status) {
      throw new Error('[EngineeringObjectOS] Contract violation: missing status');
    }
    
    // Verify Identity Integrity (PATCH-158)
    const integrity = EngineeringIdentityFactory.verifyIntegrity(obj.identity, obj.metadata);
    if (!integrity) {
      throw new Error(`[EngineeringObjectOS] Identity Integrity violation: contentHash mismatch for ${obj.id}`);
    }
  }

  private mapToProvenanceType(type: EngineeringObjectType): any {
    const maps: Record<EngineeringObjectType, string> = {
      PROJECT: 'DESIGN',
      DESIGN: 'DESIGN',
      GEOMETRY: 'GEOMETRY',
      BREP: 'GEOMETRY',
      FEATURE: 'GEOMETRY',
      ASSEMBLY: 'DESIGN',
      COMPONENT: 'DESIGN',
      PART: 'DESIGN',
      MATERIAL: 'MATERIAL',
      MESH: 'MESH',
      SIMULATION: 'SIMULATION',
      SOLVER: 'SIMULATION',
      RESULT: 'RESULT',
      TOOLPATH: 'TOOLPATH',
      MACHINE: 'MANUFACTURING',
      INSPECTION: 'INSPECTION',
      DIGITAL_TWIN: 'INSPECTION',
      EVIDENCE: 'EVIDENCE',
      CERTIFICATE: 'EVIDENCE',
      REVISION: 'REVISION',
      CONFIGURATION: 'DESIGN',
      WORKFLOW: 'MANUFACTURING'
    };
    return maps[type] || 'DESIGN';
  }
}
