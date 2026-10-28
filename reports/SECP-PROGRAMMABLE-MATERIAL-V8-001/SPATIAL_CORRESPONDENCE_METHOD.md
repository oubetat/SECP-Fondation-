# Spatial Correspondence Method Technical Report

**Task ID**: SECP-PROGRAMMABLE-MATERIAL-V8-001  
**Phase**: V8 — Spatial Material Deviation Analysis & Engineering Conformance Verification  

---

## 1. Spatial Matching & Point-wise Correspondence

To execute point-wise spatial deviation analysis between an **Intended Material Field** ($p_{intended}(\mathbf{x})$) and a **Reconstructed As-Built State** ($p_{actual}(\mathbf{x})$), spatial correspondence is established across common 3D evaluation coordinates $\mathbf{x} = (x, y, z)$:

1. **Intended Evaluation**:
   $$p_{intended}(\mathbf{x}) = \text{SpatialMaterialField.evaluateProperty}(propertyId, x, y, z)$$
2. **Actual As-Built Evaluation**:
   $$p_{actual}(\mathbf{x}) = \text{ReconstructedFieldPoint.reconstructedProperties}[propertyId].value$$

---

## 2. Spatial Mapping Verification & Safety Safeguards

### Coordinate Alignment Safeguard:
Coordinate points MUST be transformed into the canonical CAD local part frame using `CoordinateFrameTransformEngine.toLocal` prior to spatial field evaluation.

### Unmeasured Domain Safeguard:
If $\mathbf{x}$ lies in an unmeasured domain ($N(\mathbf{x}) = \emptyset$), $p_{actual}(\mathbf{x})$ is undefined.
The point record is assigned `isMeasured = false` and `status = NOT_MEASURED`.
Zero deviation ($\Delta p = 0$) MUST NOT be substituted for unmeasured locations.
