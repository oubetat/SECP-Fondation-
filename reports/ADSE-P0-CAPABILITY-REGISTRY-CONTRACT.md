# ADSE-P0-CAPABILITY-REGISTRY-CONTRACT.md
# SECP — ADSE-P0: Capability Registry Contract

---

## 1. Role of the Engineering Capability Registry
The Capability Registry (`CapabilityRegistry.ts` & `ADSEEngine.ts`) records and exposes the real engineering capabilities of SECP and ADSE.

For each capability, it records:
- `capabilityId`: Unique identifier.
- `pluginId`: Owning plugin container.
- `maturity`: M0 to M10 level.
- `coreBound`: True if bound to CoreExecutionAuthority.
- `canonicalBound`: True if bound to Canonical Revision.
- `executable`: True if deterministic solver exists.
- `verified`: True if passed verification gates.
- `persisted`: True if state survives session boundary.
- `benchmarkValidated`: True if validated against benchmarks.
- `published`: True if approved for production use.

---

## 2. Querying Capabilities
Engineers can query: "What capabilities exist at M10 maturity with evidence?"
The registry provides an accurate, evidence-backed answer.
