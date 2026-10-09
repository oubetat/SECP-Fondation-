# SECP ADSE Workbench UI Forensic Inventory

**Document ID:** `SECP-ADSE-UI-INVENTORY-001`  
**Classification:** Engineering UI Forensic Audit  
**Status:** `AUDITED`  
**Date:** `2026-09-29`

---

## 1. Executive Summary

A comprehensive audit of the SECP Workbench user interface components was conducted across `App.tsx`, `src/components/`, `src/engine/`, and associated stores/adapters.

The purpose is to catalog what UI surfaces exist, classify their state ownership, identify presentation vs authoritative paths, detect any parallel state, and establish clean compositional integration for the **Systems Engineering Workspace** without building a parallel application.

---

## 2. Component Forensic Census

| Component / Surface | File Path | State Ownership | Canonical Authority | Action Classification |
| :--- | :--- | :--- | :--- | :--- |
| **StartCenter** | `src/components/StartCenter.tsx` | Presentation / Session | `ProjectSessionManager` | Safe project entry point |
| **CadViewport3D** | `src/components/CadViewport3D.tsx` | Visual Presentation | `CanonicalRenderContract` | Projection-only / 3D Canvas |
| **DigitalThreadPanel** | `src/components/DigitalThreadPanel.tsx` | Presentation | `ADSEP4DigitalThreadEngine` | Reads P4 Digital Thread |
| **AssemblyEnginePanel** | `src/components/AssemblyEnginePanel.tsx` | Projection | `AssemblyEngine` / P5 | Assembly tree projection |
| **EngineeringCorePanel** | `src/components/EngineeringCorePanel.tsx` | Projection | `CoreExecutionAuthority` | Direct Core status inspection |
| **RevisionManagementPanel** | `src/components/RevisionManagementPanel.tsx` | Projection / Controlled Mutation | `RevisionEngine` | Canonical Revision actions |
| **ProvenancePanel / Ledger** | `src/components/ProvenancePanel.tsx` | Projection | `ProvenanceGraph` | Immutable hash ledger |
| **VerificationPortal** | `src/components/verification/VerificationPortal.tsx` | Projection | Core Verification Gates | Hard acceptance gates view |
| **PluginSdkPanel** | `src/components/PluginSdkPanel.tsx` | Projection | `PluginAuthorityBoundary` | Plugin lifecycle view |
| **SimulationCaePanel** | `src/components/SimulationCaePanel.tsx` | Projection / Execution Request | `CoreExecutionAuthority` | FEM/CFD simulation dispatch |

---

## 3. Findings & Inventory Analysis

1. **Existing Strengths:**
   - The UI already contains strong domain-specific workshops (CAD, CAM, CAE, PLM, Governance, HPC, AI).
   - Core state mutations in existing panels already flow through `RevisionEngine` and `ProjectSessionManager`.
2. **Identified Integration Gaps:**
   - P0–P9 capabilities are currently segmented across individual studio panels rather than unified under a single **System Engineering Context**.
   - No unified **System Architecture Canvas** directly bound to P3 elements and P4 Digital Thread nodes.
   - Requirements are viewed in isolation instead of a full **Requirements Truth View** connected to functions, subsystems, allocations, interfaces, verification, and evidence.
   - No multi-domain **Engineering State Dashboard** that provides recomputable metrics with cryptographic provenance.
3. **Prohibited Patterns Verified Absent:**
   - No UI-owned parallel revision trees.
   - No canvas-local databases pretending to be canonical state.
   - No simulated mock verification results presented as authoritative truth.

---

## 4. Composition Strategy

The Systems Engineering Workspace will compose and bridge directly into:
- `ADSEP1Engine` (Requirements & Allocations)
- `ADSEP2Engine` (MBSE Semantic Graphs & Flows)
- `ADSEP3ArchitectureEngine` (System Architecture & Subsystems)
- `ADSEP4DigitalThreadEngine` (Bidirectional Digital Thread)
- `ADSEP5StructuralEngine` (Structural Context & Physical Assembly)
- `ADSEP6ThermalEngine` (Thermal Context)
- `ADSEP7PowerEngine` (Power Context)
- `ADSEP8ControlEngine` (Controls Context)
- `ADSEP9CommunicationEngine` (Cyber-Physical Communications Context)
- `CoreExecutionAuthority` & `GenericExecutionRegistry` (Execution & Verification)
