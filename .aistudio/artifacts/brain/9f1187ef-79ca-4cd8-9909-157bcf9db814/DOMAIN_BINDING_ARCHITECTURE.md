# DOMAIN_BINDING_ARCHITECTURE.md
**Program**: `SECP-ENGINEERING-TRUTH-INTEGRATION-002`  
**Stage**: 2 — Architecture Decision & Domain Binding Specifications  
**Execution Mode**: READ-ONLY ARCHITECTURE SPECIFICATION  
**Specification Date**: 2026-10-31  

---

## 1. Architectural Strategy & Guiding Principle

The strategic goal of `SECP-ENGINEERING-TRUTH-INTEGRATION-002` is to establish an unbreachable, single source of engineering truth across all specialized domain engines (`PcbEngine`, `ElectricalWorkbenchEngine`, `WiringHarnessGeometryKernel`, `MultidomainPcbIntegrationEngine`, `FEMCore`, and `Fvm3DNavierStokesSolver`).

### The Governing Principle:
$$\text{One Canonical Engineering Reality} \longrightarrow \text{Multiple Domain Views} \longrightarrow \text{Authorized Computation} \longrightarrow \text{Revision-Bound Evidence}$$

No domain engine is permitted to maintain an unlinked local shadow copy of engineering state, execute simulations on unverified inputs, or present derived results as current when the underlying canonical revision has mutated.

---

## 2. Canonical Domain Binding Contracts Overview

Each domain interacts with the SECP Core through a standardized `CanonicalDomainBinding` envelope. Rather than creating parallel registries, every domain binding encapsulates the core identity attributes provided by `EngineeringIdentityService` and `RevisionEngine`:

```typescript
export interface CanonicalDomainBinding {
  readonly bindingId: string;                 // SHA-256(canonicalEntityId + domainId + canonicalRevisionId)
  readonly canonicalEntityId: string;         // Unique entity identity from EngineeringObjectOS
  readonly domainId: 'PCB' | 'ELECTRICAL' | 'WIRING_HARNESS' | 'MULTIDOMAIN' | 'FEM' | 'CFD';
  readonly canonicalRevisionId: string;      // Canonical revision code (e.g. REV-A, REV-B)
  readonly parentRevisionId?: string;        // Lineage reference to previous revision
  readonly geometryTopologyDigest: {
    readonly geometryHash: string;           // SHA-256 of CAD B-Rep / surface geometry
    readonly topologyHash: string;           // SHA-256 of B-Rep topology graph
  };
  readonly inputManifestDigest: string;      // SHA-256 of domain-specific input parameters
  readonly executionAuthorityBoundary: {
    readonly isAuthoritative: boolean;
    readonly executionSealToken?: string;     // Token issued by SimulationAuthorityInternal
  };
  readonly derivedResultIdentity?: {
    readonly resultId: string;
    readonly resultHash: string;
  };
  readonly evidenceRootAndProvenance: {
    readonly evidenceRootHash: string;
    readonly provenanceChainId: string;
  };
  readonly bindingStatus: 'UNBOUND' | 'BOUND' | 'VALIDATED' | 'EXECUTABLE' | 'EXECUTED' | 'EVIDENCE_BOUND' | 'STALE' | 'INVALID';
}
```

---

## 3. The Domain Binding Lifecycle State Machine

Every domain model instance and derived calculation progresses through a strict, deterministic state machine:

```
    ┌──────────┐      Bind Source      ┌──────────┐     Validate Rules     ┌───────────┐
    │ UNBOUND  │ ────────────────────> │  BOUND   │ ────────────────────> │ VALIDATED │
    └──────────┘                       └──────────┘                        └─────┬─────┘
                                                                                 │
                                                                       Seal Token Issued
                                                                                 │
                                                                                 ▼
    ┌──────────────┐     Mint Evidence    ┌──────────┐     Execute Solver   ┌────────────┐
    │EVIDENCE_BOUND│ <─────────────────── │ EXECUTED │ <─────────────────── │ EXECUTABLE │
    └──────┬───────┘                      └──────────┘                      └────────────┘
           │
  Upstream Mutates
           │
           ▼
    ┌──────────────┐
    │    STALE     │
    └──────────────┘
```

1. **`UNBOUND`**: Domain model exists in memory prior to canonical revision registration.
2. **`BOUND`**: Bound to a specific `canonicalEntityId` and `canonicalRevisionId` in `EngineeringObjectOS`.
3. **`VALIDATED`**: Domain-specific design rules and boundary condition manifests pass validation.
4. **`EXECUTABLE`**: `SimulationAuthorityInternal` issues an execution seal token bound to `inputManifestDigest`.
5. **`EXECUTED`**: Computation completes successfully without numerical divergence or boundary violations.
6. **`EVIDENCE_BOUND`**: Immutable SHA-256 evidence record is registered in `EvidenceBus` and `PLMProjectionAdapter`.
7. **`STALE`**: Any upstream modification in CAD, PCB, Electrical, or Harness moves state to `STALE` via `InvalidationPipelineEngine`.

---

## 4. Selective Invalidation & Change Propagation Semantics

Indiscriminate invalidation wastes compute resources. SECP enforces **Selective Invalidation** based on explicit directed dependency edges:

- **PCB Component Shift**: Invalidates `ElectricalHarnessInterface`, `ElectrothermalCoupling`, PCB-specific `FEMDeflection`, and PCB `CFDCooling`. Unaffected enclosure structural FEM runs remain `CURRENT`.
- **Enclosure Geometry Edit**: Invalidates `HarnessRouteWaypoints`, `CADMesh`, and `CFDFlowDomain`. Unaffected schematic MNA nodal electrical solves remain `CURRENT`.
- **Schematic Current/Voltage Change**: Invalidates `JouleHeatingMap` and `ThermalFEMLoads`. Unaffected mechanical clearance checks remain `CURRENT`.

---

## 5. Summary of Authority Boundaries

- **State Ownership & Governance**: `EngineeringObjectOS` + `RevisionEngine`
- **PLM Projection**: `CanonicalPLMProjectionAdapter`
- **Execution Authority**: `SimulationAuthorityInternal`
- **Evidence & Attestation**: `EngineeringHashChain` + `EvidenceBus`
- **Lifecycle & Invalidation**: `InvalidationPipelineEngine`

No domain engine may override these core authorities. All domain calculations consume canonical state and return sealed execution envelopes.
