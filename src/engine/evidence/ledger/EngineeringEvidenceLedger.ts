/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-161: Engineering Evidence Ledger Core Subsystem
 */

import {
  EngineeringEvidenceRecord,
  EvidenceLedgerEntry,
  EvidenceRegistrationParams,
  EvidenceState,
  CustodyTransitionRecord,
  LedgerVerificationReport,
  EvidenceLedgerVerdict
} from './types';
import { EvidenceCanonicalizer } from './EvidenceCanonicalizer';
import { EvidenceHasher } from './EvidenceHasher';
import { EvidenceIntegrityChecker } from './EvidenceIntegrityChecker';
import { EngineeringEvidenceLedgerVerifier } from './EngineeringEvidenceLedgerVerifier';
import { EvidenceQueryService } from './EvidenceQueryService';
import { EngineeringIdentityService } from '../../identity/EngineeringIdentityService';
import { EngineeringPolicyEngine } from '../../industrial-os/policy/EngineeringPolicyEngine';
import { EnterpriseGovernanceEngine } from '../../industrial-os/governance/EnterpriseGovernanceEngine';
import { EvidenceBus } from '../../industrial-os/evidence-bus/EvidenceBus';
import { EvidenceEnvelope } from '../../industrial-os/evidence-bus/types';

export class EngineeringEvidenceLedger {
  private static instance: EngineeringEvidenceLedger;

  private entries: EvidenceLedgerEntry[] = [];
  private recordsMap: Map<string, EngineeringEvidenceRecord> = new Map();
  private entriesMap: Map<string, EvidenceLedgerEntry> = new Map();
  private custodyHistory: Map<string, CustodyTransitionRecord[]> = new Map();

  private queryService: EvidenceQueryService;

  private policyEngine?: EngineeringPolicyEngine;
  private governanceEngine?: EnterpriseGovernanceEngine;
  private identityService: EngineeringIdentityService;

  public static getInstance(): EngineeringEvidenceLedger {
    if (!EngineeringEvidenceLedger.instance) {
      EngineeringEvidenceLedger.instance = new EngineeringEvidenceLedger();
    }
    return EngineeringEvidenceLedger.instance;
  }

  constructor() {
    this.identityService = EngineeringIdentityService.getInstance();
    this.queryService = new EvidenceQueryService(
      () => this.entries,
      () => this.recordsMap,
      (evidenceId) => this.custodyHistory.get(evidenceId) || []
    );
  }

  /**
   * Configures optional policy and governance engines.
   */
  public setPolicyEngine(policyEngine: EngineeringPolicyEngine): void {
    this.policyEngine = policyEngine;
  }

  public setGovernanceEngine(governanceEngine: EnterpriseGovernanceEngine): void {
    this.governanceEngine = governanceEngine;
  }

  /**
   * Returns query service interface.
   */
  public get query(): EvidenceQueryService {
    return this.queryService;
  }

  /**
   * Returns all entries immutably.
   */
  public getEntries(): readonly EvidenceLedgerEntry[] {
    return [...this.entries];
  }

