# PATCH-SECP-000 — Project Foundation
**Phase 0 Architecture Specification**
**Platform:** Smart Engineering & CAD Platform (SECP)
**Status:** APPROVED / IN-PROGRESS

---

## 1. Overview
The goal of **PATCH-SECP-000** is to establish the monorepo architecture, module boundaries, core C++ build hooks, type definitions, service architecture, and CI validation pipeline before introducing complex CAD/FEA kernel logic.

## 2. Directory Hierarchy
```text
secp/
├── apps/
│   ├── desktop/           # Desktop App (Tauri / Native host)
│   └── web/               # Web Application SPA
├── packages/
│   ├── engineering-types/ # Shared TypeScript engineering interfaces & BIM models
│   ├── geometry-api/      # High-level API wrapping C++ CAD kernel via WASM
│   ├── ui/                # Engineering UI component library & Viewport shaders
│   └── shared/            # Common math, string, and logging utilities
├── engines/
│   ├── cad-core/          # C++ B-Rep & Mesh geometry modeling kernel (CMake)
│   ├── simulation-core/   # C++ Finite Element Analysis (FEA) solver kernel
│   └── manufacturing-core/# C++ G-Code & CNC toolpath generation core
├── services/
│   ├── project-service/   # REST/gRPC service for project management
│   ├── asset-service/     # CAD file storage (STEP, IGES, STL, SECP-Native)
│   └── provenance-service/# Engineering audit logs & immutable revision tracking
├── database/              # PostgreSQL schemas, migrations, and seed scripts
├── tests/                 # End-to-End & Integration CI Test Suites
└── docs/                  # Architecture Decision Records (ADRs) & Specs
```

## 3. Acceptance Criteria (Acceptance Matrix)
1. **✓ repository**: Directory hierarchy initialized with clear monorepo boundaries.
2. **✓ build**: Monorepo compilation pipeline configured for packages & C++ engines.
3. **✓ frontend starts**: Modern Web application initialized and running on port 3000.
4. **✓ C++ core builds**: CMake build system verified for `cad-core`, `simulation-core`, and `manufacturing-core`.
5. **✓ database connection**: PostgreSQL connection health check and schema validation operating.
6. **✓ CI test**: Automated integration suite executing test specs for geometry, types, and services.
