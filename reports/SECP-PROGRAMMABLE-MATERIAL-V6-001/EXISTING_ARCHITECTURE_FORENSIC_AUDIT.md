# SECP-PROGRAMMABLE-MATERIAL-V6-001: Existing Architecture Forensic Audit

## Executive Forensic Audit
This report documents Phase 1 forensic inspection of SECP Core (V1–V5 baseline) ahead of implementing Phase V6 (*Manufacturing Constraints Integration & Manufacturability Qualification*).

---

## Answers to Mandatory Forensic Questions

### 1. How does the spatial material field link to canonical geometry?
**Source Files**: `src/engine/fem/core/SpatialMaterialField.ts`, `src/engine/fem/core/GeometryMaterialAssignment.ts`, `src/engine/fem/core/GeometryMaterialValidator.ts`  
**Data Path**: `SpatialMaterialField.canonicalGeometryId` $\leftrightarrow$ `GeometryMaterialAssignment.canonicalGeometryId` $\leftrightarrow$ `FEMModel.geometryMetadata.geometryId`.  
**Verdict**: Direct identity matching and revision lock enforced pre-flight by `GeometryMaterialValidator.validateAssignment()`.

### 2. What coordinates and units are used to evaluate the field?
**Source Files**: `src/engine/fem/core/SpatialMaterialField.ts`, `src/engine/fem/core/Bar1DFormulation.ts`, `src/engine/fem/core/TET43DFormulation.ts`  
**Data Path**: Coordinates are evaluated as 3D point `{ x, y, z }` in global Cartesian or transformed local coordinates (`CoordinateFrameTransformEngine.toLocal()`) in `mm`. Property outputs return `E` in `MPa`, `nu` in `dimensionless`, `density` in `tonne/mm3` or `kg/m3`.

### 3. Can material properties be mapped to identifiable geometric regions?
**Source Files**: `src/engine/fem/core/GeometryMaterialAssignment.ts`, `src/engine/fem/core/GeometryMaterialValidator.ts`  
**Data Path**: Elements are mapped via `boundElementIds` and `targetDomain` spatial bounding boxes. `GeometryDomainAuditor` verifies spatial containment.

### 4. How are minimum wall thickness or cell sizes currently represented?
**Source Files**: `src/engine/fem/core/SpatialMaterialField.ts`  
**Data Path**: `PropertyFieldSpec.manufacturingConstraints` includes `minFeatureSize` and `maxGradient`. However, no pre-flight manufacturing validation engine exists in V5 to audit these against process equipment profiles.

### 5. Is there an existing contract for manufacturing process profiles or equipment specs?
**Source Files**: N/A (Gap Identified)  
**Verdict**: No standalone process profile contract exists in SECP Core. Phase V6 implements `ManufacturingConstraintProfile.ts` and `ManufacturingConstraintEngine.ts`.

### 6. How are process precision and spatial gradient limits represented?
**Source Files**: `src/engine/fem/core/SpatialMaterialField.ts`  
**Data Path**: `PropertyFieldSpec.bounds` limits min/max property values. Gradient limits $|\nabla E(\mathbf{x})|$ are declared in `manufacturingConstraints.maxGradient`.

### 7. Is there a mechanism to specify manufacturing/build direction?
**Source Files**: `src/engine/fem/core/GeometryMaterialAssignment.ts`  
**Data Path**: `CoordinateFrameContract` defines translation and 3D rotation matrix. In V6, `ManufacturingConstraintProfile` will explicitly include `buildDirection` vector `{ x, y, z }` and `minOverhangAngle`.

### 8. Is spatial field manufacturability verified, or is verification currently limited to FEM?
**Source Files**: `src/engine/fem/core/FEMCore.ts`  
**Verdict**: Prior to V6, verification is strictly FEM structural mechanics ($K_e$ assembly, boundary conditions, PCG linear solve, stress recovery, energy balance). Manufacturability audit is NOT executed.

### 9. What happens when geometry, field, or process profile is modified?
**Source Files**: `src/engine/fem/core/FEMEvidenceEngine.ts`  
**Data Path**: `FEMEvidenceEngine.isEvidenceStale()` evaluates `geometryHash` and `assignmentHash`. Updating any geometry, spatial field, or assignment revision invalidates locked evidence.

### 10. Can every violation be traced to the specific geometric element or spatial material region?
**Source Files**: `src/engine/fem/core/GeometryMaterialValidator.ts`  
**Verdict**: Validation errors identify `assignmentId` and `elementId`. In V6, `ManufacturingConstraintEngine` will report exact `elementId`, `location`, `measuredValue`, `allowableLimit`, and `severity`.