  /**
   * Registers a new Engineering Evidence Record into the immutable ledger.
   */
  public registerEvidence(params: EvidenceRegistrationParams): EvidenceLedgerEntry {
    // 1. Mandatory Identity Check
    if (!params.producerIdentity) {
      throw new Error('[EngineeringEvidenceLedger] Cannot register evidence without producerIdentity');
    }
    if (!params.engineeringObjectId || !params.objectRevision) {
      throw new Error('[EngineeringEvidenceLedger] Cannot register evidence without engineeringObjectId and objectRevision');
    }

    // 2. Policy Engine Check (if configured)
    if (this.policyEngine) {
      const policyContext = {
        subject: {
          identityId: params.engineeringObjectId,
          objectType: params.evidenceType as any,
          projectId: params.projectId,
          revisionId: params.objectRevision,
          objectVersion: 1,
          createdBy: params.producerIdentity,
          contentHash: EvidenceHasher.hashObject(params.payload),
          timestamp: new Date().toISOString(),
          classification: 'INTERNAL' as any,
          tags: []
        },
        operation: 'REGISTER_EVIDENCE',
        actor: {
          id: params.producerIdentity,
          type: params.producerType as any,
          capabilities: []
        },
        environment: {
          timestamp: new Date().toISOString(),
          stage: 'PRODUCTION' as any
        }
      };
      const evalResult = this.policyEngine.evaluate(policyContext);
      if (evalResult.overallEffect === 'DENY') {
        throw new Error(`[EngineeringEvidenceLedger] Policy violation: Evidence registration denied by policy`);
      }
    }

    // 3. Compute deterministic hashes
    const timestamp = new Date().toISOString();
    const payloadHash = EvidenceHasher.hashObject(params.payload);

    const metadataPayload = {
      evidenceType: params.evidenceType,
      engineeringObjectId: params.engineeringObjectId,
      objectRevision: params.objectRevision,
      projectId: params.projectId,
      organizationId: params.organizationId,
      producerIdentity: params.producerIdentity,
      producerType: params.producerType,
      sourceSystem: params.sourceSystem,
      sourceVersion: params.sourceVersion,
      timestamp
    };
    const metadataHash = EvidenceHasher.hashObject(metadataPayload);

    const resultObj = params.payload?.result || params.payload;
    const resultHash = EvidenceHasher.hashObject(resultObj);

    // 4. Generate stable evidence ID
    const evidenceId = EvidenceHasher.generateStableEvidenceId(
      params.engineeringObjectId,
      params.objectRevision,
      params.evidenceType,
      params.producerIdentity,
      payloadHash
    );

    if (this.recordsMap.has(evidenceId)) {
      // Evidence already registered with exact same identity and payload
      return this.entriesMap.get(evidenceId)!;
    }

    // 5. Construct Canonical Record
    const record: EngineeringEvidenceRecord = {
      evidenceId,
      evidenceType: params.evidenceType,
      engineeringObjectId: params.engineeringObjectId,
      objectRevision: params.objectRevision,
      projectId: params.projectId,
      organizationId: params.organizationId,
      producerIdentity: params.producerIdentity,
      producerType: params.producerType,
      sourceSystem: params.sourceSystem,
      sourceVersion: params.sourceVersion,
      inputReferences: params.inputReferences ? [...params.inputReferences] : [],
      outputReferences: params.outputReferences ? [...params.outputReferences] : [],
      parentEvidence: params.parentEvidence,
      dependencyEvidence: params.dependencyEvidence ? [...params.dependencyEvidence] : [],
      payload: params.payload,
      resultHash,
      payloadHash,
      metadataHash,
      timestamp,
      eventId: params.eventId,
      correlationId: params.correlationId,
      policyContext: params.policyContext,
      verificationStatus: 'REGISTERED',
      supersedes: params.supersedes
    };

    // 6. Compute Cryptographic Entry Link
    const sequenceNumber = this.entries.length;
    const previousEntryHash = sequenceNumber === 0
      ? EvidenceHasher.GENESIS_PREVIOUS_HASH
      : this.entries[sequenceNumber - 1].entryHash;

    const canonicalRecordHash = EvidenceHasher.hashCanonicalRecord(record);
    const entryHash = EvidenceHasher.hashLedgerEntry(
      sequenceNumber,
      evidenceId,
      canonicalRecordHash,
      previousEntryHash
    );

    const entryId = `LEDGER-ENTRY-${sequenceNumber.toString().padStart(6, '0')}`;
    const entry: EvidenceLedgerEntry = {
      sequenceNumber,
      entryId,
      evidenceId,
      record,
      canonicalRecordHash,
      previousEntryHash,
      entryHash,
      registeredAt: timestamp
    };

    // 7. Store immutably
    this.entries.push(entry);
    this.recordsMap.set(evidenceId, record);
    this.entriesMap.set(evidenceId, entry);

    // 8. Track Chain-of-Custody Foundation
    this.recordCustodyTransition({
      who: params.producerIdentity,
      what: 'REGISTER_EVIDENCE',
      when: timestamp,
      whichObject: params.engineeringObjectId,
      whichRevision: params.objectRevision,
      whichEvidence: evidenceId,
      whichPolicy: params.policyContext?.policyId,
      whichPreviousState: 'CREATED',
      whichNewState: 'REGISTERED'
    });

    return entry;
  }

