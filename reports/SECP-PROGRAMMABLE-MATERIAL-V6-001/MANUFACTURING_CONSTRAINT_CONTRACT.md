# SECP-PROGRAMMABLE-MATERIAL-V6-001: Manufacturing Constraint Contract Specification

## Overview
This specification defines the formal contract for manufacturing process profiles and equipment constraint definitions in SECP Core.

## Data Contract Fields

| Field Name | Type | Mandatory? | Description |
|---|---|---|---|
| `profileId` | `string` | Mandatory | Unique identifier for manufacturing profile |
| `profileVersion` | `string` | Mandatory | Revision ID for profile definition |
| `processType` | `enum` | Mandatory | Process type (`ADDITIVE_PBF`, `ADDITIVE_DED`, `SUBTRACTIVE_CNC`, `GRADED_MATERIAL_DEPOSITION`, `HYBRID_ADDITIVE_SUBTRACTIVE`) |
| `unitSystem` | `enum` | Mandatory | Unit system (`SI_MM_MPA`, `SI_M_PA`) |
| `syntheticProfile` | `boolean` | Mandatory | Flag indicating test profile (`true` = synthetic test profile, `false` = machine qualified profile) |
| `minWallThickness` | `number` | Mandatory | Minimum achievable wall thickness ($mm$) |
| `minFeatureSize` | `number` | Mandatory | Minimum printable or machinable feature size ($mm$) |
| `minCellSize` | `number` | Optional | Minimum lattice or cellular void size ($mm$) |
| `maxSpatialGradient` | `number` | Mandatory | Maximum allowable spatial modulus gradient $|\nabla E|_{max}$ ($MPa/mm$) |
| `processResolution` | `number` | Mandatory | Spatial resolution / laser spot size / tool step ($mm$) |
| `buildDirection` | `Vector3D` | Optional | 3D normalized build vector `{ x, y, z }` |
| `minOverhangAngle` | `number` | Optional | Minimum self-supporting overhang angle ($^\circ$ from horizontal) |
| `materialCompatibility` | `string[]` | Mandatory | Array of compatible material IDs |
| `qualificationStatus` | `enum` | Mandatory | Qualification level (`SYNTHETIC_TEST_PROFILE`, `PROCESS_MODEL_EVALUATED`, `MACHINE_PROFILE_QUALIFIED`, `PHYSICALLY_MANUFACTURED_AND_MEASURED`) |

## Validation Rules
1. `profileId`, `profileVersion` must be non-empty strings.
2. `minWallThickness`, `minFeatureSize`, `processResolution` must be strictly positive numbers ($> 0$).
3. `maxSpatialGradient` must be strictly positive ($> 0$).
4. If `syntheticProfile === false`, `qualificationStatus` cannot be `SYNTHETIC_TEST_PROFILE` and must specify `qualifiedMachineId`.
5. If `buildDirection` is specified, its magnitude must equal $1.0 \pm 10^{-4}$.
