# Canonical Source Ownership Map

## SECP Programmable Material Engineering (PME) Phase V9

### 1. Architectural Principle (V9-ARCH-01: Non-Duplication)
The `MaterialTruthThread` acts as an evidence, provenance, and revision linkage DAG over canonical objects in the SECP Core system. It **MUST NOT** duplicate, shadow, or act as an independent primary store for material parameters, element geometries, or measured values. All data values referenced by nodes in the graph are bound by deterministic content hashes derived directly from the canonical primary SECP objects.

---

### 2. Canonical Ownership Registry

| Object Type | Canonical Source File & Interface | Primary Ownership Responsibility | Truth Thread Node Representation | Content Hash Mechanism |
|---|---|---|---|---|
| **Canonical Geometry** | `FEMTypes.ts` -> `geometryMetadata` | Geometry ID, Geometry Revision, Coordinate Frame | Node Type: `GEOMETRY` Category: `INTENDED` | SHA-256 of `geometryMetadata` |
| **Material Definition** | `FEMTypes.ts` -> `FEMMaterial` | Young's Modulus (E), Poisson's Ratio (nu), Mass Density | Node Type: `MATERIAL_DEFINITION` Category: `INTENDED` | SHA-256 of canonical `FEMMaterial` map |
| **Spatial Material Field** | `SpatialMaterialField.ts` -> `SpatialMaterialField` | Spatial variation functions, field coefficients, evaluation domain | Node Type: `SPATIAL_FIELD` Category: `PREDICTED` / `INTENDED` | `SpatialMaterialField.computeHash()` |
| **Manufacturing Constraint Profile** | `ManufacturingConstraintEngine.ts` -> `ManufacturingConstraintProfile` | Process constraints, resolution limits, defect bounds | Node Type: `MANUFACTURING_PROFILE` Category: `MANUFACTURED` | SHA-256 of profile object |
| **As-Built Material State** | `AsBuiltMaterialStateEngine.ts` -> `AsBuiltMaterialState` | Measured dataset, spatial registration, coverage, reconstructed field | Node Type: `AS_BUILT_STATE` Category: `MEASURED` / `AS_BUILT` | SHA-256 of `AsBuiltMaterialState` |
| **Spatial Material Deviation** | `SpatialMaterialDeviationEngine.ts` -> `SpatialMaterialDeviationResult` | Deviation map, max deviation, statistical metrics, conformance verdict | Node Type: `DEVIATION_RESULT` Category: `DEVIATION_ANALYSIS` | SHA-256 of `SpatialMaterialDeviationResult` |
| **Conformance Decision** | `SpatialMaterialDeviationEngine.ts` -> `ConformanceDecision` | Decision (`PASS`/`FAIL`), acceptance thresholds, risk level | Node Type: `CONFORMANCE_DECISION` Category: `CONFORMANCE_DECISION` | SHA-256 of decision object |
| **Verification Evidence** | `FEMEvidenceEngine.ts` -> `FEMEvidencePackage` | Complete hash audit, solver metrics, stale evidence detection | Node Type: `EVIDENCE_PACKAGE` Category: `CONFORMANCE_DECISION` | `FEMEvidencePackage.modelHash` |

---

### 3. Source Ownership Rules
1. **Single Point of Truth**: If a material property (e.g., Young's Modulus $E$) is modified, it must be edited inside the canonical `FEMModel.materials` or `SpatialMaterialField` object.
2. **Deterministic Hash Invalidation**: Mutating any canonical object recomputes its hash, causing graph validation in `MaterialTruthThreadEngine` to flag `HASH_MISMATCH` or propagate invalidation down edges (`INVALIDATED_BY_CHANGE`).
3. **No Phantom Nodes**: Truth thread nodes cannot exist without a valid pointer to a canonical entity or revision record.
