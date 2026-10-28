# Known Limitations — Phase V7

**Task ID**: SECP-PROGRAMMABLE-MATERIAL-V7-001  
**Phase**: V7 — Actual / As-Built Material State Reconstruction & Verification  

---

## 1. Boundary & Hardware Scope Constraints

1. **Synthetic Verification Level**: The current implementation has been algorithmically and numerically qualified using programmatic test datasets tagged as `SYNTHETIC_TEST_DATA`. Direct physical hardware sensor connection (e.g. live industrial CT scanner or laser ultrasonic gauge driver) is out of scope for software unit testing.
2. **IDW Spatial Extrapolation**: Inverse Distance Weighting interpolation is strictly bounded within the specified `samplingRadius`. Domain nodes beyond `samplingRadius` are classified as `UNMEASURED` and excluded from compliance assertions rather than being extrapolated into unmeasured space.
3. **Isotropic Material Property Reconstruction**: Current validation focuses on scalar Young's Modulus ($E$), Density ($\rho$), and Porosity ($\phi$). Anisotropic constitutive tensors ($C_{ijkl}$) in 3D orthotropic materials are deferred to higher-level material tensor modules.
