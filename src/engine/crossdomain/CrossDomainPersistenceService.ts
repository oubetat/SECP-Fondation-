/**
 * SECP Industrial OS — M9 Cross-Domain Persistence Service
 * 
 * Persists cross-domain handoffs and conflict records to IndexedDB key-value store,
 * and rehydrates them upon system startup or test reset.
 */
import { IndexedDbEngine } from '../storage/IndexedDbEngine';
import { CrossDomainWorkflowEngine } from './CrossDomainWorkflowEngine';
import { CrossDomainConflictEngine } from './CrossDomainConflictEngine';
import { CrossDomainHandoffRecord, CrossDomainConflictRecord } from './CrossDomainTypes';

export class CrossDomainPersistenceService {
  private static readonly HANDOFFS_KEY = 'secp:m9:cross-domain-handoffs';
  private static readonly CONFLICTS_KEY = 'secp:m9:cross-domain-conflicts';

  /**
   * Persists all active handoffs and conflicts to durable IndexedDB storage.
   */
  public static async persistAll(): Promise<boolean> {
    try {
      const allConflicts = CrossDomainConflictEngine.getAllConflicts();
      // Collect handoffs
      const allHandoffs: CrossDomainHandoffRecord[] = [];
      for (const c of allConflicts) {
        const hList = CrossDomainWorkflowEngine.getHandoffs(c.engineeringObjectId);
        for (const h of hList) {
          if (!allHandoffs.some(x => x.handoffId === h.handoffId)) {
            allHandoffs.push(h);
          }
        }
      }

      await IndexedDbEngine.setKeyValue(this.CONFLICTS_KEY, allConflicts);
      await IndexedDbEngine.setKeyValue(this.HANDOFFS_KEY, allHandoffs);
      return true;
    } catch (err) {
      console.warn('[CrossDomainPersistenceService] Failed to persist cross-domain state:', err);
      return false;
    }
  }

  /**
   * Rehydrates cross-domain state from durable IndexedDB storage.
   */
  public static async rehydrate(): Promise<{ handoffsCount: number; conflictsCount: number }> {
    try {
      const conflicts = await IndexedDbEngine.getKeyValue<CrossDomainConflictRecord[]>(this.CONFLICTS_KEY);
      if (conflicts && Array.isArray(conflicts)) {
        CrossDomainConflictEngine.rehydrate(conflicts);
      }

      const handoffs = await IndexedDbEngine.getKeyValue<CrossDomainHandoffRecord[]>(this.HANDOFFS_KEY);
      if (handoffs && Array.isArray(handoffs)) {
        CrossDomainWorkflowEngine.rehydrate(handoffs);
      }

      return {
        handoffsCount: handoffs ? handoffs.length : 0,
        conflictsCount: conflicts ? conflicts.length : 0
      };
    } catch (err) {
      console.warn('[CrossDomainPersistenceService] Failed to rehydrate cross-domain state:', err);
      return { handoffsCount: 0, conflictsCount: 0 };
    }
  }
}
