# SECP Collision Engine Forensic Evidence Adjudication Report

**Mission Identifier:** `COLLISION-ENGINE-FORENSIC-EVIDENCE-ADJUDICATION-001`  
**Classification:** Authoritative Engineering Forensic Evidence Adjudication  
**Domain:** SECP Collision / Contact / Kinematics / Assembly / CAM / Multi-Axis / Geometry / Engineering Truth  
**Governance Authority:** SECP Engineering Truth & Forensic Verification Directorate  
**Final Forensic Classification:** **`COLLISION_ENGINE_IMMATURE`**  
**Authoritative Production Claim:** **`REJECTED (NOT PRODUCTION-GRADE)`**  
**Governance Status:** **`FAIL-CLOSED ENFORCEMENT`**

---

## 1. Executive Verdict

An independent forensic evidence adjudication of the claims set forth in `COLLISION-ENGINE-FORENSIC-MATURITY-001` was conducted against the repository source code, execution call paths, test suites, and mathematical formulations.

**Adjudication Result:** All primary defect findings, architectural gaps, and production disconnections reported in the prior maturity audit are **fully confirmed by direct source-code, mathematical, and execution evidence.**

**Authoritative Decision:** **`SECP Collision Engine remains IMMATURE and REJECTED for production claims.`**

---

## 2. Previous Audit Claims Re-examined

The adjudication re-examined the following major claims:
- **Claim 1:** Vertex/Centroid-only narrow phase in CAM collision detection.
- **Claim 2:** Vertex-only geometry evaluation in 5-Axis tool holder collision checking.
- **Claim 3:** Hardcoded $30\text{ mm}$ bounding sphere mock formulas in kinematic clearance.
- **Claim 4:** Synthetic test fixture disconnection in `CollisionDetectionWorkspace.tsx`.
- **Claim 5:** Fail-open silent exception swallowing in `AssemblyInterferenceEngine.ts`.
- **Claim 6:** Discrete multi-step sampling ($4 \le N \le 25$) masquerading as continuous collision detection.

---

## 3. Claim-by-Claim Adjudication Matrix

| Claim ID | Core Claim | Source Location | Source Lines | Concrete Implementation Evidence | Final Adjudication |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CLM-001** | Vertex/Centroid Narrow Phase | `src/engine/cam/collision/NarrowPhaseDetector.ts` | 188–193, 258–280 | `pointsToCheck = [v0, v1, v2, centroid]` + 5-step centerline point sampling; omits exact continuous cylinder-triangle intersection. | **`CONFIRMED_DEFECT`** |
| **CLM-002** | 5-Axis Vertex-Only Loop | `src/engine/cam/fiveaxis/FiveAxisCollisionEngine.ts` | 40–47 | Loops exclusively over `obstacle.vertices`; `obstacle.faces` is unreferenced. | **`CONFIRMED_DEFECT`** |
| **CLM-003** | Mock Kinematic Clearance | `src/engine/assembly/kinematics/KinematicCollisionClearanceBridge.ts` | 62 | `Math.max(0.1, centerDist - 30.0)` assumes hardcoded $15\text{ mm}$ radius spheres for all components. | **`CONFIRMED_DEFECT`** |
| **CLM-004** | Synthetic UI Disconnection | `src/components/cam/CollisionDetectionWorkspace.tsx` | 37, 393–429 | Calls `createSampleObstacleTriangles(benchmarkId)` constructing 2–6 hardcoded demo triangles. | **`CONFIRMED_PRODUCTION_DISCONNECTION`** |
| **CLM-005** | Fail-Open B-Rep Clash | `src/engine/assembly/AssemblyInterferenceEngine.ts` | 82–90, 142–154 | `try/catch` catches kernel boolean errors and silently defaults status to `NO_INTERFERENCE`. | **`CONFIRMED_DEFECT`** |
| **CLM-006** | Discrete Sampling as CCD | `src/engine/cam/collision/ContinuousCollisionDetector.ts` | 48–64 | Subdivides trajectory into $4 \le N \le 25$ discrete poses; thin wall tunneling is possible. | **`CONFIRMED_CAPABILITY_GAP`** |

