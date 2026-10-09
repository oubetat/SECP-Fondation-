/**
 * SECP Industrial OS v2 — PATCH-157: Evidence Storage Adapter
 * Append-only immutable evidence store and quarantine repository.
 */

const fs = null;
const path = null;
import { EvidenceEnvelope, QuarantinedEvidence, EvidenceQueryCriteria } from './types';
import { EvidenceEnvelopeFactory } from './EvidenceEnvelopeFactory';

export interface IEvidenceStorageAdapter {
  append(envelope: EvidenceEnvelope): void;
  getById(evidenceId: string): EvidenceEnvelope | undefined;
  getAll(): readonly EvidenceEnvelope[];
  count(): number;
  quarantine(quarantineRecord: QuarantinedEvidence): void;
  getQuarantined(): readonly QuarantinedEvidence[];
  query(criteria: EvidenceQueryCriteria): EvidenceEnvelope[];
  getMemoryFootprint(): number;
  clear(): void;
}

export class InMemoryEvidenceStorageAdapter implements IEvidenceStorageAdapter {
  private log: EvidenceEnvelope[] = [];
  private index = new Map<string, EvidenceEnvelope>();
  private quarantined: QuarantinedEvidence[] = [];

  private static readonly STORAGE_KEY = 'SECP_ENGINEERING_EVIDENCE_STORE';
  private static readonly QUARANTINE_KEY = 'SECP_ENGINEERING_EVIDENCE_QUARANTINE';

  constructor(private enablePersistence: boolean = true) {
    if (this.enablePersistence) {
      this.tryLoadFromPersistence();
    }
  }

  public append(envelope: EvidenceEnvelope): void {
    if (this.index.has(envelope.evidenceId)) {
      throw new Error(`[EvidenceStorageAdapter] Duplicate evidence ID: ${envelope.evidenceId}`);
    }

    const frozen = EvidenceEnvelopeFactory.deepFreeze(envelope);
    this.log.push(frozen);
    this.index.set(frozen.evidenceId, frozen);

    if (this.enablePersistence) {
      this.trySaveToPersistence();
    }
  }

  public update(envelope: EvidenceEnvelope): void {
    const existing = this.index.get(envelope.evidenceId);
    if (!existing) {
      throw new Error(`[EvidenceStorageAdapter] Cannot update non-existent evidence: ${envelope.evidenceId}`);
    }

    const frozen = EvidenceEnvelopeFactory.deepFreeze(envelope);
    const idx = this.log.findIndex(e => e.evidenceId === envelope.evidenceId);
    if (idx >= 0) {
      this.log[idx] = frozen;
    }
    this.index.set(frozen.evidenceId, frozen);

    if (this.enablePersistence) {
      this.trySaveToPersistence();
    }
  }

  public getById(evidenceId: string): EvidenceEnvelope | undefined {
    return this.index.get(evidenceId);
  }

  public getAll(): readonly EvidenceEnvelope[] {
    return [...this.log];
  }

  public count(): number {
    return this.log.length;
  }

  public quarantine(quarantineRecord: QuarantinedEvidence): void {
    this.quarantined.push(Object.freeze({ ...quarantineRecord }));
    if (this.enablePersistence) {
      this.trySaveToPersistence();
    }
  }

  public getQuarantined(): readonly QuarantinedEvidence[] {
    return [...this.quarantined];
  }

