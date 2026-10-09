# SECP Collision Engine Authoritative Remediation Architecture & Truth Contract

**Mission Identifier:** `COLLISION-ENGINE-REMEDIATION-ARCHITECTURE-001`  
**Classification:** Authoritative Remediation Architecture & Engineering Truth Contract  
**Domain:** SECP Collision / Contact / Kinematics / Assembly / CAM / Multi-Axis / Geometry / Engineering Truth  
**Governance Authority:** SECP Engineering Truth & Forensic Verification Directorate  
**Architecture Status:** **`APPROVED TARGET ARCHITECTURE`**  
**Production Readiness Status:** **`PENDING PHASED REMEDIATION (FAIL-CLOSED)`**

---

## 1. Executive Summary & Target Architecture

Following the definitive findings of `COLLISION-ENGINE-FORENSIC-MATURITY-001` and `COLLISION-ENGINE-FORENSIC-EVIDENCE-ADJUDICATION-001`, this document establishes the authoritative, single-boundary target architecture required to elevate the SECP Collision subsystem into a mathematically rigorous, fail-closed, and production-grade engineering capability.

### 1.1 Core Architecture Blueprint

```
                         CANONICAL ENGINEERING MODEL
                                      │
                 ┌────────────────────┼────────────────────┐
                 │                    │                    │
              CAD/B-Rep             Tool                Machine
              Geometry            Geometry             Kinematics
                 │                    │                    │
                 └────────────────────┼────────────────────┘
                                      ↓
                     UNIFIED COLLISION AUTHORITY
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
   Broad Phase                   Narrow Phase               Continuous Motion
 (Dynamic BVH)            (Exact Segment-Triangle)         (Swept Convex Hull)
        │                             │                             │
        └─────────────────────────────┼─────────────────────────────┘
                                      ↓
                         Unified Result Contract
                 (NO_COLLISION, PENETRATION, GOUGE, etc.)
                                      ↓
                        Strict Fail-Closed Check
                  (ANALYSIS_FAILED on kernel exception)
                                      ↓
                      Verification & Reverification
                       (B01–B20 Benchmark Battery)
                                      ↓
                     Evidence & Truth Thread Package
                   (SHA-256 Provenance & Signature)
                                      ↓
                      Document Persistence Engine
                     (Deterministic JSON Snapshot)
```

---

## 2. Definitive Answers to the 20 Core Architectural Questions

### Q1: What is the authoritative Collision Engine boundary?
**Answer:** A single, centralized `CollisionAuthority` entry point that coordinates domain-specialized pipelines (Assembly B-Rep Interference, CAM Multi-Axis Toolpath Collision, and Kinematic Mechanism Clearance). All callers consume a unified `CollisionResult` contract, preventing uncoordinated shadow logic.

### Q2: Which existing engines remain?
**Answer:**
1. `AssemblyInterferenceEngine.ts` (Remains as the authoritative solid B-Rep assembly clash engine after fail-closed hardening).
2. `CollisionDetectionEngine.ts` (Remains as the authoritative CAM multi-axis toolpath collision engine after upgrading its narrow phase to exact segment-triangle distance).

### Q3: Which engines become specialized domain engines?
**Answer:**
1. `NarrowPhaseDetector.ts` in assembly clash becomes the specialized Level 3 OBB fast pre-filter.
2. `KinematicCollisionClearanceBridge.ts` becomes the specialized kinematic mechanism clearance evaluator once rebuilt on real mesh bounds.

### Q4: Which engines must be deprecated?
**Answer:**
1. `src/engine/assembly-intelligence/CollisionDetectionEngine.ts` (Hardcoded 30mm sphere mock -> Deprecated & Deleted).
2. `src/engine/kinematics/CollisionEngine.ts` (AABB tip check -> Deprecated & Replaced).
3. `src/engine/cam/fiveaxis/FiveAxisCollisionEngine.ts` (Vertex-only loop -> Subsumed under unified CAM Collision Authority).

