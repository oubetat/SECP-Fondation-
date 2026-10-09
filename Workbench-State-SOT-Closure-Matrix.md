# Workbench State SOT Closure Matrix

This matrix maps every engineering-related state discovered in the SECP Industrial OS v2 workspace, classifies its ownership under the new architecture, and verifies whether it fulfills the revision and topology invariants.

---

## 1. State Classification Matrix (Rule 5 Requirements)

### State 1: `canonicalDocument`
*   **State**: `canonicalDocument`
*   **File**: `src/App.tsx` (Line 508)
*   **Owner**: Root `App` Component
*   **Workbench**: Platform (All)
*   **Purpose**: Tracks the active SOT document
*   **Data Type**: `EngineeringDocument`
*   **Engineering Meaning**: Holds the complete, authoritative feature history and CAD assembly constraints
*   **Classification**: `CANONICAL_ENGINEERING_STATE`
*   **Current Authority**: Root App Component
*   **Canonical Source**: `EngineeringDocument`
*   **Persistence**: **YES** (Standard workspace persistence)
*   **Lifecycle**: Maintained for the duration of the workspace session
*   **Tab Behavior**: Survives all tab switching and unmounting
*   **Engineering Consequence**: Determines the master geometry recompute loop
*   **Migration Required**: **NO**
*   **Migration Safety**: N/A
*   **Evidence**: `/src/verification/patch330/__tests__/PATCH-330-WorkbenchSOTClosure.test.ts` (Test A)

---

### State 2: `activeSolid`
*   **State**: `activeSolid`
*   **File**: `src/App.tsx` (Line 500)
*   **Owner**: Root `App` Component
*   **Workbench**: Design / Viewport
*   **Purpose**: Keeps the calculated B-Rep Solid of the active sketch/extrusions
*   **Data Type**: `CadSolidEntity`
*   **Engineering Meaning**: Evaluated geometric representation of CAD solid boundaries
*   **Classification**: `DERIVED_DOMAIN_STATE`
*   **Current Authority**: Root App Component (via `DocumentEvaluator`)
*   **Canonical Source**: `EngineeringDocument`
*   **Persistence**: **NO** (Dynamically re-evaluated from feature history)
*   **Lifecycle**: Recomputed whenever `canonicalDocument` updates
*   **Tab Behavior**: Survives all tab switches (always visible in central viewport)
*   **Engineering Consequence**: Primary visualization and pick target for CAD operations
*   **Migration Required**: **NO**
*   **Migration Safety**: N/A
*   **Evidence**: `/src/verification/patch330/__tests__/PATCH-330-WorkbenchSOTClosure.test.ts` (Test A)

---

### State 3: `assemblyData`
*   **State**: `assemblyData`
*   **File**: `src/App.tsx` (Line 503)
*   **Owner**: Root `App` Component
*   **Workbench**: Assembly
*   **Purpose**: Tracks parts and mechanical joints (mates)
*   **Data Type**: `{ components: AssemblyComponent[], mates: AssemblyMate[] }`
*   **Engineering Meaning**: Authoritative spatial and relational structure of the assembly
*   **Classification**: `CANONICAL_ENGINEERING_STATE`
*   **Current Authority**: Root App Component
*   **Canonical Source**: `EngineeringDocument`
*   **Persistence**: **YES** (Serialized inside document)
*   **Lifecycle**: Persistent across session reloads
*   **Tab Behavior**: Survives all tab switching and unmounted states
*   **Engineering Consequence**: Drives mechanical kinematics and coordinate systems
*   **Migration Required**: **NO**
*   **Migration Safety**: N/A
*   **Evidence**: Programmatic constraints verified in `AssemblyWorkspace.tsx`

---

### State 4: `patterns`
*   **State**: `patterns`
*   **File**: `src/components/PatternEngineInspector.tsx` (Line 36)
*   **Owner**: `PatternEngine` (Transient Inspector State)
*   **Workbench**: Pattern Modeling
*   **Purpose**: Stores configured patterns and instances
*   **Data Type**: `PatternFeature[]`
*   **Engineering Meaning**: Candidate layout parameters for creating repeated structures
*   **Classification**: `TRANSACTION_STATE` (Ephemeral calculations)
*   **Current Authority**: Local Component State
*   **Canonical Source**: `PatternEngine` memory space
*   **Persistence**: **NO**
*   **Lifecycle**: `EPHEMERAL_BY_DESIGN` (Destroyed upon inspector unmount)
*   **Tab Behavior**: Destroyed on tab switch (unmount behavior)
*   **Engineering Consequence**: Only visualizes candidates; cannot silently modify the CAD SOT
*   **Migration Required**: **NO** (Intentionally Ephemeral by Design)
*   **Migration Safety**: Highly safe; ensures patterns do not bypass standard CAD action loop
*   **Evidence**: `/src/verification/patch330/__tests__/PATCH-330-WorkbenchSOTClosure.test.ts` (Test F)

---

