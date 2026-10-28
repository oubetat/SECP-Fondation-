# SECP-PROGRAMMABLE-MATERIAL-V6-001: Spatial Field Manufacturability Audit

## Audit Overview
This audit details the spatial material field property gradient and feature size evaluation performed by `ManufacturingConstraintEngine`.

## Evaluated Rule Categories

### 1. Spatial Property Gradient Rule (`RULE_MAX_SPATIAL_GRADIENT`)
- **Metric**: Directional modulus gradient magnitude $|\nabla E(\mathbf{x})| = \frac{|E(\mathbf{x}_2) - E(\mathbf{x}_1)|}{\|\mathbf{x}_2 - \mathbf{x}_1\|}$ ($MPa/mm$).
- **Allowable Limit**: Defined by `profile.maxSpatialGradient`.
- **Verdict**:
  - Compliant fields ($|\nabla E| \le \text{limit}$): Pass.
  - Non-compliant fields ($|\nabla E| > \text{limit}$): Triggers `VIOLATION` with exact element IDs, coordinates, measured gradient, allowable limit, and exceedance delta.

### 2. Feature Size & Wall Thickness Rule (`RULE_MIN_FEATURE_SIZE`, `RULE_MIN_WALL_THICKNESS`)
- **Metric**: Characteristic element size $h = (6 \cdot V)^{1/3}$ or bar length $L$, and section equivalent thickness $\sqrt{A}$.
- **Allowable Limit**: `profile.minFeatureSize` and `profile.minWallThickness`.
- **Verdict**: Sub-resolution features emit `VIOLATION` findings preventing false manufacturability claims.

### 3. Material Process Compatibility Rule (`RULE_MATERIAL_COMPATIBILITY`)
- **Metric**: Element material ID presence in `profile.materialCompatibility`.
- **Verdict**: Non-listed materials trigger `VIOLATION`.