  public query(criteria: EvidenceQueryCriteria): EvidenceEnvelope[] {
    let results = this.log.filter(ev => {
      if (criteria.evidenceType) {
        if (Array.isArray(criteria.evidenceType)) {
          if (!criteria.evidenceType.includes(ev.evidenceType)) return false;
        } else {
          if (ev.evidenceType !== criteria.evidenceType) return false;
        }
      }

      if (criteria.sourceCapability) {
        if (Array.isArray(criteria.sourceCapability)) {
          if (!criteria.sourceCapability.includes(ev.provenance.sourceCapability)) return false;
        } else {
          if (ev.provenance.sourceCapability !== criteria.sourceCapability) return false;
        }
      }

      if (criteria.sourceOperation && ev.provenance.sourceOperation !== criteria.sourceOperation) {
        return false;
      }

      if (criteria.engineeringObjectId && ev.correlation.engineeringObjectId !== criteria.engineeringObjectId) {
        return false;
      }

      if (criteria.workflowId && ev.correlation.workflowId !== criteria.workflowId) {
        return false;
      }

      if (criteria.runId && ev.correlation.runId !== criteria.runId) {
        return false;
      }

      if (criteria.eventId && ev.correlation.eventId !== criteria.eventId) {
        return false;
      }

      if (criteria.parentEvidenceId && ev.correlation.parentEvidenceId !== criteria.parentEvidenceId) {
        return false;
      }

      if (criteria.correlationId && ev.correlation.correlationId !== criteria.correlationId) {
        return false;
      }

      if (criteria.tag && (!ev.correlation.tags || !ev.correlation.tags.includes(criteria.tag))) {
        return false;
      }

      if (criteria.minSequence !== undefined && ev.identity.sequence < criteria.minSequence) {
        return false;
      }

      if (criteria.maxSequence !== undefined && ev.identity.sequence > criteria.maxSequence) {
        return false;
      }

      if (criteria.startTime && new Date(ev.identity.timestamp) < new Date(criteria.startTime)) {
        return false;
      }

      if (criteria.endTime && new Date(ev.identity.timestamp) > new Date(criteria.endTime)) {
        return false;
      }

      return true;
    });

    if (criteria.sortDirection === 'DESC') {
      results = results.sort((a, b) => b.identity.sequence - a.identity.sequence);
    } else {
      results = results.sort((a, b) => a.identity.sequence - b.identity.sequence);
    }

    const offset = criteria.offset || 0;
    const limit = criteria.limit !== undefined ? criteria.limit : results.length;

    return results.slice(offset, offset + limit);
  }

  public getMemoryFootprint(): number {
    let bytes = 0;
    for (const ev of this.log) {
      bytes += JSON.stringify(ev).length * 2;
    }
    for (const q of this.quarantined) {
      bytes += JSON.stringify(q).length * 2;
    }
    return bytes;
  }

  public clear(): void {
    this.log = [];
    this.index.clear();
    this.quarantined = [];
  }

  // ============================================================================
  // PERSISTENCE ADAPTER HELPERS
  // ============================================================================

  private isPersistScheduled = false;

  private trySaveToPersistence(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(InMemoryEvidenceStorageAdapter.STORAGE_KEY, JSON.stringify(this.log));
        localStorage.setItem(InMemoryEvidenceStorageAdapter.QUARANTINE_KEY, JSON.stringify(this.quarantined));
      } catch (e) {
        // Warning
      }
    } else if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
      if (!this.isPersistScheduled) {
        this.isPersistScheduled = true;
        const scheduler = typeof setImmediate !== 'undefined' ? setImmediate : setTimeout;
        scheduler(() => {
          this.isPersistScheduled = false;
          try {
            // Lazy load node modules
            const fsNode = require('fs');
            const pathNode = require('path');
            const filePath = pathNode.join(process.cwd(), '.engineering_evidence_store.json');
            fsNode.writeFileSync(
              filePath,
              JSON.stringify({ log: this.log, quarantined: this.quarantined }, null, 2)
            );
          } catch (e) {
            // Safe catch
          }
        }, 0);
      }
    }
  }

  private tryLoadFromPersistence(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const rawLog = localStorage.getItem(InMemoryEvidenceStorageAdapter.STORAGE_KEY);
        if (rawLog) {
          const items: EvidenceEnvelope[] = JSON.parse(rawLog);
          items.forEach(ev => {
            const frozen = EvidenceEnvelopeFactory.deepFreeze(ev);
            this.log.push(frozen);
            this.index.set(frozen.evidenceId, frozen);
          });
        }
        const rawQ = localStorage.getItem(InMemoryEvidenceStorageAdapter.QUARANTINE_KEY);
        if (rawQ) {
          this.quarantined = JSON.parse(rawQ);
        }
      } catch (e) {
        // Warning
      }
    } else if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
      try {
        const fsNode = require('fs');
        const pathNode = require('path');
        const filePath = pathNode.join(process.cwd(), '.engineering_evidence_store.json');
        if (fsNode.existsSync(filePath)) {
          const content = fsNode.readFileSync(filePath, 'utf8');
          const data = JSON.parse(content);
          if (data.log && Array.isArray(data.log)) {
            data.log.forEach((ev: EvidenceEnvelope) => {
              const frozen = EvidenceEnvelopeFactory.deepFreeze(ev);
              this.log.push(frozen);
              this.index.set(frozen.evidenceId, frozen);
            });
          }
          if (data.quarantined && Array.isArray(data.quarantined)) {
            this.quarantined = data.quarantined;
          }
        }
      } catch (e) {
        // Safe catch
      }
    }
  }
}
