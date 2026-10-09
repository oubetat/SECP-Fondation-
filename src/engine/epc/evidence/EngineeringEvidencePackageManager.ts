/**
 * SECP Industrial OS — EPC-009: Engineering Evidence Package Manager
 */

import { 
  EngineeringEvidencePackage, 
  EvidencePackageLifecycle, 
  EvidenceVerdictStatus,
  RequirementReference,
  DesignReference,
  AnalysisRecord,
  ResultRecord,
  TestRecord,
  MeasurementRecord,
  EvidenceReference,
  VerdictRecord,
  EvidencePackageError
} from './EngineeringEvidencePackageTypes';
import { EngineeringEvidencePackageValidator } from './EngineeringEvidencePackageValidator';
import { EvidenceIntegrityService } from './EvidenceIntegrityService';
import { EvidenceProvenance, ProvenanceAction } from './EvidenceProvenanceTypes';
import { EvidenceProvenanceValidator } from './EvidenceProvenanceValidator';

export class EngineeringEvidencePackageManager {
  private packages: Map<string, EngineeringEvidencePackage[]> = new Map();

  /**
   * Registers a package record into the evidence manager.
   */
  public registerPackage(params: {
    packageId: string;
    caseId?: string;
    epcNumber?: string;
    title?: string;
    timestamp?: string;
    canonicalHash?: string;
    metadata?: Record<string, any>;
    provenanceEvents?: any[];
  }): EngineeringEvidencePackage {
    const pkg: EngineeringEvidencePackage = {
      packageId: params.packageId,
      caseId: params.caseId || 'CASE-001',
      epcNumber: params.epcNumber,
      title: params.title,
      revision: 'REV-A',
      status: EvidencePackageLifecycle.VALIDATED,
      requirements: [],
      design: [],
      analyses: [],
      results: [],
      tests: [],
      measurements: [],
      evidence: [],
      verdicts: [],
      provenance: '',
      integrityRecords: {},
      provenanceRecords: {},
      createdAt: params.timestamp || new Date().toISOString(),
      updatedAt: params.timestamp || new Date().toISOString(),
      createdBy: 'SECP-EVIDENCE-GEN',
      canonicalHash: params.canonicalHash,
      metadata: params.metadata
    };
    this.storePackage(pkg);
    return pkg;
  }

