# SECP — PROMPT-012 — Unified Intent Dispatcher Evidence

## 1. Architectural Summary
Transform the SECP design tool pipeline from direct UI-to-engine mutations to a canonical, intent-based execution model.

- **Engineering Single Source of Truth (SOT)**: All actions flow through `EngineeringDocument`.
- **Intent Dispatcher**: `CanonicalIntentDispatcher277` validates and routes all user intents.
- **Tool Contract**: `EngineeringTool` interface standardizes tool execution.
- **Selection Integration**: Integrated with PROMPT-010 `SelectionReference`.

## 2. Implementation Artifacts
- `src/engine/viewport/EngineeringIntent277.ts`: Defined the `EngineeringIntent` and `DispatchResult` contracts.
- `src/engine/viewport/EngineeringTool277.ts`: Standardized the `EngineeringTool` interface.
- `src/engine/viewport/CanonicalIntentDispatcher277.ts`: The central router and validator for all engineering intents.
- `src/engine/viewport/ExtrudeTool277.ts`: Canonical implementation for solid extrusion.
- `src/engine/viewport/AssemblyMateTool277.ts`: Canonical implementation for assembly mates.

## 3. Verification Results
### E2E Dispatcher Tests
Ran `npx vitest src/engine/viewport/__tests__/UnifiedIntentDispatcher.test.ts`:
- **✓ Rejects intent targeting the wrong document identity**
- **✓ Rejects intent with an unsupported tool ID**
- **✓ Dispatches Extrude Intent, mutates EngineeringDocument, and increments Revision**
- **✓ Validates PROMPT-010 SelectionReferences during intent dispatch**
- **✓ Protects against Direct Mutation Bypass**
- **✓ Fails gracefully when the engineering kernel throws an error**

### UI Migration
- Refactored `App.tsx`:
  - `handleAssemblyIntent` now uses `AssemblyMateTool277` and `CanonicalIntentDispatcher277`.
  - `onApplySketchExtrude` now uses `ExtrudeTool277` and `CanonicalIntentDispatcher277`.
  - `onExtrude` (Sketch Editor) now uses `ExtrudeTool277` and `CanonicalIntentDispatcher277`.

## 4. Closing Statement
The Unified Intent Dispatcher is now the mandatory gateway for all design tools. Direct UI -> Engine mutation paths have been eliminated for the migrated tools.