  /**
   * Immutably supersedes an existing evidence record with a newly produced one.
   */
  public supersedeEvidence(
    oldEvidenceId: string,
    newParams: EvidenceRegistrationParams
  ): EvidenceLedgerEntry {
    const oldRecord = this.recordsMap.get(oldEvidenceId);
    if (!oldRecord) {
      throw new Error(`[EngineeringEvidenceLedger] Cannot supersede non-existent evidence: ${oldEvidenceId}`);
    }

    const newEntry = this.registerEvidence({
      ...newParams,
      supersedes: oldEvidenceId
    });

    // Update old record status to SUPERSEDED with link (immutability preserved in chain log)
    const updatedOldRecord: EngineeringEvidenceRecord = {
      ...oldRecord,
      verificationStatus: 'SUPERSEDED',
      supersededBy: newEntry.evidenceId
    };
    this.recordsMap.set(oldEvidenceId, updatedOldRecord);

    this.recordCustodyTransition({
      who: newParams.producerIdentity,
      what: 'SUPERSEDE_EVIDENCE',
      when: new Date().toISOString(),
      whichObject: oldRecord.engineeringObjectId,
      whichRevision: oldRecord.objectRevision,
      whichEvidence: oldEvidenceId,
      whichPreviousState: 'REGISTERED',
      whichNewState: 'SUPERSEDED'
    });

    return newEntry;
  }

  /**
   * Revokes an evidence record with an explicit rationale and actor identity.
   */
  public revokeEvidence(evidenceId: string, reason: string, actor: string): void {
    const oldRecord = this.recordsMap.get(evidenceId);
    if (!oldRecord) {
      throw new Error(`[EngineeringEvidenceLedger] Cannot revoke non-existent evidence: ${evidenceId}`);
    }

    const updatedRecord: EngineeringEvidenceRecord = {
      ...oldRecord,
      verificationStatus: 'REVOKED',
      revocationReason: reason
    };
    this.recordsMap.set(evidenceId, updatedRecord);

    this.recordCustodyTransition({
      who: actor,
      what: `REVOKE_EVIDENCE: ${reason}`,
      when: new Date().toISOString(),
      whichObject: oldRecord.engineeringObjectId,
      whichRevision: oldRecord.objectRevision,
      whichEvidence: evidenceId,
      whichPreviousState: oldRecord.verificationStatus,
      whichNewState: 'REVOKED'
    });
  }

  /**
   * Links and automatically subscribes to an EvidenceBus instance.
   */
  public subscribeToEvidenceBus(bus: EvidenceBus): void {
    bus.subscribe(
      {},
      async (envelope: EvidenceEnvelope) => {
        try {
          this.registerEvidence({
            evidenceType: envelope.evidenceType,
            engineeringObjectId: envelope.correlation?.engineeringObjectId || 'GLOBAL_OBJECT',
            objectRevision: envelope.provenance?.environment || 'REV_01',
            projectId: envelope.correlation?.workflowId || 'DEFAULT_PROJECT',
            organizationId: 'SECP_ORG',
            producerIdentity: envelope.provenance?.producerId || 'ANONYMOUS_PRODUCER',
            producerType: (envelope.provenance?.producerType as any) || 'SERVICE',
            sourceSystem: envelope.provenance?.sourceCapability || 'EVIDENCE_BUS',
            sourceVersion: envelope.identity?.schemaVersion || '1.0.0',
            payload: envelope.payload || {},
            eventId: envelope.correlation?.eventId,
            correlationId: envelope.correlation?.correlationId
          });
        } catch (e: any) {
          console.warn(`[EngineeringEvidenceLedger] Error consuming envelope from EvidenceBus:`, e.message);
        }
      }
    );
  }

  /**
   * Records a chain-of-custody transition log.
   */
  private recordCustodyTransition(input: Omit<CustodyTransitionRecord, 'custodyId' | 'transitionHash'>): void {
    const rawTransition = `${input.who}::${input.what}::${input.when}::${input.whichEvidence}::${input.whichPreviousState}->${input.whichNewState}`;
    const transitionHash = EvidenceHasher.sha256(rawTransition);
    const custodyId = `CUSTODY-${transitionHash.substring(0, 12).toUpperCase()}`;

    const custodyRecord: CustodyTransitionRecord = {
      ...input,
      custodyId,
      transitionHash
    };

    const list = this.custodyHistory.get(input.whichEvidence) || [];
    list.push(custodyRecord);
    this.custodyHistory.set(input.whichEvidence, list);
  }

  /**
   * Resets ledger (primarily for test harness isolation).
   */
  public reset(): void {
    this.entries = [];
    this.recordsMap.clear();
    this.entriesMap.clear();
    this.custodyHistory.clear();
  }
}
