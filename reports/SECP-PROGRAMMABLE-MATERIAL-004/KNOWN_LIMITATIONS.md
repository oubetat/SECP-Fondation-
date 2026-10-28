# Known Limitations: SECP-PROGRAMMABLE-MATERIAL-004

1. **Element Scope:** Spatial material mapping is currently fully implemented and verified for 1D bar elements (`Bar1DFormulation`). 3D continuum elements (`TET4PlasticFormulation`) require corresponding integration point coordinate mapping extensions in future iterations.
2. **Interpolation Methods:** Currently supports analytic expressions and constant property fields; advanced mesh-based voxel/point-cloud interpolation requires a dedicated spatial lookup adapter.
