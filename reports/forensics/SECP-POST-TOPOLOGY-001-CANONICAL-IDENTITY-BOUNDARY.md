# SECP — POST-TOPOLOGY-001: CANONICAL TOPOLOGY IDENTITY & DERIVATION BOUNDARY FORENSIC REPORT

**Document Identifier**: SECP-POST-TOPOLOGY-001-CANONICAL-IDENTITY-BOUNDARY  
**Timestamp**: 2026-09-24T06:15:00Z  
**Audit Scope**: Read-Only Forensic Audit of CAD Revision, B-Rep Topology, Feature Tree, CAM Toolpath, and QualityGate Metrology Binding Boundaries  
**Auditor**: SECP Senior Forensic Systems Architect  

---

## 1. EXECUTIVE SUMMARY & PRIMARY ROOT QUESTION VERDICT

### Primary Root Question
When B-Rep / Topology / Feature / CAM data is generated or consumed in SECP, is it treated as:
- **A)** An immutable cryptographic/lineage derivative strictly bound to a specific CAD Revision Hash (where any modification or cross-revision re-association fails validation immediately)?
- **B)** Volatile, re-extractable, or re-associated structural data where topology/features can be re-bound to another revision or modified in-memory/transit without breaking canonical identity proof?

### Authoritative Verdict

$$\mathbf{PRIMARY\_ROOT\_VERDICT = OPTION\_B}$$

**Topology, Features, and CAM Toolpaths in SECP are Volatile, Re-extractable Derived Lineage Artifacts (Option B).**

They are identified using semantic naming tags (`Part/Box_01/TopFace`), local index integers, or geometric signatures (centroids/normals/measures). They are **NOT** cryptographically bound to the root **Canonical CAD Revision Hash** (`cadRevisionHash`). Topology references from Revision $N$ can be rebound to regenerated geometry at Revision $N+1$ via `TopologyLineageProofEngine.rebindReference()`, returning `state: 'REBOUND'` without invalidating the underlying canonical revision.

---

## 2. FORENSIC STATE & AUTHORITATIVE MATRIX

| Metric / Boundary | Authoritative Forensic State | Evidence / Source File |
| :--- | :--- | :--- |
| **PRIMARY ROOT VERDICT** | **`OPTION_B_VOLATILE_DERIVED_ARTIFACT`** | Forensic Audit across `src/engine/topology/` and `src/engine/revision/` |
| **Canonical Engineering Authority** | `RevisionEngine` / `RevisionCanonicalizer` | `src/engine/revision/RevisionEngine.ts` |
| **Topology Identity Role** | **Derived Lineage Artifact** (Non-Authoritative) | `src/engine/topology/PersistentTopologyTypes.ts` |
| **CAM Toolpath Identity Role** | **Derived Manufacturing Artifact** (Non-Authoritative) | `src/engine/cam/CAMProvenanceEngine.ts` |
| **Cryptographic Topology-to-Revision Binding** | **`ABSENT`** (Unbound) | `TopologyLineageProofEngine.ts` (lines 87–396) |
| **Cross-Revision Topology Rebind Detection** | **`PERMITTED_BY_DESIGN`** (`REBOUND` state) | `TopologyLineageProofEngine.ts` (lines 412–437) |
| **Cross-Revision CAM Replay Detection** | **`NOT_ENFORCED_IN_KERNEL`** | `CAMProvenanceEngine.ts` (lines 21–36) |
| **QualityGate Authority Path** | **`PROVEN / FAIL-CLOSED`** | `src/engine/quality-metrology/MetrologyEngine.ts` |
| **Production Code Modified** | **`NO`** | READ-ONLY AUDIT STRICTLY ENFORCED |
| **Tests Modified** | **`NO`** | READ-ONLY AUDIT STRICTLY ENFORCED |
| **Physical Provisioning Status** | **`NOT_PROVISIONED`** | `CyberPhysicalCanonicalAdapter.ts` (line 77) |
| **Field Proven Status** | **`NO`** | System Architectural Baseline |

---

## 3. ANSWERS TO MANDATORY FORENSIC QUESTIONS (Q1 – Q5)

### Q1: How is a topology entity (Face ID, Edge ID, B-Rep Body, Feature) identified in SECP? Is it deterministically derived from CAD Revision Hash or purely local / sequence-based?

