/**
 * SECP Industrial OS — EPC-019: Airframe Traceability & Lifecycle Bridge
 * Connects Parametric Airframe to EPC-003, EPC-004, EPC-006, EPC-007, EPC-009/010/011, and EPC-017/018.
 */

import { MultidisciplinaryModelRegistry } from '../MultidisciplinaryModelRegistry';
import { ModelType, MultidisciplinaryModel } from '../MultidisciplinaryModelTypes';
import { ConfigurationBaselineManager } from '../ConfigurationBaselineManager';
import { RequirementTraceabilityEngine } from '../RequirementTraceabilityEngine';
import { EngineeringEvidencePackageManager } from '../evidence/EngineeringEvidencePackageManager';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { ParametricAirframeModel } from './ParametricAirframeTypes';
import { ParametricAirframeGenerator } from './ParametricAirframeGenerator';

export class AirframeTraceabilityBridge {
  /**
   * Registers the Airframe CAD model in EPC-006 Multidisciplinary Model Registry.
   */
  public static registerInModelRegistry(
    registry: MultidisciplinaryModelRegistry,
    model: ParametricAirframeModel
  ): MultidisciplinaryModel {
    const rawModel: Omit<MultidisciplinaryModel, 'contentHash'> = {
      modelId: model.modelId,
      modelType: ModelType.CAD,
      name: model.name,
      description: model.description,
      domain: model.domain,
      productId: 'PROD-DRONE-001',
      productRevisionId: '1.0',
      variantId: model.variantCode,
      configurationId: `CFG-DRONE-${model.variantCode}`,
      modelRevision: model.revision,
      lifecycleStatus: 'DESIGN_DEFINED' as any,
      artifactReference: `cad/airframe/${model.modelId}_REV_${model.revision}.step`,
      dependencyIds: ['REQ-SPEC-DRONE-017', 'ARCH-DRONE-018'],
      parameterSetReference: `param/airframe/${model.modelId}_params.json`,
      materialReference: model.parameters.MaterialReference?.value || 'mat-carbon-fiber',
      geometryReference: model.geometryHash,
      provenance: {
        creator: model.author,
        createdAt: model.createdAt,
        productConfigurationId: `CFG-DRONE-${model.variantCode}`,
        dependencies: ['EPC-017', 'EPC-018'],
        hash: model.contentHash
      },
      createdAt: model.createdAt,
      createdBy: model.author
    };

    const { createdAt, createdBy, provenance, ...rest } = rawModel as any;
    const computedHash = EngineeringHashChain.computeCanonicalHash(rest).canonicalHash;

    const registeredModel: MultidisciplinaryModel = {
      ...rawModel,
      contentHash: computedHash
    };

    registry.registerModel(registeredModel);
    return registeredModel;
  }

