/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-161: Evidence Query Service
 */

import {
  EvidenceLedgerEntry,
  EngineeringEvidenceRecord,
  LedgerVerificationReport,
  EvidenceLineageInfo,
  CustodyTransitionRecord
} from './types';
import { EngineeringEvidenceLedgerVerifier } from './EngineeringEvidenceLedgerVerifier';

export class EvidenceQueryService {
  constructor(
    private readonly getEntries: () => readonly EvidenceLedgerEntry[],
    private readonly getRecordsMap: () => Map<string, EngineeringEvidenceRecord>,
    private readonly getCustodyHistory: (evidenceId: string) => readonly CustodyTransitionRecord[]
  ) {}

  /**
   * Verifies the full ledger chain through independent hash recalculation.
   */
  public verifyLedger(): LedgerVerificationReport {
    return EngineeringEvidenceLedgerVerifier.verifyLedger(this.getEntries());
  }

  /**
   * Returns an evidence record by its evidence ID.
   */
  public getEvidence(evidenceId: string): EngineeringEvidenceRecord | undefined {
    return this.getRecordsMap().get(evidenceId);
  }

  /**
   * Returns an entry by its evidence ID.
   */
  public getEntry(evidenceId: string): EvidenceLedgerEntry | undefined {
    return this.getEntries().find((e) => e.evidenceId === evidenceId);
  }

  /**
   * Returns all entries.
   */
  public getAllEntries(): readonly EvidenceLedgerEntry[] {
    return this.getEntries();
  }

  /**
   * Returns all entries matching an engineering object ID.
   */
  public getByEngineeringObjectId(objectId: string): readonly EvidenceLedgerEntry[] {
    return this.getEntries().filter((e) => e.record.engineeringObjectId === objectId);
  }

  /**
   * Returns all entries matching an engineering object ID and revision.
   */
  public getByObjectAndRevision(objectId: string, revision: string): readonly EvidenceLedgerEntry[] {
    return this.getEntries().filter(
      (e) => e.record.engineeringObjectId === objectId && e.record.objectRevision === revision
    );
  }

  /**
   * Reconstructs full lineage for an evidence record, computing lineage depth and relationships.
   */
  public getEvidenceLineage(evidenceId: string): EvidenceLineageInfo {
    const records = this.getRecordsMap();
    const current = records.get(evidenceId);

    if (!current) {
      return {
        evidenceId,
        childEvidence: [],
        inputEvidence: [],
        derivedFrom: [],
        verifiedBy: [],
        depth: 0
      };
    }

    // Traverse upwards to compute depth and ancestors
    let depth = 0;
    let currParent = current.parentEvidence;
    const visited = new Set<string>([evidenceId]);
    const derivedFrom: string[] = [];

    while (currParent) {
      if (visited.has(currParent)) {
        // Cycle detected
        break;
      }
      visited.add(currParent);
      derivedFrom.push(currParent);
      depth++;

      const parentRecord = records.get(currParent);
      currParent = parentRecord?.parentEvidence;
    }

    // Find children
    const childEvidence: string[] = [];
    for (const [id, rec] of records.entries()) {
      if (rec.parentEvidence === evidenceId) {
        childEvidence.push(id);
      }
    }

    return {
      evidenceId,
      parentEvidence: current.parentEvidence,
      childEvidence,
      inputEvidence: current.inputReferences || [],
      derivedFrom,
      verifiedBy: [],
      supersedes: current.supersedes,
      supersededBy: current.supersededBy,
      depth
    };
  }

  /**
   * Reconstructs the ordered lineage path from rootId down to leafId.
   */
  public getEvidenceChain(rootId: string, leafId: string): EvidenceLedgerEntry[] {
    const records = this.getRecordsMap();
    const entries = this.getEntries();
    const entryMap = new Map<string, EvidenceLedgerEntry>();
    for (const entry of entries) {
      entryMap.set(entry.evidenceId, entry);
    }

    const path: EvidenceLedgerEntry[] = [];
    let currentId: string | undefined = leafId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const entry = entryMap.get(currentId);
      if (entry) {
        path.unshift(entry);
      }

      if (currentId === rootId) {
        break;
      }

      const rec = records.get(currentId);
      currentId = rec?.parentEvidence;
    }

    if (path.length > 0 && path[0].evidenceId === rootId) {
      return path;
    }

    return [];
  }

  /**
   * Retrieves custody history for an evidence item.
   */
  public getCustody(evidenceId: string): readonly CustodyTransitionRecord[] {
    return this.getCustodyHistory(evidenceId);
  }
}
