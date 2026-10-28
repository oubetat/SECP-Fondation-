# Reconstruction Method Technical Report

**Task ID**: SECP-PROGRAMMABLE-MATERIAL-V7-001  
**Phase**: V7 — Actual / As-Built Material State Reconstruction & Verification  

---

## 1. Mathematical Formulation

Reconstruction of continuous physical material fields from point-wise measurement datasets is executed using **Inverse Distance Weighting (IDW) Interpolation** with sampling radius limiting and uncertainty propagation:

$$E_{asbuilt}(\mathbf{x}) = \frac{\sum_{i \in N(\mathbf{x})} w_i(\mathbf{x}) E_i}{\sum_{i \in N(\mathbf{x})} w_i(\mathbf{x})}$$

where:
$$w_i(\mathbf{x}) = \frac{1}{\|\mathbf{x} - \mathbf{x}_i\|^p}, \quad p = 2.0$$

### Sampling Neighborhood $N(\mathbf{x})$:
Points $\mathbf{x}_i$ are included in $N(\mathbf{x})$ if and only if $\|\mathbf{x} - \mathbf{x}_i\| \le R_{sample}$.
If $N(\mathbf{x}) = \emptyset$, point $\mathbf{x}$ is classified as `UNMEASURED`.

### Uncertainty Propagation:
$$\sigma_{rec}(\mathbf{x}) = \frac{\sqrt{\sum_{i \in N(\mathbf{x})} w_i(\mathbf{x})^2 \sigma_i^2}}{\sum_{i \in N(\mathbf{x})} w_i(\mathbf{x})}$$

---

## 2. Unmeasured Region & Coverage Tracking

The engine explicitly calculates the spatial coverage ratio:
$$\text{Coverage Ratio} = \frac{N_{measured\_eval\_points}}{N_{total\_eval\_points}}$$

Points with zero neighbors within $R_{sample}$ produce an `unmeasuredVolumeRatio` and record bounding boxes of unmeasured spatial domains.