---

## 4. Confirmed Geometric Defects

1. **Vertex-Only Mesh Penetration Defect (`FiveAxisCollisionEngine.ts`):**
   - In `CAMCollisionEngine.checkSegmentCollision()`, distance queries are executed exclusively against `obstacle.vertices`.
   - **Mathematical Counterexample:** For a $100\text{ mm} \times 100\text{ mm}$ square plate at $Z=0$ with corner vertices at $(0,0,0), (100,0,0), (100,100,0), (0,100,0)$, a tool of radius $5\text{ mm}$ plunging at $(50,50,Z)$ has a minimum distance to all vertices of $70.71\text{ mm} > 5\text{ mm}$. The engine computes `clearance = 65.71 mm` and reports **`hasCollision = false`**, failing to detect the tool slicing straight through the plate center.

2. **Discrete Sub-Sampling in Tool Assembly Testing (`NarrowPhaseDetector.ts`):**
   - Cylinder-to-triangle proximity uses 5 discrete sample points along zone segment lines. A sharp corner or small feature penetrating the cylinder midway between samples can escape detection.

---

## 5. Confirmed Kinematic Findings

- Forward and Inverse Kinematics solvers (`ForwardKinematicsSolver`, `InverseKinematicsSolver`, `KinematicAssemblyEngine`) are mathematically rigorous.
- However, the bridge between kinematics and geometric clearance (`KinematicCollisionClearanceBridge.ts`) is a mock heuristic that subtracts $30.0\text{ mm}$ from center-to-center distances, rendering kinematic collision evaluation non-authoritative.

---

## 6. Confirmed Production Disconnections

- `CollisionDetectionWorkspace.tsx` operates exclusively on synthetic benchmark geometry (`BENCHMARK_A`, `BENCHMARK_B`, `BENCHMARK_C`, `BENCHMARK_F`).
- No production callpath exists from the active CAD document B-Rep or toolpath generator to `CollisionDetectionWorkspace`.

---

## 7. Confirmed Fail-Open Paths

- `AssemblyInterferenceEngine.ts` (lines 142–154):
  ```typescript
  try {
    intersectSolid = await kernel.booleanIntersect(worldShapeA, worldShapeB);
  } catch (e) {
    try {
      intersectSolid = await kernel.common(worldShapeA, worldShapeB);
    } catch {
      intersectSolid = null;
    }
  }
  // ...
  } catch (err: any) {
    console.warn(`[Interference] Error analyzing pair ${compA.name} x ${compB.name}:`, err);
  }
  // status defaults to 'NO_INTERFERENCE'
  ```
  Kernel exceptions or boolean failures silently return `status = 'NO_INTERFERENCE'`.

---

## 8. Collision Authority Map

Seven uncoordinated collision implementations exist without unified schemas or cross-domain bridges:
1. `src/engine/assembly/AssemblyInterferenceEngine.ts` (OCCT B-Rep boolean)
2. `src/engine/cam/collision/CollisionDetectionEngine.ts` (CAM cylinder vs triangle)
3. `src/engine/cam/fiveaxis/FiveAxisCollisionEngine.ts` (Vertex-only 5-axis holder check)
4. `src/engine/manufacturing/collision/CollisionDetector.ts` (Manufacturing capsule/AABB)
5. `src/engine/assembly/clash/NarrowPhaseDetector.ts` (Gate-only SAT OBB)
6. `src/engine/assembly/kinematics/KinematicCollisionClearanceBridge.ts` (Mock 30mm spherical offset)
7. `src/engine/assembly-intelligence/CollisionDetectionEngine.ts` (Mock 30mm spherical offset)

---

