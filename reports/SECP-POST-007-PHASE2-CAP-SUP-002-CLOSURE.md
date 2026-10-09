# SECP POST-007 Phase 2 — CAP-SUP-002 Final Forensic Closure Audit

**Capability ID**: `CAP-SUP-002`  
**Capability Title**: AP242 Semantic Round-Trip Truth  
**Closure Status**: `PROVEN_ENGINEERING_CONTRACT`  
**Global Status**: `GLOBAL_SUPERIORITY = UNPROVEN` (due to isolated non-AP242 FEA/solver gate failures)  
**Timestamp**: 2026-09-23T10:10:00.000Z  
**Independent Oracle**: `IndependentAp242Oracle` (`src/engine/interop/step-ap242/IndependentAp242Oracle.ts`)  
**Red-Team Test Suite**: `src/engine/engineering/__tests__/AP242Phase2RedTeam.test.ts`  

---

## 1. Eight-Point Forensic Verification

### Point 1: `IndependentAp242Oracle` Semantic Independence
- **Verification**: `IndependentAp242Oracle` directly parses raw ISO 10303-21 Part 21 text using independent regular expressions and tokenizers.
- **Independence Guarantee**: Contains zero imports of `BRepSolid`, `StepAp242Mapper`, `StepAp242Exporter`, or `StepAp242Pipeline`.
- **Functionality**: Calculates 3D bounding box bounds, computes topological Euler characteristic ($\chi = V - E + F$), parses assembly NAUO trees, and extracts PMI semantics directly from raw Part 21 text statements.

### Point 2: Cryptographic Model Hash Strength
- **Verification**: `SECP080AP242VerificationEngine.computeModelHash` serializes complete model state:
  - Header (`fileName`, `schemaVersion`, `timestamp`)
  - Unit system (`lengthUnit`, `angleUnit`, `lengthConversionToMm`)
  - Full B-Rep geometry (`x, y, z` coordinates for every vertex, start/end vertex IDs for every edge, face bounds, and surface normals)
  - PMI, GD&T, Datums, Surface Finishes, and Metadata
- **Result**: Any modification to geometry, topology, units, revision metadata, or PMI immediately alters the payload string and produces a distinct cryptographic hash.

### Point 3: Real ISO 10303-21 Physical File Exchange
- **Verification**: `StepAp242Exporter` and `AP242PmiExporter` produce physical ISO 10303-21 text files containing standard MIM LF statements (`MANIFOLD_SOLID_BREP`, `ADVANCED_FACE`, `DIMENSIONAL_CHARACTERISTIC_REPRESENTATION`, `DATUM_FEATURE`, `GEOMETRIC_TOLERANCE_WITH_DATUM_REFERENCE`, `NEXT_ASSEMBLY_USAGE_OCCURRENCE`).
- **Result**: No JSON stringify or synthetic mock shortcuts are used for AP242 STEP interop.

### Point 4: Explicit Scope of AP242 Support
- **FULL SUPPORT**:
  - B-Rep Geometry: Planar, Cylindrical, Spherical surfaces; Straight Lines, Circles, Cartesian 3D Points, Direction Vectors.
  - B-Rep Topology: Vertices, Edges, Edge Loops, Advanced Faces, Closed Shells, Manifold Solid B-Reps.
  - Assemblies: Component definitions, `NEXT_ASSEMBLY_USAGE_OCCURRENCE`, 4x4 transform matrices.
  - Units: Millimeters, Meters (1000x scaling to mm), Inches (25.4x scaling to mm).
  - PMI / MBD: Linear, Angular, Diametral Dimensions; Symmetric, Bilateral, Limits Tolerances; Datums A, B, C; Feature Control Frames (Position with MMC/RFS, Flatness, Perpendicularity, Concentricity).
- **PARTIAL SUPPORT**:
  - Graphical PMI text notes (`ANNOTATION_OCCURRENCE`), B-Spline curve approximations.
- **UNSUPPORTED / OUT OF SCOPE**:
  - Freeform offset surfaces, complex weld symbol annotations, kinematic joints, material density tensors.

### Point 5: Treatment of Unsupported Entities
- **Verification**: When `StepAp242Mapper` or `AP242PmiParser` encounters an unknown or unsupported entity type, it logs a `StepLossReport` with status `UNSUPPORTED`/`LOST` and severity `HIGH`.
- **Result**: `StepAp242RoundTripVerifier` immediately sets the fidelity verdict to `LOSS_DETECTED`. Unsupported entities never silently disappear or get reported as `PASS`.

### Point 6: Semantic-Loss Matrix Transparency
- **Verification**: Machine-readable `semantic_loss_matrix` in `reports/SECP-POST-007-PHASE2-CAP-SUP-002-INTEGRITY.json` documents entity-by-entity preservation state across 6 core categories.

### Point 7: Raw Text Round-Trip Verification
- **Verification**: `AP242Phase2RedTeam.test.ts` executes complete raw ISO 10303-21 text string generation, parsing, export, re-import, and independent comparison across tests `P1`, `P2`, `P3`, `O1`, `A1`, `A3`, `A6`, `A7`, and `A11`.

### Point 8: Independent PMI/GD&T Verification
- **Verification**: `AP242PmiRoundTripVerifier` extracts PMI objects directly from re-parsed STEP entities (`DIMENSIONAL_CHARACTERISTIC_REPRESENTATION`, `DATUM_FEATURE`, `GEOMETRIC_TOLERANCE_WITH_DATUM_REFERENCE`) and verifies nominal values, tolerances, datum references, and geometry associations against the source model.

---

## 2. Test Execution Summary

| Suite | Scope | Result | Pass Rate |
| :--- | :--- | :--- | :--- |
| **AP242 Red-Team Suite** | `src/engine/engineering/__tests__/AP242Phase2RedTeam.test.ts` | **PASS** | 18 / 18 (100%) |
| **STEP AP242 Interop Suite** | `src/engine/interop/step-ap242/__tests__/` | **PASS** | 21 / 21 (100%) |
| **Mutation Testing Suite** | 11 Critical Declared Mutations | **PASS** | 11 / 11 (100%) |

---

## 3. Boundary Separation of Non-AP242 Regressions

Executing the broader repository validation suite revealed 11 failures across 5 non-AP242 test files:
- `HardAcceptanceGate055`
- `HardAcceptanceGate056`
- `SECP075ForensicVerificationEngine`
- `SECP076SolverIntegrity`
- `SECP078NonlinearContact`

These failures belong to pre-existing non-AP242 domains (FEA solver integrity, nonlinear contact mechanics, hardware acceptance gates 055/056).  
In accordance with strict forensic isolation principles:
- **These 11 failures are explicitly separated as out-of-scope non-AP242 domain regressions.**
- **They are not fixed within this AP242 task to preserve clean evidence boundaries.**
- **`CAP-SUP-002` is proven as an isolated engineering contract.**
- **`GLOBAL_SUPERIORITY` is declared `UNPROVEN`.**

---

## 4. Final Closure Declaration

`CAP-SUP-002` (AP242 Semantic Round-Trip Truth) is officially **PROVEN** and **CLOSED** as an isolated engineering contract.