  /**
   * Creates and registers the Airframe CAD baseline in EPC-004 Configuration Baseline Manager.
   */
  public static createConfigurationBaseline(
    model: ParametricAirframeModel
  ): ConfigurationBaselineManager {
    const baselineId = `BSL-DRONE-${model.variantCode}-V${model.revision}`;

    return ConfigurationBaselineManager.createDraft({
      baselineId,
      productId: 'PROD-DRONE-001',
      productRevision: '1.0',
      configurationRevision: model.revision,
      createdBy: model.author,
      cad: {
        cadId: model.modelId,
        name: model.name,
        revision: model.revision,
        geometryHash: model.geometryHash,
        topologyHash: model.topologyHash,
        referencedComponents: model.features.map(f => ({
          componentId: f.featureId,
          name: f.name,
          revision: model.revision,
          geometryHash: model.geometryHash
        })),
        configurationState: {
          variant: model.variantCode,
          massKg: model.massProperties.totalMassKg
        }
      },
      materials: [
        {
          materialId: (model.parameters.MaterialReference?.value as string) || 'mat-carbon-fiber',
          name: model.features[0]?.materialName || 'Carbon Fiber Composite',
          revision: '1.0',
          properties: {
            densityKgM3: model.features[0]?.densityKgM3 || 1550,
            youngsModulusGPa: 150,
            poissonsRatio: 0.28,
            thermalExpansionCoefficient: 2.1e-6
          },
          propertySource: 'SECP-MATERIALS-ENGINE-DATABASE',
          databaseVersion: '2.0.0'
        }
      ],
      parameters: {
        parameterSetId: `PARAMSET-AIRFRAME-${model.variantCode}`,
        revision: model.revision,
        parameters: Object.entries(model.parameters).map(([k, v]) => ({
          name: k,
          value: v.value,
          unit: v.unit,
          revision: model.revision,
          source: v.source
        }))
      },
      simulationModels: [
        {
          modelId: 'SIM-FEA-AIRFRAME-001',
          name: 'Airframe Finite Element Model',
          revision: '1.0',
          physicsDomain: 'STRUCTURAL_FEA',
          governingConfig: { solver: 'SECP-FEA' },
          referencedGeometryId: model.modelId,
          referencedMaterialIds: ['mat-carbon-fiber'],
          modelParameters: { meshQuality: 'FINE' }
        }
      ],
      mesh: {
        meshId: 'MESH-AIRFRAME-001',
        revision: '1.0',
        generationMethod: 'DELAUNAY_TET4',
        meshParameters: { minElementSize: 2.0, maxElementSize: 10.0 },
        referencedGeometryId: model.modelId,
        meshHash: model.geometryHash,
        elementCount: 45000,
        nodeCount: 12000
      },
      solver: {
        solverId: 'SOLVER-SECP-FEA',
        name: 'SECP Structural Linear Solver',
        version: '2.4.0',
        solverConfig: { parallelThreads: 8 },
        numericalMethod: 'DIRECT_SPARSE_CHOLESKY',
        convergenceCriteria: { tolerance: 1e-6 },
        tolerances: { absolute: 1e-8, relative: 1e-6 }
      },
      controls: {
        controlId: 'CTRL-DRONE-FLIGHT-001',
        name: 'Multirotor Flight Controller',
        revision: '1.0',
        controlParameters: { rollRateKp: 1.2 },
        controlConfig: { sampleRateHz: 1000 }
      },
      manufacturingDefinition: {
        manufacturingId: 'MFG-DRONE-AIRFRAME-001',
        revision: '1.0',
        bomReference: 'BOM-DRONE-AIRFRAME-001',
        processDefinition: { primaryProcess: 'CNC_MILLING_AND_COMPOSITE_LAYUP' },
        operations: [
          {
            opId: 'OP-001',
            name: 'CNC Milling Carbon Fiber Top/Bottom Decks',
            type: 'CNC_MILLING'
          }
        ]
      }
    });
  }

  /**
   * Populates EPC-003 Requirement Traceability Engine with Airframe links.
   */
  public static registerRequirementLinks(
    traceEngine: RequirementTraceabilityEngine,
    model: ParametricAirframeModel
  ): void {
    const requirementMap: Record<string, string> = {
      'DRONE-REQ-001': 'Airframe Multi-Rotor Radial Geometry',
      'DRONE-REQ-005': 'Maximum Takeoff Mass Envelope',
      'DRONE-REQ-006': 'Battery Interface & Sliding Retention Tray',
      'DRONE-REQ-007': 'Universal Payload Gimbal Damping Rail',
      'DRONE-REQ-008': 'Airframe Structural Rigidity & Strength',
      'DRONE-REQ-010': 'IP54 Environmental Enclosure Envelope',
      'DRONE-REQ-018': 'Propulsion Arm Cantilever & Motor Mount Interface',
      'DRONE-REQ-019': 'Avionics Bay Internal Space',
      'DRONE-REQ-020': 'Landing Gear Structural Hardpoints'
    };

    // Register Airframe CAD Model Artifact
    if (!traceEngine.getArtifact(model.modelId)) {
      traceEngine.addArtifact({
        artifactId: model.modelId,
        type: 'DESIGN_FEATURE',
        name: model.name
      });
    }

    for (const [reqId, reqName] of Object.entries(requirementMap)) {
      // Register requirement if not already present
      if (!traceEngine.getArtifact(reqId)) {
        traceEngine.addArtifact({
          artifactId: reqId,
          type: 'REQUIREMENT',
          name: reqName
        });
      }

      // Add edge using sourceId, targetId, and relationshipType
      traceEngine.addEdge({
        edgeId: `EDGE-TRC-${reqId}-${model.modelId}`,
        sourceId: reqId,
        targetId: model.modelId,
        relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE'
      });
    }
  }

