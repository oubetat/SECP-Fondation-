# SECP-TYPESCRIPT-BOUNDARY-FORENSIC-001 — Production Type Error Attribution Report

**Execution Mode**: READ-ONLY / FORENSIC  
**Final Verdict**: **`FAIL`**  
**Evidence Summary**: Out of **7087** distinct TypeScript error diagnostics across **10,828** log lines, **2720 errors** are in production-reachable code, while **4367 errors** are in test-only or orphan experimental files.

---

## 1. Executive Summary & Diagnostic Inventory

This forensic investigation established the exact production dependency boundary of SECP Industrial OS v3 and mapped all reproducible TypeScript diagnostics against actual runtime reachability.

| Metric | Measured Value | Description |
| :--- | :--- | :--- |
| **Total Log Lines** | `10828` | Full stdout/stderr lines from `tsc --noEmit` |
| **Distinct Error Diagnostics** | `7087` | Deduplicated individual diagnostic records |
| **Production-Reachable Diagnostics** | **`2720`** | Errors in files imported by `main.tsx` or `server.ts` |
| **Non-Production Diagnostics** | `4367` | Errors in test-only or unreachable orphan files |
| **Production Entry Graph** | `1393` files | Transitive imports from `src/main.tsx` and `server.ts` |
| **Test Harness Graph** | `3103` files | Transitive imports from `vitest.config.ts` and test suites |

---

## 2. Classification Breakdown

All **7087** diagnostics were classified into the 7 mandatory categories based on transitive import reachability:

| Classification | Count | Percentage | Description / Reachability Evidence |
| :--- | :---: | :---: | :--- |
| **1. PRODUCTION_DIRECT** | `0` | 0.0% | Direct root entry points (`main.tsx`, `server.ts`, `App.tsx`) |
| **2. PRODUCTION_TRANSITIVE** | **`1056`** | 14.9% | Reachable exclusively via production import graph |
| **3. SHARED_PRODUCTION_EXPERIMENTAL** | **`1664`** | 23.5% | Imported by production AND referenced by test harness |
| **4. TEST_ONLY** | `3389` | 47.8% | Reachable strictly from Vitest runner / test suites |
| **5. EXPERIMENTAL_UNREACHABLE** | `978` | 13.8% | Unreachable orphan components/scripts in `src/` |
| **6. HISTORICAL_UNREACHABLE** | `0` | 0.0% | Historical gate scripts outside `src/` |
| **7. UNRESOLVED** | `0` | 0.0% | Unattributed or ambiguous diagnostics |
| **TOTAL** | **`7087`** | **100.0%** | |

---

## 3. Production Reachability & Domain Attribution

Production-reachable diagnostics (**2720 errors**) were attributed by subsystem/domain:

| Affected Domain / Subsystem | Direct/Transitive Errors | Key Contract Impact Areas |
| :--- | :---: | :--- |
| **`src/engine/cad-kernel`** | **574** | B-Rep topology, NURBS surface evaluation, AP242 STEP interfaces |
| **`src/engine/assembly`** | **496** | Mate constraints, kinematic tolerance, clearance analysis |
| **`src/engine/cam`** | **359** | Multi-axis toolpathing, NC simulation, post-processing |
| **`src/engine/engineering_webgpu`** | **193** | WebGPU compute shaders, GPU linear algebra, hardware acceleration |
| **`src/engine/collaboration`** | **182** | Multiplayer state sync, CRDT event store, WebSocket messages |
| **`src/engine/cfd3d`** | **178** | Navier-Stokes FVM solvers, turbulence models, residual history |
| **`src/engine/fem`** | **113** | Timoshenko beam elements, material tensor field, stress solver |
| **`src/engine/gcs3d`** | **97** | Geometric constraint solver, Newton-Raphson system matrices |
| **`src/engine/engineering_ai`** | **89** | LLM prompt dispatchers, AI material exploration, RAG embeddings |
| **`src/engine/cad`** | **84** | Parametric feature trees, sketch constraints, extrusion operations |
| **`src/engine/industrial-os`** | **53** | Engineering Object OS, approval governance, policy evaluation |
| **`src/engine/manufacturing`** | **44** | G-code generation, feed rate optimization, tool wear models |
| **Other Subsystems** | **258** | Components, UI panels, telemetry, revision adapters |

---

## 4. Engineering Impact Analysis

1. **Type Safety vs. Runtime Execution**:
   - As established in prior qualification runs, **Vite production bundling succeeds with exit code 0** because Vite/esbuild strips TypeScript annotations without enforcing type checks.
   - However, the **2720 production type errors** represent compile-time interface inconsistencies, optional property mismatches, and type safety regressions across production engineering engines.
2. **Authority & Data Integrity**:
   - Core authority engines (`SimulationAuthorityInternal`, `CanonicalDomainBinding`) maintain zero type errors on their core execution functions, but consumers in downstream CAD/CFD modules suffer from interface type mismatches.

---

## 5. Final Verdict & Integrity Verification

- **Verdict**: **`FAIL`**
- **Justification**: **2720 reproducible TypeScript errors** exist within files reachable from production entry points (`src/main.tsx` and `server.ts`). Under the strict rule of `SECP-TYPESCRIPT-BOUNDARY-FORENSIC-001`, a verdict of `PASS` cannot be claimed while production-reachable type errors persist.
- **SHA-256 Digest**: `bf000c8e3430f91538df0a6c478bec4a96702faec9f9b85833d5455fc7868846`