  /**
   * Initializes a new Evidence Package.
   */
  public createPackage(caseId: string, createdBy: string): EngineeringEvidencePackage {
    const pkg: EngineeringEvidencePackage = {
      packageId: `EVIDENCE-PKG-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      caseId,
      revision: 'R1',
      status: EvidencePackageLifecycle.DRAFT,
      requirements: [],
      design: [],
      analyses: [],
      results: [],
      tests: [],
      measurements: [],
      evidence: [],
      verdicts: [],
      provenance: '',
      integrityRecords: {},
      provenanceRecords: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy
    };

    this.storePackage(pkg);
    return pkg;
  }

  /**
   * Updates an existing package. Throws if SEALED.
   */
  public updatePackage(packageId: string, revision: string, updater: (pkg: EngineeringEvidencePackage) => void): void {
    const pkg = this.getPackage(packageId, revision);
    if (!pkg) throw new Error(`Package ${packageId} REV ${revision} not found`);

    if (pkg.status === EvidencePackageLifecycle.SEALED) {
      throw new Error(EvidencePackageError.SEALED_PACKAGE_MODIFICATION);
    }

    updater(pkg);
    pkg.updatedAt = new Date().toISOString();
  }

  /**
   * Seals a package, making it immutable.
   */
  public sealPackage(packageId: string, revision: string): void {
    this.updatePackage(packageId, revision, (pkg) => {
      const validation = EngineeringEvidencePackageValidator.validate(pkg);
      if (validation.status === 'INVALID') {
        throw new Error(`Cannot seal invalid package: ${validation.errors.join(', ')}`);
      }
      pkg.status = EvidencePackageLifecycle.SEALED;
    });
  }

  /**
   * Creates a new revision of a package.
   */
  public createRevision(packageId: string, currentRevision: string, newRevision: string): EngineeringEvidencePackage {
    const base = this.getPackage(packageId, currentRevision);
    if (!base) throw new Error(`Base package ${packageId} REV ${currentRevision} not found`);

    const newPkg: EngineeringEvidencePackage = {
      ...JSON.parse(JSON.stringify(base)), // Deep clone
      revision: newRevision,
      status: EvidencePackageLifecycle.DRAFT,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        ...base.metadata,
        previousRevision: currentRevision
      }
    };

    this.storePackage(newPkg);
    return newPkg;
  }

  /**
   * Retrieves a package by ID and revision.
   */
  public getPackage(packageId: string, revision?: string): EngineeringEvidencePackage | undefined {
    const history = this.packages.get(packageId);
    if (!history) return undefined;
    if (revision) return history.find(p => p.revision === revision);
    return history[history.length - 1];
  }

  /**
   * Lists all packages.
   */
  public listPackages(): EngineeringEvidencePackage[] {
    const all: EngineeringEvidencePackage[] = [];
    this.packages.forEach(h => all.push(...h));
    return all;
  }

  /**
   * Exports the package to a structured JSON representation.
   */
  public exportPackage(packageId: string, revision: string): string {
    const pkg = this.getPackage(packageId, revision);
    if (!pkg) throw new Error(`Package not found`);
    return JSON.stringify(pkg, null, 2);
  }

  private storePackage(pkg: EngineeringEvidencePackage): void {
    const history = this.packages.get(pkg.packageId) || [];
    history.push(pkg);
    this.packages.set(pkg.packageId, history);
  }

  // Specialized Adders
  public addRequirement(packageId: string, revision: string, req: RequirementReference): void {
    this.updatePackage(packageId, revision, p => p.requirements.push(req));
  }

  public addDesign(packageId: string, revision: string, design: DesignReference): void {
    this.updatePackage(packageId, revision, p => p.design.push(design));
  }

  public addAnalysis(packageId: string, revision: string, analysis: AnalysisRecord): void {
    this.updatePackage(packageId, revision, p => p.analyses.push(analysis));
  }

  public addResult(packageId: string, revision: string, result: ResultRecord): void {
    this.updatePackage(packageId, revision, p => {
      p.results.push(result);
      this.autoProtect(p, result.resultId, result, ProvenanceAction.FEA_EXECUTION);
    });
  }

  public addTest(packageId: string, revision: string, test: TestRecord): void {
    this.updatePackage(packageId, revision, p => {
      p.tests.push(test);
      this.autoProtect(p, test.testId, test, ProvenanceAction.TEST_EXECUTION);
    });
  }

  public addMeasurement(packageId: string, revision: string, measurement: MeasurementRecord): void {
    this.updatePackage(packageId, revision, p => {
      p.measurements.push(measurement);
      this.autoProtect(p, measurement.measurementId, measurement, ProvenanceAction.MEASUREMENT);
    });
  }

  public addEvidence(packageId: string, revision: string, evidence: EvidenceReference): void {
    this.updatePackage(packageId, revision, p => {
      p.evidence.push(evidence);
      // Evidence itself might not need a new hash of hash, but we link it
    });
  }

  /**
   * Automatically computes hash and creates provenance for an added artifact.
   */
  private autoProtect(pkg: EngineeringEvidencePackage, artifactId: string, payload: unknown, action: ProvenanceAction): void {
    // 1. Compute Integrity Hash (EPC-010)
    const integrity = EvidenceIntegrityService.createIntegrityRecord(
      artifactId,
      pkg.revision,
      payload,
      pkg.createdBy,
      pkg.packageId
    );
    pkg.integrityRecords[artifactId] = integrity;

    // 2. Create Provenance (EPC-011)
    const provenance: EvidenceProvenance = {
      provenanceId: `PROV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      evidenceId: artifactId,
      actor: pkg.createdBy,
      action: action,
      timestamp: new Date().toISOString(),
      source: 'SECP-CORE',
      sourceVersion: 'v1.0.0',
      inputs: { packageId: pkg.packageId },
      process: {
        processId: 'PROC-GEN',
        processType: 'AUTOMATED_INGESTION',
        processVersion: '1.0',
        executionId: `EXEC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        status: 'COMPLETED'
      },
      outputs: [artifactId],
      parentEvidenceIds: [],
      revisionId: pkg.revision
    };
    pkg.provenanceRecords[artifactId] = provenance;
  }

  public addVerdict(packageId: string, revision: string, verdict: VerdictRecord): void {
    this.updatePackage(packageId, revision, p => p.verdicts.push(verdict));
  }
}