## 9. Canonical Binding Status
- **UNBOUND in CAM / Kinematics:** Geometry is created from synthetic fixtures or hardcoded arrays.
- **BOUND in Assembly:** `AssemblyInterferenceEngine` resolves canonical `ShapeHandle` from `PartDefinition`.

---

## 10. Verification & Evidence Status
- Verification occurs predominantly inside isolated test harnesses (`HardAcceptanceGate032`, `HardAcceptanceGate106`, `HardAcceptanceGate259`).
- Evidence packages are generated in memory but not stored in the persistent engineering document.

---

## 11. Persistence & Truth Thread Status
- **Persistence:** **`ABSENT`** (All collision results reside exclusively in volatile React/module memory).
- **Truth Thread:** **`ABSENT`** (No cryptographic linkage between collision records and CAD revision hashes).

---

## 12. Determinism Status
- Computational vector mathematics is deterministic.
- Byte-level incident serialization determinism is unproven due to unsorted incident arrays.

---

## 13. Adversarial Case Results

- **Case A (Vertex Miss):** `FiveAxisCollisionEngine` fails (reports NO COLLISION).
- **Case B (Dimension Invariance):** `KinematicCollisionClearanceBridge` reports identical clearance for $500\text{ mm}$ blades and $1\text{ mm}$ screws.
- **Case C (Fail-Open Boolean):** `AssemblyInterferenceEngine` returns `NO_INTERFERENCE` on kernel crash.

---

## 14. False Positives / Rejected Claims
- **None.** All 6 major defect claims from Mission 001 were verified as true defects or confirmed gaps.

---

## 15. Remaining Unknowns
- Exact performance profile of OCCT `booleanIntersect` on full assemblies ($> 100$ components).
- GPU acceleration feasibility for broad-phase candidate pair generation.

---

## 16. Final Maturity Classification & Decision

```
========================================================================================
FINAL ADJUDICATION SCORECARD
========================================================================================
1. Assembly B-Rep Boolean Interference : [ PARTIALLY_AUTHORITATIVE ] (Fail-Open Defect)
2. CAM Toolpath Collision Detector      : [ NON_AUTHORITATIVE ] (Narrow Phase Defect)
3. 5-Axis Tool Holder Clearance Engine  : [ NON_AUTHORITATIVE ] (Vertex-Only Defect)
4. Manufacturing Multi-Body Engine      : [ NON_AUTHORITATIVE ] (Capsule/AABB Only)
5. Kinematic Clearance Bridge           : [ UNPROVEN / MOCK ] (Hardcoded 30mm Offset)
6. Production UI Workspace              : [ DISCONNECTED ] (Synthetic Demo Fixtures)
========================================================================================
OVERALL GOVERNANCE VERDICT: COLLISION_ENGINE_IMMATURE (FAIL-CLOSED)
AUTHORITATIVE PRODUCTION CLAIM: REJECTED
========================================================================================
```

---

## 17. Required Future Remediation Roadmap (Informational Only)

1. **Phase 1 — Narrow Phase Exactness:** Implement exact cylinder-triangle and capsule-triangle distance algorithms in CAM and 5-Axis collision engines.
2. **Phase 2 — Fail-Closed Hardening:** Update `AssemblyInterferenceEngine` to return `status: 'ANALYSIS_FAILED'` and raise critical error flags when OCCT operations fail.
3. **Phase 3 — Real CAD Binding in UI:** Connect `CollisionDetectionWorkspace` directly to active CAD document B-Rep meshes via `GeometryKernel.tessellate()`.
4. **Phase 4 — Geometry-Aware Kinematic Clearance:** Replace the hardcoded `centerDist - 30.0` heuristic in `KinematicCollisionClearanceBridge` with AABB/BVH bounding queries from component mesh vertices.
5. **Phase 5 — Document Persistence & Truth Thread:** Serialize collision reports into the canonical engineering document revision thread.