### State 5: `transactions`
*   **State**: `transactions`
*   **File**: `src/engine/cad/direct/DirectModelingEngine.ts`
*   **Owner**: `DirectModelingEngine` instance
*   **Workbench**: Direct Modeling
*   **Purpose**: Stores offset, push, and pull commands
*   **Data Type**: `DirectModelingTransaction[]`
*   **Engineering Meaning**: Transaction log for facet and face manipulation
*   **Classification**: `TRANSACTION_STATE` (Transient mathematical calculations)
*   **Current Authority**: `DirectModelingEngine` isolated memory
*   **Canonical Source**: Direct Modeling Engine memory space
*   **Persistence**: **NO**
*   **Lifecycle**: `EPHEMERAL_BY_DESIGN` (Destroyed upon tab switch)
*   **Tab Behavior**: Destroyed on tab switch (unmount behavior)
*   **Engineering Consequence**: Purely calculations and sandbox geometry preview
*   **Migration Required**: **NO** (Intentionally Ephemeral by Design)
*   **Migration Safety**: Safe; prevents direct modeling from creating un-serializable parallel features
*   **Evidence**: `/src/verification/patch330/__tests__/PATCH-330-WorkbenchSOTClosure.test.ts` (Test F)

---

### State 6: `session.features`
*   **State**: `session.features`
*   **File**: `src/components/FeatureRecognitionWorkbenchPanel.tsx`
*   **Owner**: `FeatureRecognitionSession320` instance
*   **Workbench**: Reverse Engineering
*   **Purpose**: Stores list of recognized cylindrical, planar, or spherical surfaces
*   **Data Type**: `RecognizedFeature[]`
*   **Engineering Meaning**: Candidate reverse-engineering features extracted from mesh
*   **Classification**: `CANDIDATE_STATE`
*   **Current Authority**: `FeatureRecognitionSession320` local state
*   **Canonical Source**: Segmented mesh geometry algorithms
*   **Persistence**: **NO**
*   **Lifecycle**: `EPHEMERAL_BY_DESIGN` (Destroyed when panel unmounts)
*   **Tab Behavior**: Destroyed when panel unmounts on tab switch
*   **Engineering Consequence**: Holds suggestions; requires explicit user "Commit" to enter SOT
*   **Migration Required**: **NO** (Intentionally Ephemeral by Design)
*   **Migration Safety**: Completely prevents unverified hypotheses from entering SOT
*   **Evidence**: `/src/verification/patch330/__tests__/PATCH-330-WorkbenchSOTClosure.test.ts` (Test C)

---

### State 7: `semanticMap`
*   **State**: `semanticMap`
*   **File**: `src/engine/features/ManufacturingSemantics.ts`
*   **Owner**: `ManufacturingSemanticsManager`
*   **Workbench**: Manufacturing / CAM
*   **Purpose**: Associates machining data with CAD geometric face IDs
*   **Data Type**: `Map<string, ManufacturingData>`
*   **Engineering Meaning**: Machining setups, allowances, and toolpaths mapped to faces
*   **Classification**: `DERIVED_DOMAIN_STATE`
*   **Current Authority**: `ManufacturingSemanticsManager` global memory
*   **Canonical Source**: `EngineeringDocument` face topology IDs
*   **Persistence**: **NO**
*   **Lifecycle**: Bound to the active CAD document session
*   **Tab Behavior**: Survives tab switches (stored in global singleton instance)
*   **Engineering Consequence**: Stores machining process parameters derived from geometry
*   **Migration Required**: **NO**
*   **Migration Safety**: N/A
*   **Evidence**: Managed inside CAM tab correctly without SOT duplication

---

### State 8: `activePatchTab`
*   **State**: `activePatchTab`
*   **File**: `src/App.tsx`
*   **Owner**: Root `App` Component
*   **Workbench**: Platform UI
*   **Purpose**: Tracks which workbench or sub-view is selected by the user
*   **Data Type**: `string`
*   **Engineering Meaning**: Selected active panel UI tab identifier
*   **Classification**: `UI_ONLY`
*   **Current Authority**: React Component state
*   **Canonical Source**: None (Purely presentation state)
*   **Persistence**: **NO**
*   **Lifecycle**: Ephemeral UI state
*   **Tab Behavior**: Changed directly by user tab actions
*   **Engineering Consequence**: No engineering consequences or math alterations
*   **Migration Required**: **NO**
*   **Migration Safety**: N/A
*   **Evidence**: Standard React useState in `App.tsx`

---

## 2. Structural Proof Summary

*   **EngineeringDocument Identity**: **PASS** (Owned by `App.tsx`)
*   **No Parallel Engineering SOT**: **PASS** (Engines like `PatternEngine` and `DirectModelingEngine` are mathematically isolated and classified as `TRANSACTION_STATE` or `CANDIDATE_STATE`, meaning they have **zero** silent write authority on the canonical CAD feature history).
*   **Tab Switching Life-Cycle**: States requiring persistence (`canonicalDocument`, `assemblyData`, `activeSolid`) are held in parent memory. Engine candidates (`session.features`, `patterns`) are **Ephemeral by Design**, meaning they are allowed to reset on switch to protect SOT cleanliness.