### Q5: What is the canonical geometry source?
**Answer:** The canonical CAD B-Rep shape (`ShapeHandle` from OCCT via `GeometryKernel`) and its controlled tessellation (`Tessellation Level 1` with max chordal error $\le 0.005\text{ mm}$ and angular error $\le 0.5^\circ$), cryptographically bound to the document revision hash.

### Q6: What mathematical narrow-phase algorithms are required?
**Answer:**
1. **Cylinder/Capsule vs Triangle:** Exact analytical 3D segment-to-triangle distance solver (evaluating interior triangle face, 3 edges, and 3 vertices).
2. **Triangle vs Triangle:** Moller / Guigue-Devillers exact interval overlap algorithm.
3. **Capsule vs Capsule:** Lumelsky / Ericson segment-segment distance solver.
4. **Solid B-Rep vs Solid B-Rep:** OpenCASCADE `booleanIntersect` / `common` volumetric intersection.

### Q7: What is the continuous collision strategy?
**Answer:** A hybrid **Swept Convex Hull + Conservative Advancement** strategy. A Minkowski sum swept polytope is used in broad phase for zero-tunneling certification; if proximity is detected, iterative conservative advancement calculates the exact time-of-impact ($TOI$) with proven error bounds.

### Q8: What constitutes a collision?
**Answer:** Any non-zero physical volumetric interpenetration ($\text{overlap} > 0.001\text{ mm}^3$ or $\text{distance} \le 0.0\text{ mm}$) between non-cutting components (e.g. Tool Holder vs Part, Cutter Shank vs Fixture, Spindle vs Machine Table).

### Q9: What constitutes a gouge?
**Answer:** Overcut where the cutting envelope of the tool removes material beyond the nominal finished design surface by more than the specified machining tolerance ($\text{penetration} > \text{tolerance}$).

### Q10: What constitutes a clearance violation?
**Answer:** When the minimum Euclidean distance between safe non-cutting surfaces is less than the declared safety threshold ($\text{clearance} < \text{safeClearanceMargin}$, e.g. $< 2.0\text{ mm}$) without physical material contact.

### Q11: What happens when geometry is invalid?
**Answer:** Immediate fail-closed termination returning `status: 'INVALID_GEOMETRY'`, `severity: 'ERROR'`, and `provenSafe: false`.

### Q12: What happens when OCCT fails?
**Answer:** The exception is caught, logged with stack trace, and immediately returns `status: 'ANALYSIS_FAILED'`, `severity: 'FATAL_FAILURE'`, and `provenSafe: false`. It is strictly forbidden to return `NO_INTERFERENCE`.

### Q13: How does real CAD reach Collision?
**Answer:** `DocumentState` -> `PartDefinition` -> `GeometryKernel.tessellate(part, tolerance)` -> `CollisionObject` -> `SpatialBVHNode`. Synthetic demo generators (`createSampleObstacleTriangles`) are completely removed from production paths.

### Q14: How does Collision reach Engineering Core?
**Answer:** The `CollisionAuthority` registers its services in the central SECP Core Service Registry, dispatching events to `EngineeringEventStore` and returning canonical `CollisionReport` objects.

### Q15: How does the result reach Verification?
**Answer:** Automated verification gates evaluate the `CollisionReport` against the B01–B20 benchmark battery and engineering constraints before certifying a toolpath or assembly state.

### Q16: How does the result become evidence?
**Answer:** The `CollisionEvidencePackage` binds SHA-256 hashes of the input CAD B-Rep, tool definition, kinematic model, algorithm version, and result payload into an immutable cryptographic digest.

### Q17: How is it persisted?
**Answer:** Serialized as canonical JSON with lexicographically sorted keys within the document's state snapshot (`DocumentState.camState.collisionReports`).

### Q18: How is it reconstructed?
**Answer:** On document reload, serialized reports are deserialized directly into memory. If the underlying CAD revision hash matches, the report is valid; if the geometry changed, it is marked `STALE_NEEDS_REVERIFICATION`.

