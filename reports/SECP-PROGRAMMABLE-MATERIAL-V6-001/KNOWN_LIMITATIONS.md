# SECP-PROGRAMMABLE-MATERIAL-V6-001: Known Limitations

## Declared Capabilities & Limits

### 1. Declared Supported Scope (V6)
- **Profile Contract**: Profile validation, schema enforcement, material compatibility checks.
- **Geometric Audits**: Minimum feature size ($h_{min}$) and minimum wall thickness ($t_{min}$) audits for 1D bars and 3D continuum tetrahedra.
- **Spatial Field Audits**: Spatial property gradient magnitude limits ($|\nabla E|_{max}$).
- **Anti-False-Claim Gate**: Strict separation between synthetic profiles (`SYNTHETIC_TEST_PROFILE`) and qualified machine profiles (`MACHINE_PROFILE_QUALIFIED`).

### 2. Explicit Non-Claims (Fail-Closed)
- **No Physical Manufacturing Claim**: Evaluated software profiles do NOT prove physical fabrication unless actual physical inspection measurement data is supplied (reserved for Phase V7+).
- **Transient Thermal/Residual Stress Physics**: Process thermal melt pool dynamics or residual strain fields are not simulated in V6 (reserved for V7/V8).
