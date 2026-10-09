# SECP Industrial OS v2 — Canonical Serialization Architecture

## 1. Executive Summary & Purpose
In industrial engineering operating systems, computing hash chains, forensic audit logs, and digital twins requires that equivalent semantic states produce byte-for-byte identical representations.

Without a canonical serialization specification:
- JavaScript property traversal order variations produce non-deterministic outputs.
- Inconsistent floating-point string representations (e.g. `-0` vs `0`) produce hash divergence.
- Unicode character composition forms (e.g. `\u00e9` vs `e\u0301`) break cryptographic signatures.
- Cyclic graphs and unexpected prototype properties cause stack overflows and security vulnerabilities.

`PATCH-009` implements a pure, deterministic normalization and serialization pipeline across all SECP subsystems.

> **CRITICAL ARCHITECTURAL PRINCIPLE**:  
> `Canonical serialization does not prove engineering correctness or artifact integrity.`  
> Serialization provides a deterministic byte representation of an engineering structure. Hashing, integrity verification, and physical validation occur in subsequent layers.

---

## 2. The Serialization Pipeline

```
        +-----------------------------------+
        |       Engineering Input Object     |
        +-----------------------------------+
                          |
                          v
        +-----------------------------------+
        |       Canonical Normalization      |
        |  - Unicode NFC Normalization      |
        |  - Finite Number Normalization    |
        |  - -0 -> 0 Normalization          |
        |  - BigInt Typed Markers           |
        |  - Lexicographical Key Sorting    |
        |  - Array Sequence Preservation    |
        |  - Cycle & Safety Detection       |
        +-----------------------------------+
                          |
                          v
        +-----------------------------------+
        |         Canonical Stringify       |
        |  - Compact JSON (0 extra spaces)  |
        |  - Exact Type Preservation        |
        +-----------------------------------+
                          |
                          v
        +-----------------------------------+
        |       UTF-8 Byte Encoding         |
        |  - TextEncoder byte length        |
        +-----------------------------------+
                          |
                          v
        +-----------------------------------+
        |   CanonicalSerializationResult    |
        |  - schemaVersion: "1.0.0"         |
        |  - canonicalString                |
        |  - byteLength                     |
        |  - normalized                     |
        +-----------------------------------+
```

---

## 3. Data Normalization Policies

### A. Object Properties & Key Ordering
- Object keys are normalized with Unicode **NFC** and sorted lexicographically in ascending Unicode code point order (`a < b ? -1 : a > b ? 1 : 0`).
- Insertion order has zero impact on canonical representation (`{b: 2, a: 1}` $\equiv$ `{"a":1,"b":2}`).

### B. Array Semantics
- Array sequence order is strictly **preserved** without automated sorting.
- Arrays in engineering carry explicit positional semantics (e.g. polygon vertices, coordinate vectors, sequence steps).

### C. Numeric Policy & Floating-Point Numbers
- **Finite Numbers**: Preserved directly without arbitrary rounding.
- **Negative Zero (`-0`)**: Normalized to `0` (`Object.is(n, -0) ? 0 : n`).
- **Non-Finite Values (`NaN`, `Infinity`, `-Infinity`)**: Strictly rejected with `NonFiniteNumberError`.

### D. BigInt
- Preserved deterministically as typed descriptor objects:
  ```json
  {"$type":"bigint","$value":"12345678901234567890"}
  ```

### E. Dates
- Existing `Date` objects in input data are normalized into deterministic ISO-8601 UTC strings (`date.toISOString()`).
- The serialization engine **strictly prohibits** invoking `Date.now()` or generating ambient timestamps.

### F. Undefined & Null
- `undefined` inside objects: **Omitted** from the canonical object representation.
- `undefined` inside arrays: **Rejected** with `UndefinedInArrayError` to prevent ambiguous array gaps.
- `null`: Preserved faithfully as `null`.

### G. Unsupported Types & Cycle Detection
- Functions, Symbols, WeakMaps, WeakSets, Promises, and DOM Nodes are rejected with `UnsupportedTypeError`.
- Circular graphs are detected using an active ancestor traversal set and rejected with `CircularReferenceError`.
- Prototype pollution attempts (`__proto__`, `constructor`, `prototype`) are blocked with `PrototypePollutionAttemptError`.

---

## 4. Architectural Boundaries: Serialization vs. Identity vs. Integrity vs. Hashing

| Dimension | Scope in SECP | Implemented In |
| :--- | :--- | :--- |
| **Identity** | What is this engineering artifact? | PATCH-008 (`CanonicalEngineeringIdentity`) |
| **Serialization** | How is it represented as deterministic bytes? | **PATCH-009 (`CanonicalSerializer`)** |
| **Hashing** | What is its cryptographic fingerprint? | PATCH-010 (Engineering Hash Chain) |
| **Integrity** | Has the artifact been tampered with? | PATCH-010+ |
| **Verification** | Is the physics / engineering valid? | Verification Kernels & Acceptance Gates |

---

## 5. Scope & Limitations of PATCH-009
- **Included**:
  - `CanonicalSerializer` and `CanonicalNormalizer`.
  - Comprehensive structural validator `CanonicalSerializationValidator`.
  - UTF-8 byte length calculation via `TextEncoder`.
  - Acceptance gate `CanonicalSerializationGate`.
- **Prohibited in PATCH-009**:
  - Cryptographic hashing (SHA-256, BLAKE3, etc.) — strictly reserved for PATCH-010.
  - Merkle DAG graph building.
  - Runtime clock injection.