### Q19: How is deterministic replay achieved?
**Answer:** All floating-point operations follow deterministic Double-Precision IEEE-754 rules, spatial BVH structures use deterministic centroid splitting, and incident arrays are sorted by canonical composite keys `[segmentIndex, entityIdA, entityIdB]`.

### Q20: What benchmark proves production readiness?
**Answer:** 100% pass rate across the full **B01–B20 Benchmark Suite Matrix**, encompassing vertex misses, edge intersections, thin-wall tunneling, 5-axis simultaneous motions, degenerate meshes, and kernel exception injections.

---

## 3. Formal Contracts Summary

The following 13 contract specifications have been formalized in JSON and committed to `/reports`:
1. `CONTRACT-COLLISION-AUTHORITY-001` (`reports/COLLISION-ENGINE-AUTHORITY-CONTRACT-001.json`)
2. `CONTRACT-COLLISION-RESULT-001` (`reports/COLLISION-ENGINE-RESULT-CONTRACT-001.json`)
3. `CONTRACT-COLLISION-GEOMETRY-001` (`reports/COLLISION-ENGINE-GEOMETRY-CONTRACT-001.json`)
4. `CONTRACT-COLLISION-NARROW-PHASE-001` (`reports/COLLISION-ENGINE-NARROW-PHASE-CONTRACT-001.json`)
5. `CONTRACT-COLLISION-CCD-001` (`reports/COLLISION-ENGINE-CCD-CONTRACT-001.json`)
6. `CONTRACT-COLLISION-CLEARANCE-001` (`reports/COLLISION-ENGINE-CLEARANCE-CONTRACT-001.json`)
7. `CONTRACT-COLLISION-FAIL-CLOSED-001` (`reports/COLLISION-ENGINE-FAIL-CLOSED-CONTRACT-001.json`)
8. `CONTRACT-COLLISION-VERIFICATION-001` (`reports/COLLISION-ENGINE-VERIFICATION-MATRIX-001.json`)
9. `CONTRACT-COLLISION-BENCHMARK-001` (`reports/COLLISION-ENGINE-BENCHMARK-MATRIX-001.json`)
10. `CONTRACT-COLLISION-TRUTH-THREAD-001` (`reports/COLLISION-ENGINE-TRUTH-THREAD-CONTRACT-001.json`)
11. `CONTRACT-COLLISION-PERSISTENCE-001` (`reports/COLLISION-ENGINE-PERSISTENCE-CONTRACT-001.json`)
12. `CONTRACT-COLLISION-LEGACY-MIGRATION-001` (`reports/COLLISION-ENGINE-LEGACY-DECISION-MATRIX-001.json`)
13. `CONTRACT-COLLISION-REMEDIATION-GRAPH-001` (`reports/COLLISION-ENGINE-REMEDIATION-GRAPH-001.json`)

---

## 4. Phased Remediation Execution Roadmap

```
P0: Authority & Contract Types
    ↓
P1: Narrow-Phase Exact Math (Segment-Triangle Solver)
    ↓
P2: Fail-Closed Hardening (AssemblyInterferenceEngine)
    ↓
P3: Canonical CAD Mesh Binding (Tessellation & Chordal Bounds)
    ↓
P4: Continuous Motion Swept Hulls (Zero Tunneling)
    ↓
P5: Kinematic Clearance Rebuild (Removal of Mock Offsets)
    ↓
P6: UI Production CAD Binding (Real Document Workspaces)
    ↓
P7: Truth Thread & Deterministic Persistence
    ↓
P8: B01–B20 Benchmark Qualification Execution
```

---

## 5. Absolute Anti-Closure Enforcement

In strict compliance with SECP Engineering Governance:
- **No production code has been modified in this architecture mission.**
- **No premature closure or maturity upgrade is granted.**
- **Maturity remains `COLLISION_ENGINE_IMMATURE` until all remediation phases (P0–P8) are fully implemented and qualified.**
