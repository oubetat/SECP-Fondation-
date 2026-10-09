# SECP GAP-03 — Canonical Revision Impact Invalidation: Forensic Discovery Report

**Document ID**: `SECP-GAP-03-FORENSIC-DISCOVERY.md`  
**Date**: September 28, 2026  
**Scope**: Forensic Audit of SECP RevisionEngine, RevisionImpactAnalyzer, CoreExecutionAuthority, GenericExecutionRegistry, and ADSE-P8 Control Engine.

---

## 1. Executive Summary

This forensic discovery report investigates the architectural mechanics of revision creation, revision hash computation, dependency tracking, impact analysis, and execution invalidation across the SECP platform.

The objective is to establish the exact truth regarding how canonical revision changes propagate to downstream consumers (including ADSE-P8 Controls) and whether SECP possesses an active push-based subscription mechanism or a pull/query-based impact analysis contract.

---

## 2. Source Code Forensic Findings

### 2.1 Revision Creation & Hash Computation (`RevisionEngine.ts`)
- **Creation**: `RevisionEngine.createRevision(revision)` validates parent revision links, verifies code uniqueness per entity, and computes hashes.
- **Hash Formula**: 
  - `contentHash = RevisionCanonicalizer.computeContentHash(content)`
  - `dependencyHash = RevisionCanonicalizer.computeDependencyHash(dependencies)`
  - `revisionHash = RevisionCanonicalizer.computeRevisionHash(revision)`
- **Immutability**: Once a revision transitions to `RELEASED`, `OBSOLETE`, or `SUPERSEDED`, `updateContent()` throws `IMMUTABLE_REVISION`. Any new change requires `checkoutRevision()`, which creates a new revision with an incremented `revisionCode` and a new unique `revisionHash`.

### 2.2 Dependency Tracking (`RevisionEngine.ts` & `types.ts`)
- Revisions explicitly store `dependencies: DependencySnapshot[]`.
- Each `DependencySnapshot` records:
  - `entityId`: Canonical identifier of upstream dependency.
  - `revisionId`: Specific revision ID or `'LATEST'` or `isFloating: true`.
  - `type`: Dependency classification (e.g. `DERIVES_FROM`, `SIMULATES`, `CONSTRAINED_BY`).

### 2.3 Impact Analysis Mechanics (`RevisionImpactAnalyzer.ts`)
- `RevisionImpactAnalyzer.analyzeImpact(changedRev, allRevisions)` performs a breadth-first search (BFS) across all known revisions in `RevisionEngine`.
- For every revision `rev` that lists `changedRev.entityId` or `changedRev.revisionId` in its `dependencies`, `RevisionImpactAnalyzer` classifies impact severity (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) and assigns status (`STALE` or `AFFECTED`).
- `EVIDENCE`, `FEM_STUDY`, `CFD_STUDY`, `CAM_JOB`, and `DRAWING` entity types are marked as `STALE` with `HIGH` or `CRITICAL` severity.

### 2.4 Existing Observer / Event / Subscriber Mechanism Analysis
- **Finding**: `RevisionEngine` does **NOT** maintain an internal event bus, observer list, or push-subscription callback registry.
- **Classification**: **CASE B — Push Subscription Mechanism Does Not Exist**.
- **Architecture**: SECP employs a **query-based / pull-based impact analysis contract**. Consumers (such as P8, P5, P6, P7) query `RevisionEngine.getImpact(revisionId)` or evaluate canonical revision changes via `RevisionImpactAnalyzer`.

### 2.5 Execution & Result Binding (`CoreExecutionAuthority.ts` & `GenericExecutionRegistry.ts`)
- **Execution Request**: `CoreExecutionRequest` requires `engineeringObjectId` and `revisionId`.
- **Revision Lookup**: `CoreExecutionAuthority` queries `RevisionEngine.getRevision(request.revisionId)` to resolve the canonical `revisionHash`.
- **Execution Identity**: `executionId` is deterministically computed from `(engineeringObjectId, executionKind, geometryHash, inputDigest, pluginId, pluginVersion, revisionHash, solverIdentity)`.
- **Binding Verification**: `GenericExecutionRegistry.verifyResultBinding(candidate, expectedRevisionHash)` compares the candidate envelope's `revisionHash` against the target `expectedRevisionHash`. If they differ, it returns `{ isValid: false, failureReason: 'REVISION_MISMATCH' }`.

### 2.6 Persistence of Invalidated Records (`GenericExecutionRegistry.ts` & `ControlPersistenceEngine.ts`)
- Historical execution envelopes and evidence records are immutable and stored permanently in `GenericExecutionRegistry` (persisted to `IndexedDbEngine` under `SECP_AUTHORITATIVE_EXECUTION_LEDGER`).
- Invalidation does NOT delete or overwrite historical records. Stale results remain preserved in provenance history, but their status is updated to `INVALIDATED` / `STALE` and they are rejected when querying current canonical truth.

---

## 3. Architecture Classification Verdict

```
===============================================================================
SECP REVISION IMPACT ARCHITECTURE CLASSIFICATION: CASE B
===============================================================================
- Existing Push-Subscription Observer in RevisionEngine: ABSENT
- Existing Query-Based Impact Analyzer (RevisionImpactAnalyzer): PRESENT & PROVEN
- Core Execution Identity Isolation (CoreExecutionAuthority): PRESENT & PROVEN
- Result Binding Verification (GenericExecutionRegistry): PRESENT & PROVEN
===============================================================================
Verdict: SECP uses a query-based impact analyzer contract. To satisfy GAP-03,
ADSE-P8 must consume RevisionEngine.getImpact() and RevisionImpactAnalyzer,
binding canonical revision changes to P8 execution/result invalidation without
creating a parallel revision authority inside P8.
===============================================================================
```