  /**
   * Registers forward CAD -> CAE / FEA / CFD / Mesh models in MultidisciplinaryModelRegistry.
   */
  public static registerCadCaeModels(
    registry: MultidisciplinaryModelRegistry,
    model: ParametricAirframeModel
  ): void {
    const configId = `CFG-DRONE-${model.variantCode}`;

    // 1. FEA Model
    const rawFea: Omit<MultidisciplinaryModel, 'contentHash'> = {
      modelId: 'FEA-AIRFRAME-STRUCTURAL-001',
      modelType: ModelType.FEA,
      name: 'Airframe Finite Element Structural Model',
      description: 'Modal and static load structural analysis model discretized from CAD geometry.',
      domain: model.domain,
      productId: 'PROD-DRONE-001',
      productRevisionId: '1.0',
      variantId: model.variantCode,
      configurationId: configId,
      modelRevision: '1.0',
      lifecycleStatus: 'DESIGN_DEFINED' as any,
      artifactReference: 'sim/fea/airframe_static.json',
      dependencyIds: [model.modelId],
      parameterSetReference: `param/airframe/${model.modelId}_params.json`,
      materialReference: 'mat-carbon-fiber',
      geometryReference: model.geometryHash,
      provenance: {
        creator: 'SECP-CAE-ENGINEER',
        createdAt: model.createdAt,
        productConfigurationId: configId,
        dependencies: [`${model.modelId}@${model.revision}`],
        hash: model.contentHash
      },
      createdAt: model.createdAt,
      createdBy: 'SECP-CAE-ENGINEER'
    };
    const { createdAt: c1, createdBy: cb1, provenance: p1, ...restFea } = rawFea as any;
    const feaHash = EngineeringHashChain.computeCanonicalHash(restFea).canonicalHash;

    registry.registerModel({
      ...rawFea,
      contentHash: feaHash
    });

    // 2. CFD Model
    const rawCfd: Omit<MultidisciplinaryModel, 'contentHash'> = {
      modelId: 'CFD-AIRFRAME-AERO-001',
      modelType: ModelType.CFD,
      name: 'Airframe Computational Fluid Dynamics Aerodynamic Model',
      description: 'RANS aerodynamic drag and rotor downwash surface model.',
      domain: model.domain,
      productId: 'PROD-DRONE-001',
      productRevisionId: '1.0',
      variantId: model.variantCode,
      configurationId: configId,
      modelRevision: '1.0',
      lifecycleStatus: 'DESIGN_DEFINED' as any,
      artifactReference: 'sim/cfd/airframe_aero.json',
      dependencyIds: [model.modelId],
      parameterSetReference: `param/airframe/${model.modelId}_params.json`,
      materialReference: 'mat-carbon-fiber',
      geometryReference: model.geometryHash,
      provenance: {
        creator: 'SECP-CFD-ENGINEER',
        createdAt: model.createdAt,
        productConfigurationId: configId,
        dependencies: [`${model.modelId}@${model.revision}`],
        hash: model.contentHash
      },
      createdAt: model.createdAt,
      createdBy: 'SECP-CFD-ENGINEER'
    };
    const { createdAt: c2, createdBy: cb2, provenance: p2, ...restCfd } = rawCfd as any;
    const cfdHash = EngineeringHashChain.computeCanonicalHash(restCfd).canonicalHash;

    registry.registerModel({
      ...rawCfd,
      contentHash: cfdHash
    });
  }

