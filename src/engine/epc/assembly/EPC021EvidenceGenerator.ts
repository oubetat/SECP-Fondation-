/**
 * SECP Industrial OS — EPC-021: Evidence Package Generator
 * Generates EPC021-EVIDENCE-PACKAGE with canonical SHA-256 integrity hash verification
 * and registers it into SECP's EngineeringEvidencePackageManager.
 */

import { DroneAssemblyManager } from './DroneAssemblyManager';
import { EngineeringEvidencePackageManager } from '../evidence/EngineeringEvidencePackageManager';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

export class EPC021EvidenceGenerator {
  public static readonly PACKAGE_ID = 'EPC021-EVIDENCE-PACKAGE';

  public static async generateEvidencePackage(
    assemblyManager: DroneAssemblyManager
  ): Promise<{
    packageId: string;
    timestamp: string;
    canonicalHash: string;
    payload: Record<string, any>;
  }> {
    const timestamp = new Date().toISOString();

    const rootNode = assemblyManager.getRootNode();
    const partDefinitions = assemblyManager.getAllPartDefinitions();
    const partReferences = assemblyManager.getAllPartReferences();
    const partInstances = assemblyManager.getAllPartInstances();
    const constraints = assemblyManager.getConstraints();
    const constraintSolverResults = assemblyManager.solveConstraints();
    const collisionResults = await assemblyManager.runCollisionAnalysis();
    const bom = assemblyManager.generateBOM();
    const bomConsistency = assemblyManager.verifyBOMAssemblyConsistency();
    const massRollup = assemblyManager.calculateMassRollup();
    const centerOfGravity = assemblyManager.calculateCenterOfGravity();
    const configChain = assemblyManager.buildConfigurationChain();
    const revisionHistory = assemblyManager.getRevisionHistory();

    const payload: Record<string, any> = {
      packageId: this.PACKAGE_ID,
      epcNumber: 'EPC-021',
      title: 'Industrial Drone Assembly & Constraint Verification Evidence Package',
      assemblyId: assemblyManager.assemblyId,
      productName: assemblyManager.productName,
      caseId: assemblyManager.caseId,
      revision: assemblyManager.revision,
      timestamp,
      assemblyDefinition: {
        assemblyId: assemblyManager.assemblyId,
        productName: assemblyManager.productName,
        caseId: assemblyManager.caseId,
        revision: assemblyManager.revision
      },
      partRegistry: {
        definitions: partDefinitions,
        references: partReferences,
        instances: partInstances
      },
      assemblyTree: rootNode,
      constraints,
      constraintSolverResults,
      degreesOfFreedom: constraintSolverResults.degreesOfFreedom,
      collisionResults,
      bom: {
        items: bom,
        isConsistentWithAssembly: bomConsistency.isConsistent,
        mismatches: bomConsistency.mismatches
      },
      massRollup,
      centerOfGravity,
      configurationChain: configChain,
      revisionHistory,
      provenance: {
        engine: 'SECP Production Assembly Graph Engine & Constraint Solver',
        author: 'SECP-ASSEMBLY-VERIFIER',
        securityClassification: 'HIGH_INTEGRITY_ENGINEERING_DATA'
      }
    };

    const canonicalHash = EvidenceIntegrityService.computeHash(payload);

    return {
      packageId: this.PACKAGE_ID,
      timestamp,
      canonicalHash,
      payload
    };
  }

  public static async registerInEvidenceManager(
    evidenceManager: EngineeringEvidencePackageManager,
    assemblyManager: DroneAssemblyManager
  ): Promise<{ packageId: string; canonicalHash: string }> {
    const evidenceData = await this.generateEvidencePackage(assemblyManager);

    evidenceManager.registerPackage({
      packageId: evidenceData.packageId,
      caseId: assemblyManager.caseId,
      epcNumber: 'EPC-021',
      title: 'Industrial Drone Assembly & Constraint Verification Evidence Package',
      timestamp: evidenceData.timestamp,
      canonicalHash: evidenceData.canonicalHash,
      metadata: evidenceData.payload
    });

    return {
      packageId: evidenceData.packageId,
      canonicalHash: evidenceData.canonicalHash
    };
  }
}
