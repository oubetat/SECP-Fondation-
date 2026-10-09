/**
 * SECP Industrial OS v3 — PROMPT-054: React Hook for Canonical Synchronization
 * Provides React components with subscription access to CanonicalStateProjectionSnapshots.
 * Enforces ZERO component-local engineering state.
 */

import { useState, useEffect } from 'react';
import { StateSyncEngine } from '../engine/sync/StateSyncEngine';
import { CanonicalStateProjectionSnapshot } from '../engine/sync/SyncTypes';

export function useCanonicalSync(documentId: string): {
  snapshot: CanonicalStateProjectionSnapshot | undefined;
  setSelectedFeature: (featureId?: string) => void;
  setSelectedTopology: (selection?: any) => void;
  hasDivergence: boolean;
  divergenceReasons: string[];
} {
  const syncEngine = StateSyncEngine.getInstance();
  const [snapshot, setSnapshot] = useState<CanonicalStateProjectionSnapshot | undefined>(() =>
    syncEngine.getSnapshot(documentId)
  );

  useEffect(() => {
    const updateListener = (newSnapshot: CanonicalStateProjectionSnapshot) => {
      setSnapshot(newSnapshot);
    };

    const unsubscribe = syncEngine.subscribe(documentId, updateListener);

    // Initial fetch check
    const current = syncEngine.getSnapshot(documentId);
    if (current && current.revision !== snapshot?.revision) {
      setSnapshot(current);
    }

    return () => {
      unsubscribe();
    };
  }, [documentId]);

  const setSelectedFeature = (featureId?: string) => {
    const updated = syncEngine.setSelectedFeature(documentId, featureId);
    if (updated) setSnapshot(updated);
  };

  const setSelectedTopology = (selection?: any) => {
    const updated = syncEngine.setSelectedTopology(documentId, selection);
    if (updated) setSnapshot(updated);
  };

  const divergenceCheck = snapshot
    ? syncEngine.detectDivergence(documentId, {
        claimedRevision: snapshot.revision,
        featureCount: snapshot.featureTree.length,
        parameterCount: snapshot.properties.items.length,
        status: snapshot.status.status
      })
    : { hasDivergence: false, reasons: [] };

  return {
    snapshot,
    setSelectedFeature,
    setSelectedTopology,
    hasDivergence: divergenceCheck.hasDivergence,
    divergenceReasons: divergenceCheck.reasons
  };
}
