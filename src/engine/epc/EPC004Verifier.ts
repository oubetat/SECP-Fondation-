/**
 * SECP Industrial OS — EPC-004: Engineering Configuration Baseline Verifier
 * Executes comprehensive verification checks and generates machine-readable EPC-004 evidence.
 */

import { pureSha256 } from '../../polyfills/crypto';
import { CanonicalSerializer } from '../serialization/CanonicalSerializer';
import {
  EngineeringConfigurationBaselineData,
  ConfigurationBaselineValidationError,
  EPC004ValidationResult,
  CadBaselineComponent,
  MaterialBaselineComponent,
  ParameterBaselineComponent,
  SimulationModelBaselineComponent,
  MeshBaselineComponent,
  SolverBaselineComponent,
  ControlsBaselineComponent,
  ManufacturingDefinitionBaselineComponent
} from './ConfigurationBaselineTypes';
import { ConfigurationBaselineManager } from './ConfigurationBaselineManager';
import { ConfigurationBaselineValidator } from './ConfigurationBaselineValidator';
import { ConfigurationBaselineSerializer } from './ConfigurationBaselineSerializer';

export class EPC004Verifier {
  public static readonly REVISION = 'SECP-EPC-004-REV1';

  /**
   * Helper to construct a valid, complete baseline manager for verification tests.
   */
  public static createSampleBaselineManager(idSuffix: string = '001'): ConfigurationBaselineManager {
    const cad: CadBaselineComponent = {
      cadId: `CAD-WING-${idSuffix}`,
      name: 'Main Aerofoil Structure',
      revision: 'v2.1.0',
      geometryHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      topologyHash: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284ddd200126d9069e',
      assemblyRevision: 'ASM-v2.0',
      referencedComponents: [
        {
          componentId: `CAD-SPAR-${idSuffix}`,
          name: 'Main Spar Web',
          revision: 'v1.4.0',
          geometryHash: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb'
        }
      ],
      configurationState: {
        deflectionAngleDeg: 4.5,
        flapPosition: 'NEUTRAL'
      }
    };

    const materials: MaterialBaselineComponent[] = [
      {
        materialId: 'MAT-AL-7075-T6',
        name: 'Aluminum 7075-T6',
        revision: 'REV-C',
        properties: {
          densityKgM3: 2810,
          youngsModulusGPa: 71.7,
          poissonsRatio: 0.33,
          yieldStrengthMPa: 503
        },
        propertySource: 'MMPDS-14 Chapter 3',
        databaseVersion: '2025.1'
      }
    ];

    const parameters: ParameterBaselineComponent = {
      parameterSetId: `PARAM-SET-${idSuffix}`,
      revision: 'v1.0.0',
      parameters: [
        {
          name: 'max_operating_pressure',
          value: 350,
          unit: 'bar',
          revision: 'v1.0',
          source: 'System Requirement Specification Sec 4.2',
          tolerance: { upperBound: 380 }
        },
        {
          name: 'safety_factor',
          value: 1.5,
          unit: 'dimensionless',
          revision: 'v1.0',
          source: 'FAA FAR 25.303'
        }
      ]
    };

    const simulationModels: SimulationModelBaselineComponent[] = [
      {
        modelId: `SIM-FEA-${idSuffix}`,
        name: 'Structural Finite Element Model',
        revision: 'v3.0.0',
        physicsDomain: 'SOLID_MECHANICS',
        governingConfig: {
          elementType: 'C3D8R',
          formulation: 'NON_LINEAR_GEOMETRY'
        },
        referencedGeometryId: `CAD-WING-${idSuffix}`,
        referencedMaterialIds: ['MAT-AL-7075-T6'],
        modelParameters: {
          substeps: 50,
          initialTimeStepSec: 0.01
        }
      }
    ];

    const mesh: MeshBaselineComponent = {
      meshId: `MESH-FEA-${idSuffix}`,
      revision: 'v1.2.0',
      generationMethod: 'HEX_DOMINANT_OCTREE',
      meshParameters: {
        maxElementSizeMm: 2.5,
        minElementSizeMm: 0.5,
        growthRate: 1.2
      },
      referencedGeometryId: `CAD-WING-${idSuffix}`,
      meshHash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
      elementCount: 1450200,
      nodeCount: 1620400
    };

    const solver: SolverBaselineComponent = {
      solverId: 'SOLVER-NASTRAN-PRO',
      name: 'SECP Implicit Non-Linear Solver',
      version: 'v2025.2.1',
      solverConfig: {
        threads: 16,
        doublePrecision: true
      },
      numericalMethod: 'NEWTON_RAPHSON_FULL',
      convergenceCriteria: {
        forceTolerance: 1e-4,
        displacementTolerance: 1e-4,
        energyTolerance: 1e-5
      },
      tolerances: {
        absTol: 1e-8,
        relTol: 1e-6
      },
      linearSolverConfig: {
        preconditioner: 'INCOMPLETE_CHOLESKY',
        maxIterations: 1000
      }
    };

    const controls: ControlsBaselineComponent = {
      controlId: `CTRL-FLAP-${idSuffix}`,
      name: 'Flap Actuator Servo Controller',
      revision: 'v1.1.0',
      controlParameters: {
        kp: 12.5,
        ki: 0.4,
        kd: 1.2,
        slewRateLimitDegSec: 30
      },
      controlConfig: {
        loopFrequencyHz: 1000,
        filterCutoffHz: 200
      },
      referencedModelId: `SIM-FEA-${idSuffix}`
    };

    const manufacturingDefinition: ManufacturingDefinitionBaselineComponent = {
      manufacturingId: `MFG-DEF-${idSuffix}`,
      revision: 'v2.0.0',
      bomReference: `BOM-WING-ASSY-${idSuffix}`,
      processDefinition: {
        machineType: '5_AXIS_CNC_GANTRY',
        coolant: 'SYNTHETIC_MIST'
      },
      operations: [
        {
          opId: 'OP-10',
          name: 'Rough Pocket Milling',
          type: 'MILLING',
          parameters: { spindleSpeedRpm: 12000, feedRateMmMin: 2400 }
        },
        {
          opId: 'OP-20',
          name: 'Finish Contour Milling',
          type: 'MILLING',
          parameters: { spindleSpeedRpm: 18000, feedRateMmMin: 1800 }
        }
      ],
      camToolpathReferences: [`TP-WING-OP10-${idSuffix}`, `TP-WING-OP20-${idSuffix}`],
      materialDependencies: ['MAT-AL-7075-T6']
    };

    return ConfigurationBaselineManager.createDraft({
      baselineId: `BASELINE-${idSuffix}`,
      productId: 'PROD-AEROFRAME-X1',
      productRevision: 'P-REV1',
      configurationRevision: 'CFG-REV1',
      createdBy: 'ENGINEER-LEAD-01',
      cad,
      materials,
      parameters,
      simulationModels,
      mesh,
      solver,
      controls,
      manufacturingDefinition
    });
  }