  /**
   * Generates a fully compliant Evidence Package (EPC-009 / EPC-010 / EPC-011).
   */
  public static generateEvidencePackage(
    evidenceManager: EngineeringEvidencePackageManager,
    model: ParametricAirframeModel
  ): { packageId: string; integrityHash: string } {
    const pkg = evidenceManager.createPackage(model.caseId, model.author);

    evidenceManager.updatePackage(pkg.packageId, pkg.revision, p => {
      p.design.push({
        modelId: model.modelId,
        revision: model.revision,
        type: 'PARAMETRIC_CAD',
        contentHash: model.contentHash,
        geometryHash: model.geometryHash,
        topologyHash: model.topologyHash,
        parameterHash: model.parameterHash
      });
      p.measurements.push({
        measurementId: 'MEAS-MASS-001',
        name: 'Derived Total Airframe Mass',
        value: model.massProperties.totalMassKg,
        unit: 'kg',
        tolerance: 0.001,
        source: 'PHYSICS_BASED_DERIVATION'
      });
      p.measurements.push({
        measurementId: 'MEAS-VOL-001',
        name: 'Derived Total Airframe Volume',
        value: model.massProperties.totalVolumeM3,
        unit: 'm³',
        tolerance: 1e-8,
        source: 'PHYSICS_BASED_DERIVATION'
      });
    });

    const integrityHash = EvidenceIntegrityService.computeHash(pkg);
    return {
      packageId: pkg.packageId,
      integrityHash
    };
  }

  /**
   * Executes EPC-012 Reproducibility Verification:
   * Reconstructs Run 2 from the exact same parameter configuration and CAD kernel,
   * verifying deterministic equality for topology, geometry hash, mass, CG, and inertia.
   */
  public static verifyReproducibility(model: ParametricAirframeModel): {
    reproducible: boolean;
    geometryMatch: boolean;
    massDelta: number;
    cgDelta: number;
    inertiaDelta: number;
  } {
    const config = Object.entries(model.parameters).reduce((acc, [k, v]) => {
      return { ...acc, [k]: v.value };
    }, {});

    const run2 = ParametricAirframeGenerator.generateModel(config, {
      revision: model.revision,
      author: model.author,
      variantCode: model.variantCode
    });

    const geometryMatch = model.geometryHash === run2.geometryHash;
    const massDelta = Math.abs(model.massProperties.totalMassKg - run2.massProperties.totalMassKg);
    const cgDelta = Math.sqrt(
      Math.pow(model.massProperties.centerOfGravity.x - run2.massProperties.centerOfGravity.x, 2) +
      Math.pow(model.massProperties.centerOfGravity.y - run2.massProperties.centerOfGravity.y, 2) +
      Math.pow(model.massProperties.centerOfGravity.z - run2.massProperties.centerOfGravity.z, 2)
    );
    const inertiaDelta = Math.abs(model.massProperties.inertiaTensor.Ixx - run2.massProperties.inertiaTensor.Ixx) +
                         Math.abs(model.massProperties.inertiaTensor.Iyy - run2.massProperties.inertiaTensor.Iyy) +
                         Math.abs(model.massProperties.inertiaTensor.Izz - run2.massProperties.inertiaTensor.Izz);

    const reproducible = geometryMatch && massDelta < 1e-6 && cgDelta < 1e-6 && inertiaDelta < 1e-6;

    return {
      reproducible,
      geometryMatch,
      massDelta,
      cgDelta,
      inertiaDelta
    };
  }
}