**Answer: Topology entities are identified via local sequence numbers, feature-relative semantic string tags, and geometric signatures. They are NOT derived from or cryptographically bound to the CAD Revision Hash.**

#### Code Evidence:
1. **`PersistentTopologyTypes.ts` (lines 23–32)**:
   ```typescript
   export interface PersistentTopologyIdentity {
     persistentId: string;         // e.g. "Part/Box_01/TopFace" or "Part/Pocket_01/WallFace[0]"
     featureId: string;            // Source feature ID
     entityType: TopologicalEntityType;
     localIndex: number;
     semanticTag: string;          // e.g. "TopFace", "BottomFace", "SideFace[0]"
     geometricSignature: GeometricSignature;
     parentPersistentIds: string[];
     revision: number;             // Integer sequence counter (e.g. 1, 2)
   }
   ```
   *Note: There is no `cadRevisionHash` field in `PersistentTopologyIdentity`.*

2. **`TopologicalNamingEngine.ts` (lines 253–264)**:
   ```typescript
   private createIdentity(...): PersistentTopologyIdentity {
     const persistentId = `Part/${featureId}/${semanticTag}`;
     return { persistentId, featureId, entityType, localIndex, semanticTag, geometricSignature, parentPersistentIds, revision: 1 };
   }
   ```
   *Note: The persistent ID is a local string concatenation of `featureId` and `semanticTag`.*

3. **`TopologyLineageProofEngine.ts` (lines 93–115)**:
   ```typescript
   export static createFaceReference(doc: EngineeringDocument, featureId: string, face: Face, bodyId: string): CanonicalTopologyReference {
     const signature = PersistentTopologyNaming.computeGeometricSignature(face);
     const semanticRole = this.determineFaceSemanticRole(face);
     const persistentId = face.persistentId || `${featureId}:FACE:${semanticRole}`;
     return {
       referenceId: `REF_FACE_${face.id}_REV_${doc.revision}`,
       documentId: doc.documentId,
       documentRevision: doc.revision, // INTEGER counter (e.g. 1), NOT SHA-256 cadRevisionHash
       ...
     };
   }
   ```
   *`documentRevision` is an integer sequence counter (`doc.revision`), not the 64-character hex `cadRevisionHash` generated by `RevisionCanonicalizer.computeRevisionHash()`.*

---

### Q2: Can a feature/toolpath generated from Revision A be presented as valid for Revision B if geometry is identical or modified? Does SECP detect cross-revision feature/toolpath replay?

**Answer: YES, a feature/topology reference or CAM toolpath generated for Revision A CAN be presented and accepted for Revision B if the topological tags or geometry match. SECP does NOT detect cross-revision topology or toolpath replay at the kernel level because topology and toolpaths carry no cryptographic binding to `cadRevisionHash`.**

#### Code Evidence:
1. **Topology Rebinding (`TopologyLineageProofEngine.ts`, lines 281–396 & 412–437)**:
   When geometry is regenerated at `newRevision` ($B$), `TopologyLineageProofEngine.rebindReference(referenceFromRevA, newSolid, revisionB)` evaluates candidate faces.
   ```typescript
   const exactTagMatches = candidateFaces.filter(f => f.persistentId === targetTag);
   if (exactTagMatches.length === 1) {
     const match = exactTagMatches[0];
     return {
       success: true,
       state: 'REBOUND',
       reboundEntity: match,
       reason: `Direct persistent naming tag match: '${targetTag}' -> Face '${match.id}'`
     };
   }
   ```
   The engine successfully rebinds reference $A$ to solid $B$ and marks `state: 'REBOUND'`, treating it as completely valid downstream without checking if $B$'s `cadRevisionHash` matches $A$'s `cadRevisionHash`.

2. **CAM Toolpath Replay (`CAMProvenanceEngine.ts`, lines 21–36)**:
   ```typescript
   public static async generateNCProvenanceChain(config: any, points: any[], machine: any, subsystems: any) {
     const trajectoryHash = await generateDeterministicHash({
       op: config.operationId,
       pointCount: points.length,
       firstPoint: points[0],
       lastPoint: points[points.length - 1]
     });
     ...
   }
   ```
   The `trajectoryHash` is calculated strictly from `operationId`, `pointCount`, `firstPoint`, and `lastPoint`. It contains **no reference** to `cadRevisionHash`.
