import { CaseDefinition3D, PreFlightCheckReport } from './AdaptiveCFDTypes';
import { FvmMesh3D } from '../Fvm3DTypes';

export class PreFlightValidator {
  /**
   * Performs rigorous pre-flight physics, thermodynamics, geometry, and boundary checks
   * on the case definition and mesh before admitting the simulation to numerical solver.
   * Fail-closed: Any unphysical, non-finite, or degenerate input sets isReadyForSolve = false.
   */
  public static validateCase(caseDef: CaseDefinition3D, mesh: FvmMesh3D): PreFlightCheckReport {
    const checkedItems: { code: string; name: string; passed: boolean; message: string }[] = [];
    const identifiedRisks: string[] = [];
    const recommendedAdjustments: string[] = [];

    // Helper to record check
    const recordCheck = (code: string, name: string, passed: boolean, message: string, risk?: string, adj?: string) => {
      checkedItems.push({ code, name, passed, message });
      if (!passed) {
        identifiedRisks.push(risk || message);
        if (adj) recommendedAdjustments.push(adj);
      }
    };

    // 1. Case & Fluid Presence
    if (!caseDef) {
      recordCheck('CHK_CASE_EXISTENCE', 'Case Definition Existence', false, 'Case definition is null or undefined.', 'Null case definition', 'Provide valid CaseDefinition3D.');
      return { isReadyForSolve: false, checkedItems, identifiedRisks, recommendedAdjustments };
    }

    const fluid = caseDef.fluid;
    if (!fluid) {
      recordCheck('CHK_FLUID_EXISTENCE', 'Fluid Properties Presence', false, 'No fluid properties object provided.', 'Missing fluid specification', 'Define fluid physical properties.');
      return { isReadyForSolve: false, checkedItems, identifiedRisks, recommendedAdjustments };
    }

    // 2. Fluid Density Check
    const rho = fluid.densityKgM3 ?? fluid.density;
    const isRhoValid = typeof rho === 'number' && Number.isFinite(rho) && rho > 0;
    recordCheck(
      'CHK_FLUID_DENSITY',
      'Fluid Density Sanity',
      isRhoValid,
      isRhoValid ? `Fluid density is valid: ${rho} kg/m³` : `Fluid density must be positive finite number. Got: ${rho}`,
      !isRhoValid ? `Unphysical fluid density: ${rho}` : undefined,
      !isRhoValid ? 'Specify positive finite density in kg/m³ (e.g. 1.225 for air, 998.2 for water).' : undefined
    );

    // 3. Fluid Viscosity Check
    const mu = fluid.viscosityPaS ?? fluid.viscosity;
    const isMuValid = typeof mu === 'number' && Number.isFinite(mu) && mu > 0;
    recordCheck(
      'CHK_FLUID_VISCOSITY',
      'Fluid Dynamic Viscosity Sanity',
      isMuValid,
      isMuValid ? `Fluid dynamic viscosity is valid: ${mu} Pa·s` : `Fluid viscosity must be positive finite number. Got: ${mu}`,
      !isMuValid ? `Unphysical fluid viscosity: ${mu}` : undefined,
      !isMuValid ? 'Specify positive finite dynamic viscosity in Pa·s (e.g. 1.81e-5 for air).' : undefined
    );

    // 4. Thermodynamics & Speed of Sound Check
    const gamma = fluid.specificHeatRatioGamma ?? fluid.specificHeatRatio ?? 1.4;
    const isGammaValid = typeof gamma === 'number' && Number.isFinite(gamma) && gamma > 1.0;
    recordCheck(
      'CHK_SPECIFIC_HEAT_RATIO',
      'Specific Heat Ratio (Gamma)',
      isGammaValid,
      isGammaValid ? `Specific heat ratio gamma is valid: ${gamma}` : `Specific heat ratio must be > 1.0. Got: ${gamma}`,
      !isGammaValid ? `Unphysical specific heat ratio: ${gamma}` : undefined,
      !isGammaValid ? 'Ensure specific heat ratio gamma > 1.0 (typically 1.4 for diatomic gases).' : undefined
    );

    const R = fluid.specificGasConstantR ?? fluid.gasConstant;
    const T_ref = fluid.referenceTemperatureK ?? 288.15;
    let speedOfSound = 340.3;
    let isThermodynamicsConsistent = true;
    let thermoMsg = 'Thermodynamic properties consistent.';

    if (R !== undefined) {
      if (typeof R !== 'number' || !Number.isFinite(R) || R <= 0) {
        isThermodynamicsConsistent = false;
        thermoMsg = `Invalid specific gas constant R: ${R} J/(kg·K)`;
      } else if (typeof T_ref !== 'number' || !Number.isFinite(T_ref) || T_ref <= 0) {
        isThermodynamicsConsistent = false;
        thermoMsg = `Invalid reference temperature: ${T_ref} K`;
      } else {
        speedOfSound = Math.sqrt(gamma * R * T_ref);
        thermoMsg = `Thermodynamic speed of sound evaluated: ${speedOfSound.toFixed(1)} m/s (gamma=${gamma}, R=${R}, T=${T_ref}K)`;
      }
    }
    recordCheck(
      'CHK_THERMODYNAMICS',
      'Thermodynamic Speed of Sound',
      isThermodynamicsConsistent,
      thermoMsg,
      !isThermodynamicsConsistent ? thermoMsg : undefined,
      !isThermodynamicsConsistent ? 'Ensure gas constant R > 0 and temperature T > 0.' : undefined
    );

    // 5. Reference Velocity & Kinematics
    const vRef = caseDef.referenceVelocityMS;
    const isVRefValid = vRef === undefined || (typeof vRef === 'number' && Number.isFinite(vRef) && vRef >= 0);
    recordCheck(
      'CHK_REFERENCE_VELOCITY',
      'Reference Velocity Sanity',
      isVRefValid,
      isVRefValid ? `Reference velocity is valid: ${vRef ?? 'N/A'} m/s` : `Reference velocity must be non-negative finite number. Got: ${vRef}`,
      !isVRefValid ? `Invalid reference velocity: ${vRef}` : undefined
    );

    // 6. Reference Geometric Scales
    const lRef = caseDef.referenceLengthM ?? caseDef.characteristicLengthM;
    const isLRefValid = lRef === undefined || (typeof lRef === 'number' && Number.isFinite(lRef) && lRef > 0);
    recordCheck(
      'CHK_REFERENCE_LENGTH',
      'Reference Characteristic Length',
      isLRefValid,
      isLRefValid ? `Reference length is valid: ${lRef ?? 'N/A'} m` : `Reference length must be positive finite number. Got: ${lRef}`,
      !isLRefValid ? `Invalid reference length: ${lRef}` : undefined
    );

    // 7. Mesh Existence & Topology Sanity
    if (!mesh || !Array.isArray(mesh.cells) || !Array.isArray(mesh.faces)) {
      recordCheck('CHK_MESH_EXISTENCE', 'Mesh Object Existence', false, 'Mesh or mesh topology arrays are undefined.', 'Missing or invalid mesh object', 'Supply a valid FvmMesh3D instance.');
      return { isReadyForSolve: false, checkedItems, identifiedRisks, recommendedAdjustments };
    }

    const hasCells = mesh.cells.length > 0;
    const hasFaces = mesh.faces.length > 0;
    const isTopologyNonEmpty = hasCells && hasFaces;
    recordCheck(
      'CHK_MESH_CELLS',
      'Mesh Control Volume Topology',
      isTopologyNonEmpty,
      isTopologyNonEmpty ? `Mesh topology valid: ${mesh.cells.length} cells, ${mesh.faces.length} faces` : `Mesh is empty. Cells: ${mesh.cells.length}, Faces: ${mesh.faces.length}`,
      !isTopologyNonEmpty ? 'Empty mesh cannot be discretized' : undefined,
      !isTopologyNonEmpty ? 'Generate or load a non-empty 3D grid.' : undefined
    );

    // 8. Domain Bounding Box & Cell Volume Non-Degeneracy
    let hasPositiveVolumes = true;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    if (hasCells) {
      for (const cell of mesh.cells) {
        if (!Number.isFinite(cell.volume) || cell.volume <= 0) {
          hasPositiveVolumes = false;
        }
        if (cell.centroid) {
          if (cell.centroid.x < minX) minX = cell.centroid.x;
          if (cell.centroid.x > maxX) maxX = cell.centroid.x;
          if (cell.centroid.y < minY) minY = cell.centroid.y;
          if (cell.centroid.y > maxY) maxY = cell.centroid.y;
          if (cell.centroid.z < minZ) minZ = cell.centroid.z;
          if (cell.centroid.z > maxZ) maxZ = cell.centroid.z;
        }
      }
    }

    recordCheck(
      'CHK_CELL_VOLUMES',
      'Cell Volume Positivity',
      hasPositiveVolumes,
      hasPositiveVolumes ? 'All cells have strictly positive finite volumes.' : 'One or more cells have negative, zero, or non-finite volume.',
      !hasPositiveVolumes ? 'Inverted or degenerate cells detected in mesh.' : undefined,
      !hasPositiveVolumes ? 'Repair mesh to ensure all cell Jacobian determinants are strictly positive.' : undefined
    );

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const spanZ = maxZ - minZ;
    // For 3D meshes, span in all three dimensions must be non-zero (or > 1e-9)
    const isBoundingBoxNonDegenerate = hasCells && spanX > 1e-9 && spanY > 1e-9 && spanZ > 1e-9;
    recordCheck(
      'CHK_DOMAIN_BOUNDING_BOX',
      'Domain Bounding Box Non-Degeneracy',
      isBoundingBoxNonDegenerate,
      isBoundingBoxNonDegenerate ? `Domain bounding box spans: Dx=${spanX.toFixed(3)}m, Dy=${spanY.toFixed(3)}m, Dz=${spanZ.toFixed(3)}m` : `Degenerate domain bounding box spans: Dx=${spanX}, Dy=${spanY}, Dz=${spanZ}`,
      !isBoundingBoxNonDegenerate ? 'Flat or point domain geometry detected.' : undefined,
      !isBoundingBoxNonDegenerate ? 'Verify 3D grid extents are positive in X, Y, and Z.' : undefined
    );

    // 9. Boundary Conditions Definition
    const bcs = caseDef.boundaryConditions;
    const hasBCs = bcs && (Array.isArray(bcs) ? bcs.length > 0 : Object.keys(bcs).length > 0);
    recordCheck(
      'CHK_BOUNDARY_CONDITIONS_DEF',
      'Boundary Conditions Definition',
      Boolean(hasBCs),
      hasBCs ? 'Boundary conditions are specified.' : 'No boundary conditions defined in case definition.',
      !hasBCs ? 'Missing boundary conditions will lead to an ill-posed mathematical system.' : undefined,
      !hasBCs ? 'Specify at least inlet, outlet, and wall boundary conditions.' : undefined
    );

    const allPassed = checkedItems.every(c => c.passed);

    return {
      isReadyForSolve: allPassed,
      checkedItems,
      identifiedRisks,
      recommendedAdjustments
    };
  }
}