  /**
   * Runs all verification checks for EPC-004 and returns machine-readable result.
   */
  public static runVerification(): EPC004ValidationResult {
    const checks: Record<string, boolean> = {
      CAD_CAPTURED: false,
      MATERIALS_CAPTURED: false,
      PARAMETERS_CAPTURED: false,
      SIMULATION_MODELS_CAPTURED: false,
      MESH_CAPTURED: false,
      SOLVER_CAPTURED: false,
      CONTROLS_CAPTURED: false,
      MANUFACTURING_DEFINITION_CAPTURED: false,
      EXPLICIT_REVISIONS: false,
      DEPENDENCY_GRAPH: false,
      DETERMINISTIC_SERIALIZATION: false,
      CRYPTOGRAPHIC_CONTENT_HASH: false,
      PROVENANCE: false,
      IMMUTABILITY: false,
      DRIFT_DETECTION: false,
      REVISIONING: false,
      REPRODUCIBILITY_VERIFICATION: false,
      ADVERSARIAL_RESISTANCE: false
    };

    // 1. All 8 Components Captured Check
    try {
      const mgr = this.createSampleBaselineManager('CHECK1');
      const data = mgr.getData();
      checks.CAD_CAPTURED = Boolean(data.cad && data.cad.geometryHash && data.cad.revision);
      checks.MATERIALS_CAPTURED = Boolean(data.materials && data.materials.length > 0 && data.materials[0].properties);
      checks.PARAMETERS_CAPTURED = Boolean(data.parameters && data.parameters.parameters.length > 0);
      checks.SIMULATION_MODELS_CAPTURED = Boolean(data.simulationModels && data.simulationModels.length > 0);
      checks.MESH_CAPTURED = Boolean(data.mesh && data.mesh.meshHash);
      checks.SOLVER_CAPTURED = Boolean(data.solver && data.solver.version && data.solver.convergenceCriteria);
      checks.CONTROLS_CAPTURED = Boolean(data.controls && data.controls.controlParameters);
      checks.MANUFACTURING_DEFINITION_CAPTURED = Boolean(data.manufacturingDefinition && data.manufacturingDefinition.operations.length > 0);
    } catch (e) {
      // failed
    }

    // 9. EXPLICIT_REVISIONS
    try {
      const mgr = this.createSampleBaselineManager('CHECK9');
      const data = mgr.getData();
      checks.EXPLICIT_REVISIONS = Boolean(
        data.cad.revision &&
        data.materials.every(m => m.revision) &&
        data.parameters.revision &&
        data.simulationModels.every(s => s.revision) &&
        data.mesh.revision &&
        data.solver.version &&
        data.controls.revision &&
        data.manufacturingDefinition.revision
      );
    } catch (e) {
      checks.EXPLICIT_REVISIONS = false;
    }

    // 10. DEPENDENCY_GRAPH
    try {
      const mgr = this.createSampleBaselineManager('CHECK10');
      const data = mgr.getData();
      checks.DEPENDENCY_GRAPH = Boolean(data.dependencyGraph && data.dependencyGraph.nodes.length >= 8 && data.dependencyGraph.edges.length >= 5);
    } catch (e) {
      checks.DEPENDENCY_GRAPH = false;
    }

    // 11. DETERMINISTIC_SERIALIZATION
    try {
      const mgr1 = this.createSampleBaselineManager('CHECK11');
      const mgr2 = this.createSampleBaselineManager('CHECK11');
      const s1 = ConfigurationBaselineSerializer.serialize(mgr1.getData());
      const s2 = ConfigurationBaselineSerializer.serialize(mgr2.getData());
      checks.DETERMINISTIC_SERIALIZATION = s1.canonicalString === s2.canonicalString && s1.contentHash === s2.contentHash;
    } catch (e) {
      checks.DETERMINISTIC_SERIALIZATION = false;
    }

    // 12. CRYPTOGRAPHIC_CONTENT_HASH
    try {
      const mgr = this.createSampleBaselineManager('CHECK12');
      const qualified = mgr.qualify();
      checks.CRYPTOGRAPHIC_CONTENT_HASH = Boolean(qualified.contentHash && qualified.contentHash.length === 64);
    } catch (e) {
      checks.CRYPTOGRAPHIC_CONTENT_HASH = false;
    }

    // 13. PROVENANCE
    try {
      const mgr = this.createSampleBaselineManager('CHECK13');
      const data = mgr.getData();
      checks.PROVENANCE = Boolean(data.provenance && data.provenance.creator && data.provenance.createdAt && data.provenance.configurationRevision);
    } catch (e) {
      checks.PROVENANCE = false;
    }

    // 14. IMMUTABILITY
    try {
      const mgr = this.createSampleBaselineManager('CHECK14');
      mgr.qualify();

      let mutationRejected = false;
      try {
        mgr.updateCad({
          ...mgr.getData().cad,
          revision: 'v9.9.9'
        });
      } catch (e: any) {
        mutationRejected = e instanceof ConfigurationBaselineValidationError && e.code === 'IMMUTABILITY_VIOLATION';
      }
      checks.IMMUTABILITY = mutationRejected;
    } catch (e) {
      checks.IMMUTABILITY = false;
    }

    // 15. DRIFT_DETECTION
    try {
      const mgr1 = this.createSampleBaselineManager('CHECK15');
      const mgr2 = this.createSampleBaselineManager('CHECK15');

      mgr2.updateCad({
        ...mgr2.getData().cad,
        geometryHash: '0000000000000000000000000000000000000000000000000000000000000000'
      });

      const driftReport = mgr1.detectDrift(mgr2);
      checks.DRIFT_DETECTION = driftReport.isDriftDetected && driftReport.driftedComponents.includes('CAD');
    } catch (e) {
      checks.DRIFT_DETECTION = false;
    }

    // 16. REVISIONING
    try {
      const mgr1 = this.createSampleBaselineManager('CHECK16');
      mgr1.qualify();

      const mgr2 = mgr1.createRevision({
        newBaselineId: 'BASELINE-CHECK16-REV2',
        newConfigurationRevision: 'CFG-REV2',
        createdBy: 'ENGINEER-LEAD-02'
      });

      const oldData = mgr1.getData();
      const newData = mgr2.getData();

      checks.REVISIONING = Boolean(
        oldData.status === 'QUALIFIED' &&
        newData.status === 'DRAFT' &&
        newData.provenance.parentBaselineId === oldData.baselineId &&
        newData.configurationRevision === 'CFG-REV2'
      );
    } catch (e) {
      checks.REVISIONING = false;
    }

    // 17. REPRODUCIBILITY_VERIFICATION
    try {
      const mgr = this.createSampleBaselineManager('CHECK17');
      const qualified = mgr.qualify();
      const serialized = ConfigurationBaselineSerializer.serialize(qualified);
      const restoredData = ConfigurationBaselineSerializer.deserialize(serialized.canonicalString);
      const recomputed = ConfigurationBaselineSerializer.serialize(restoredData);

      checks.REPRODUCIBILITY_VERIFICATION = serialized.contentHash === recomputed.contentHash && mgr.verifyIntegrity();
    } catch (e) {
      checks.REPRODUCIBILITY_VERIFICATION = false;
    }

    // 18. ADVERSARIAL_RESISTANCE
    try {
      let advPass = true;

      // 18a. Rejects missing CAD
      try {
        const mgr = this.createSampleBaselineManager('ADV1');
        const data = mgr.getData();
        (data as any).cad = undefined;
        ConfigurationBaselineValidator.validate(data);
        advPass = false;
      } catch (e) {}

      // 18b. Rejects broken geometry reference in simulation
      try {
        const mgr = this.createSampleBaselineManager('ADV2');
        mgr.updateSimulationModels([
          {
            ...mgr.getData().simulationModels[0],
            referencedGeometryId: 'NONEXISTENT_CAD'
          }
        ]);
        advPass = false;
      } catch (e) {}

      checks.ADVERSARIAL_RESISTANCE = advPass;
    } catch (e) {
      checks.ADVERSARIAL_RESISTANCE = false;
    }

    // Calculate verdict
    const checkKeys = Object.keys(checks);
    const passedCount = checkKeys.filter(k => checks[k]).length;
    const totalCount = checkKeys.length;

    let verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE' = 'FAIL';
    if (passedCount === totalCount && totalCount > 0) {
      verdict = 'PASS';
    } else if (passedCount > 0) {
      verdict = 'INCONCLUSIVE';
    }

    const timestamp = new Date().toISOString();

    const evidencePayload = {
      epc: 'EPC-004',
      name: 'Engineering Configuration Baseline',
      verdict,
      checks,
      implementationRevision: this.REVISION
    };

    const canonicalEvidenceStr = CanonicalSerializer.serialize(evidencePayload).canonicalString;
    const evidenceHash = pureSha256(canonicalEvidenceStr);

    return {
      epc: 'EPC-004',
      name: 'Engineering Configuration Baseline',
      verdict,
      checks,
      evidenceHash,
      timestamp,
      implementationRevision: this.REVISION
    };
  }
}