3. **`CamAdversarialSuite.ts` (lines 77–89)** confirms that generating toolpaths for two separate job calls with the same parameters produces identical trajectory hashes regardless of CAD revision context:
   ```typescript
   const job1 = await ParametricCAMBridge.generateForensicCAMJob('p1', topologyId, topologyHash, stock);
   const job2 = await ParametricCAMBridge.generateForensicCAMJob('p1', topologyId, topologyHash, stock);
   // Hash is identical because cadRevisionHash is not in the provenance calculation.
   ```

---

### Q3: Is there any mechanism where a topology ID (e.g. `face-001` or B-Rep hash) can exist without a cryptographically bound `cadRevisionHash`?

**Answer: YES. In fact, ALL topology IDs, B-Rep hashes, feature tree nodes, and CAM toolpaths in SECP currently exist WITHOUT a cryptographically bound `cadRevisionHash`.**

#### Audit Results Across All Target Engines:
- **`src/engine/topology/PersistentTopologyTypes.ts`**: Contains zero references to `cadRevisionHash` or cryptographic revision signatures.
- **`src/engine/topology/ForensicTopologyValidator.ts`**: Computes a `determinismHash` from vertex/edge/face counts and Euler characteristic ($V - E + F$):
  ```typescript
  const euler = counts.vertices - counts.edges + counts.faces;
  const determinismSource = JSON.stringify({ counts, euler, isValid, violationCount: violations.length });
  const determinismHash = this.simpleHash(determinismSource);
  ```
  This hash is purely topological and has no cryptographic linkage to `cadRevisionHash`.
- **`src/engine/features/FeatureTree.ts`**: `getFeatureTreeHash()` computes a deterministic hash from feature names, parameters, and suppression states, detached from `cadRevisionHash`.

---

### Q4: What is the exact relationship between the 5 key identity/hash structures in SECP?

The 5 identity structures in SECP operate as **decoupled parallel silos** rather than a unified cryptographic Merkle hierarchy:

```
[ 1. Canonical CAD Revision Hash ]  ---> Managed by RevisionEngine (RevisionCanonicalizer)
        │  (Unlinked)
        ▼
[ 2. B-Rep Topology Hash ]           ---> Managed by TopologicalNamingEngine / ForensicTopologyValidator
        │  (Unlinked)
        ▼
[ 3. Feature Tree Hash ]             ---> Managed by FeatureTree (getFeatureTreeHash)
        │  (Unlinked)
        ▼
[ 4. CAM Toolpath Hash ]             ---> Managed by CAMProvenanceEngine (generateNCProvenanceChain)
        │  (Unlinked)
        ▼
[ 5. QualityGate Certificate ]       ---> Managed by MetrologyEngine / CyberPhysicalCanonicalAdapter
```

#### Detailed Breakdown Table:

| Layer / Hash Structure | Source Engine | Computation Inputs | Contains `cadRevisionHash`? |
| :--- | :--- | :--- | :---: |
| **1. Canonical CAD Revision Hash** (`revisionHash`) | `RevisionEngine.ts` / `RevisionCanonicalizer.ts` | `entityId`, `revisionCode`, `contentHash`, `dependencyHash`, `effectivity` | **N/A** (Is Root Hash) |
| **2. B-Rep Topology Hash** (`fingerprintHash` / `determinismHash`) | `TopologicalNamingEngine.ts` / `ForensicTopologyValidator.ts` | Face/Edge/Vertex counts, persistent string tags, Euler characteristic | **NO** |
| **3. Feature Tree Hash** (`featureTreeHash`) | `FeatureTree.ts` | Feature names, types, parameters, suppression states | **NO** |
| **4. CAM Toolpath Hash** (`trajectoryHash`) | `CAMProvenanceEngine.ts` | `operationId`, point count, start/end points, machine config | **NO** |
| **5. QualityGate Certificate** (`provenanceHash`) | `MetrologyEngine.ts` / `CyberPhysicalCanonicalAdapter.ts` | Session ID, raw point hash, evaluation hash, `cadRevisionHash` (string parameter) | **YES** (As unverified string field) |

