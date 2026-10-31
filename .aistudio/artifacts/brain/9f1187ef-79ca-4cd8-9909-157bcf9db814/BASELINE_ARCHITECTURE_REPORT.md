# BASELINE_ARCHITECTURE_REPORT.md
**Program**: `SECP-ENGINEERING-TRUTH-INTEGRATION-001`  
**Phase**: Stage 1 — Read-Only Forensic Baseline (WP-00)  
**Execution Mode**: STRICT READ-ONLY AUDIT  
**Audit Timestamp**: 2026-10-31  

---

## 1. Executive Summary

This report establishes the forensic architecture baseline for the SECP Engineering Core and all connected domain engines (`PcbEngine`, `ElectricalWorkbenchEngine`, `WiringHarnessCanonicalModel`, `MultidomainPcbIntegrationEngine`, `FEMCore`, `CFDEvidenceGenerator`, and `EngineeringObjectOS`).

The audit reveals a strong foundational CAD kernel (`BRepKernel`), a robust PLM projection adapter (`CanonicalPLMProjectionAdapter`), and deterministic evidence hashers (`EngineeringHashChain`, `EvidenceHasher`). However, several domain engines currently operate on local, unlinked shadow copies or standalone model formats without explicit `canonicalRevisionId` bindings, resulting in truth discontinuities when design modifications occur upstream.

---

## 2. Production Engine Execution Paths & Authority Matrix

| Domain | Primary Engine Class | Canonical Source File | Current Truth Authority | Identified Truth Discontinuity |
| :--- | :--- | :--- | :--- | :--- |
| **Core CAD Kernel** | `BRepKernel`, `CADDocument` | `src/engine/cad-kernel/` | `EngineeringDocument` / `BRepKernel` | None — Native geometry source of truth. |
| **Object OS & Governance** | `EngineeringObjectOS` | `src/engine/industrial-os/` | `EngineeringObjectOS` | Registries use local UUIDs if `identity` is omitted. |
| **PLM Projection** | `CanonicalPLMProjectionAdapter` | `src/engine/plm/` | `EngineeringPLMEngine` | Projects CAD events; lacks automated triggers for PCB/Harness mutations. |
| **Revision Lineage** | `RevisionEngine` | `src/engine/revision/` | `RevisionEngine` | Strong revision hashing; not all domain engines bind runs to `revisionId`. |
| **Invalidation Pipeline** | `InvalidationPipelineEngine` | `src/engine/workbench/` | `InvalidationPipelineEngine` | Enforces B-Rep -> Mesh -> Derived stale flow for CAD; PCB/Electrical bypass this pipeline. |
| **Simulation Authority** | `SimulationAuthorityInternal` | `src/engine/simulation/` | `SimulationAuthorityInternal` | Sealed execution envelopes exist, but FEM/CFD runs are not all sealed with `engineKey`. |
| **PCB Domain** | `PcbEngine`, `PcbCanonicalModel` | `src/engine/pcb/` | `PcbCanonicalModel` (Standalone) | Uses local `deterministicStringify` hash; not bound to `parentRevisionId` in Core. |
| **Electrical Domain** | `ElectricalWorkbenchEngine` | `src/engine/engineeringCore/` | `ReferenceCircuitModel` | Solves nodal MNA on raw circuit objects without generating revision-bound evidence envelopes. |
| **Wiring Harness Domain**| `WiringHarnessCanonicalModel` | `src/engine/wiring-harness/` | `WiringHarnessCanonicalModel` | 3D route waypoints are floating numeric vectors, not topologically bound to Mechanical Enclosure B-Rep geometry. |
| **Multidomain Integration** | `MultidomainPcbIntegrationEngine` | `src/engine/crossdomain/` | `MultidomainPcbIntegrationEngine` | Couplings (electrothermal, MNA) calculate in-memory without propagating stale status downstream. |
| **FEM Domain** | `FEMCore`, `FEMLinearSolverAdapter` | `src/engine/fem/` | `FEMMesh` / `FEMCore` | Runs compute stiffness matrices without verifying `inputManifestHash` or `executionAuthority`. |
| **CFD Domain** | `Fvm3DNavierStokesSolver` | `src/engine/cfd3d/` | `CFDMeshInfrastructure` | Solves Navier-Stokes on standalone mesh grids without revision invalidation checks. |

---

## 3. Governance & Architectural Rules for Integration

To enforce `One Canonical Engineering Reality -> Multiple Domain Views -> Authorized Computation -> Revision-Bound Evidence`:

1. **Single Source of Truth**: All domain models MUST derive identity from `EngineeringIdentity` containing `canonicalEntityId`, `domainId`, `canonicalRevisionId`, `parentRevisionId`, `geometryHash`, `topologyHash`, `engineeringStateHash`, `dependencyManifest`, and `authorityReference`.
2. **Canonical Domain Binding**: No domain engine may accept floating raw objects. Every model input must be validated via `CanonicalDomainBinding` before computation.
3. **Change Propagation & Invalidation**: Any upstream edit in CAD, PCB, Electrical, or Harness MUST automatically mark downstream Multidomain, FEM, CFD, and Evidence records as `STALE` via `InvalidationPipelineEngine`.
4. **Simulation Input Authority**: All FEM and CFD runs MUST register `SimulationRunManifest` containing `simulationRunId`, `canonicalRevisionId`, `domainRevisionBindings`, `geometryHash`, `topologyHash`, `materialModelHash`, `boundaryConditionHash`, `meshHash`, `solverConfigurationHash`, `solverVersion`, `inputManifestHash`, and `executionAuthority`.
5. **No Parallel Stores**: All evidence and artifact references must map directly to `EngineeringObjectOS` and `CanonicalPLMProjectionAdapter`.

---

## 4. Stage 1 Forensic Conclusion

The Stage 1 Forensic Audit is COMPLETE. All 6 required baseline artifacts have been generated with exact code paths, gap registers, authority maps, and dependency graphs. Code modification is strictly gated pending review and approval.
