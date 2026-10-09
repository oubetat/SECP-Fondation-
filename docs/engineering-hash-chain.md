# SECP Industrial OS v2 — Engineering Hash Chain Architecture

## 1. Executive Summary & Purpose
`PATCH-010` establishes a tamper-evident cryptographic lineage chain across the core engineering lifecycle stages:

$$\text{DESIGN} \longrightarrow \text{GEOMETRY} \longrightarrow \text{SIMULATION} \longrightarrow \text{RESULT} \longrightarrow \text{VERIFICATION} \longrightarrow \text{MANUFACTURING}$$

In industrial engineering and mission-critical manufacturing, ensuring that a physical component or simulation result can be traced back to its exact CAD geometry, material specification, boundary conditions, and design parameters is critical.

> **CRITICAL ARCHITECTURAL PRINCIPLE**:  
> `Engineering Hash Chains prove cryptographic integrity and lineage, NOT physical or engineering correctness.`  
> A valid cryptographic hash chain guarantees that artifacts have not been modified or substituted; physical correctness is verified independently by domain physics solvers and acceptance gates.

---

## 2. Cryptographic Architecture

```
        +-----------------------------------------+
        |   Engineering Artifact (e.g. Design)   |
        +-----------------------------------------+
                             |
                             v
        +-----------------------------------------+
        |    PATCH-008 Canonical Identity         |
        |    (artifactId, artifactType, etc.)     |
        +-----------------------------------------+
                             |
                             v
        +-----------------------------------------+
        |    PATCH-009 Canonical Serialization    |
        |    (Deterministic NFC, sorted keys)     |
        +-----------------------------------------+
                             |
                             v
        +-----------------------------------------+
        |   canonicalHash = SHA-256(canonical)   |
        +-----------------------------------------+
                             |
        +--------------------+--------------------+
        |                                         |
        v                                         v
 [Genesis Node]                            [Subsequent Node]
 previousHash: null                        previousHash: Node(N-1).chainHash
        |                                         |
        +--------------------+--------------------+
                             |
                             v
        +-----------------------------------------+
        |  Deterministic Chain Payload:          |
        |  {                                      |
        |    stage,                               |
        |    artifactId,                          |
        |    artifactType,                        |
        |    canonicalHash,                       |
        |    previousHash,                        |
        |    canonicalizationVersion: "1.0.0",    |
        |    hashAlgorithm: "SHA-256"             |
        |  }                                      |
        +-----------------------------------------+
                             |
                             v
        +-----------------------------------------+
        |   chainHash = SHA-256(payload)          |
        +-----------------------------------------+
```

---

## 3. Node Specification & Properties

```typescript
export interface EngineeringHashNode {
  readonly stage: EngineeringChainStage;
  readonly artifactId: string;
  readonly artifactType: string;
  readonly canonicalHash: string;
  readonly previousHash: string | null;
  readonly chainHash: string;
  readonly canonicalizationVersion: string;
  readonly hashAlgorithm: string;
  readonly createdAt?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
```

### Key Guarantees:
1. **Zero Clock Leaks in Hashes**: `createdAt` and `metadata` are provenance metadata only. They are strictly excluded from `chainHash` and `canonicalHash` calculations to preserve 100% determinism.
2. **Key Ordering & Byte Encoding**: Payloads are serialized using `CanonicalSerializer` (PATCH-009) to prevent string delimiter collisions or property order non-determinism.
3. **Immutability**: Every generated node is `Object.freeze()`-protected against runtime modification.

---

## 4. Downstream Lineage Invalidation

When an upstream artifact is altered (e.g. `Design A` $\to$ `Design B`):
1. `computeCanonicalHash(Design B)` produces a different hash.
2. `verifyArtifact(nodeDesignA, Design B)` returns `{ valid: false, reason: 'ARTIFACT_MODIFIED' }`.
3. If a new node is constructed for `Design B`, its `chainHash` differs from `Design A`.
4. All downstream links (`Geometry`, `Simulation`, `Result`) that pointed to `Design A` now fail verification against the new lineage because their `previousHash` references the old chain hash.

$$\text{Design B} \nrightarrow \text{Geometry A} \nrightarrow \text{Simulation A} \nrightarrow \text{Result A}$$

---

## 5. Separation of Concerns Matrix

| Subsystem | Concern | Authority |
| :--- | :--- | :--- |
| **PATCH-008 Identity** | Artifact naming & reference | `CanonicalEngineeringIdentity` |
| **PATCH-009 Serialization** | Deterministic byte representation | `CanonicalSerializer` |
| **PATCH-010 Hash Chain** | Cryptographic lineage & integrity | `EngineeringHashChain` |
| **Physics Solver / FEA** | Stress & displacement validity | `StructuralFemEngine` / `CfdEngine` |
| **CAD Kernel** | Topological manifold integrity | `BRepValidator` / `CadKernel` |
| **CAM Engine** | Toolpath clearance & kinematics | `CamEngine` / `PostProcessor` |