---

### Q5: Is topology/feature data an Authoritative Identity or Derived Lineage Artifact?

**Answer: Topology and Feature data are DERIVED LINEAGE ARTIFACTS.**

1. **Why Topology Cannot Be an Authoritative Identity**:
   In parametric CAD modeling, B-Rep faces, edges, and vertices are constantly destroyed, split, merged, or morphing during feature history edits (e.g. changing an extrusion depth from 10mm to 20mm, or adding a fillet). If face IDs or B-Rep topology hashes were authoritative cryptographic identities, any parametric edit would invalidate the entire document history.
2. **The Correct Architectural Boundary**:
   - **Authoritative Identity**: The **Canonical CAD Revision Hash** (`Revision` record managed by `RevisionEngine`), which establishes sovereign engineering truth.
   - **Derived Lineage Artifact**: B-Rep topology, persistent naming tags, feature trees, DFM/CAM toolpaths, and mesh representations. They are re-extractable and re-bindable derivatives generated from the CAD revision content.

---

## 4. DETAILED CODE AUDIT FINDINGS BY TARGET AREA

### 4.1 `src/engine/topology/`
- **`PersistentTopologyTypes.ts`**: Defines persistent topology schemas (`PersistentTopologyIdentity`, `TopologyReference`). Identifiers are string tags like `Part/Box_01/TopFace`.
- **`TopologicalNamingEngine.ts`**: Handles persistent naming extraction during feature operations (Extrude, Boolean Cut/Fuse, Fillet/Chamfer). Computes `TopologyFingerprint` based on entity counts and sorted persistent IDs.
- **`TopologyLineageProofEngine.ts`**: Implements `rebindReference()` to resolve persistent references across geometry regenerations. Supports resolution states: `VALID`, `STALE`, `REBOUND`, `SPLIT`, `MERGED`, `DELETED`, `AMBIGUOUS`, `UNRESOLVED`, `BROKEN`.
- **`ForensicTopologyValidator.ts`**: Validates B-Rep manifoldness, Euler characteristic ($V - E + F$), and geometry-topology correspondence.

### 4.2 `src/engine/revision/`
- **`RevisionEngine.ts` & `RevisionCanonicalizer.ts`**: Defines the root sovereign authority for engineering documents.
- `RevisionCanonicalizer.computeRevisionHash()` produces the cryptographic SHA-256 digest of the CAD document. However, `RevisionContent` contains raw parameters/sketches/features rather than B-Rep topology hashes.

### 4.3 `src/engine/cam/`
- **`CAMProvenanceEngine.ts` & `ParametricCAMBridge.ts`**: Generates CAM toolpaths and NC provenance chains.
- `generateNCProvenanceChain()` hashes toolpath trajectory points and machine config, but does not bind the toolpath to the root `cadRevisionHash`.

### 4.4 `src/engine/trust/` & `src/engine/quality-metrology/`
- **`CyberPhysicalCanonicalAdapter.ts`**:
  `resolveCanonicalBinding()` accepts `cadRevisionHash` as an optional input parameter provided in the CPIS payload and hashes it into `bindingDigest`.
- **`MetrologyEngine.ts`**:
  `issueQualityCertificate()` accepts `cadRevisionHash` as a parameter and includes it in `provenanceHash`. However, `MetrologyEngine` cannot cryptographically verify whether the measured points match the specific B-Rep topology of that CAD revision, because B-Rep topology carries no cryptographic lineage proof linking back to `cadRevisionHash`.

---

## 5. FORENSIC CONCLUSION & ARCHITECTURAL SUMMARY

1. **Root Audit Verdict**: `PRIMARY_ROOT_VERDICT = OPTION_B` (Volatile, Re-extractable Derived Lineage Artifacts).
2. **Scope Compliance**: Read-Only audit completed with zero modifications to production code or test files.
3. **Architectural Clarity**:
   - `RevisionEngine` is the sole **Canonical Engineering Authority**.
   - B-Rep Topology, Feature Trees, and CAM Toolpaths are **Derived Lineage Artifacts**.
   - `CyberPhysicalCanonicalAdapter` binds external references to `cadRevisionHash` at the release boundary, but internal CAD/CAM topology kernel operations remain parametric and re-bindable.
