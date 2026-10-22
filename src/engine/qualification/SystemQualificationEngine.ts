/**
 * SECP Industrial OS — Engineering Truth OS
 * SECP-PHASE-5-001: Aircraft & Industrial Qualification Engine
 * SystemQualificationEngine.ts
 * 
 * Master authoritative system-level qualification engine. Executes multi-domain
 * verification, maps requirements to canonical models, registers immutable evidence
 * in the EngineeringEvidenceLedger, and issues formal qualification decisions.
 */

import { createHash } from 'crypto';
import {
  EngineeringSystem,
  createReferenceEcuSystem
} from './EngineeringSystemCanonicalModel';
import {
  QualificationRequirement,
  RequirementVerificationEvidence,
  RequirementTraceabilityRecord,
  SystemQualificationStatus,
  evaluateAcceptanceCriteria
} from './QualificationRequirement';
import {
  MultidomainPcbHardAcceptanceGate,
  MultidomainPcbGateReport,
  computeMultidomainCanonicalHash
} from '../crossdomain/MultidomainPcbIntegrationEngine';
import { EngineeringEvidenceLedger } from '../evidence/ledger/EngineeringEvidenceLedger';
import { QualificationChangeImpact, SystemDesignFingerprint } from './QualificationChangeImpact';
import { PcbCopperPourEngine } from '../pcb/PcbCopperPourEngine';
import { PcbSignalIntegrityEngine } from '../pcb/PcbSignalIntegrityEngine';
import { PcbStructuralDeflectionEngine } from '../pcb/PcbStructuralDeflectionEngine';

export interface SystemQualificationReport {
  reportId: string;
  systemId: string;
  systemRevision: string;
  timestamp: string;
  qualificationStatus: SystemQualificationStatus;
  isFullyQualifiedWithinScope: boolean;
  targetDomain: string;
  targetStandard: string;
  totalRequirements: number;
  verifiedRequirements: number;
  failedRequirements: number;
  blockedRequirements: number;
  unverifiedRequirements: number;
  evidenceRecordsCount: number;
  evidenceMerkleRoot: string;
  canonicalSystemHash: string;
  qualificationSignature: string;
  requirementsTraceability: RequirementTraceabilityRecord[];
  solverValidityLimits: {
    domain: string;
    engine: string;
    validityScope: string;
    unsupportedPhenomena: string[];
  }[];
  declaredScopeAndLimitations: string[];
}

export class SystemQualificationEngine {
  private static instance: SystemQualificationEngine;
  private evidenceLedger: EngineeringEvidenceLedger;
  private baselineFingerprints: Map<string, SystemDesignFingerprint> = new Map();
  private evidenceStore: Map<string, Map<string, RequirementVerificationEvidence>> = new Map();

  public static getInstance(): SystemQualificationEngine {
    if (!SystemQualificationEngine.instance) {
      SystemQualificationEngine.instance = new SystemQualificationEngine();
    }
    return SystemQualificationEngine.instance;
  }

  constructor() {
    this.evidenceLedger = EngineeringEvidenceLedger.getInstance();
  }

  /**
   * Executes authoritative qualification evaluation of the target Engineering System.
   */
  public evaluateSystem(system: EngineeringSystem): SystemQualificationReport {
    const timestamp = new Date().toISOString();
    const assembly = system.multidomainAssembly;

    // 1. Run authoritative multidomain verification gate
    const gateReport: MultidomainPcbGateReport = MultidomainPcbHardAcceptanceGate.runGate(assembly);
    const canonicalSystemHash = computeMultidomainCanonicalHash(assembly);

    // 2. Check for active baseline and detect change impact / invalidation
    let systemEvidenceMap = this.evidenceStore.get(system.systemId);
    if (!systemEvidenceMap) {
      systemEvidenceMap = new Map<string, RequirementVerificationEvidence>();
      this.evidenceStore.set(system.systemId, systemEvidenceMap);
    }

    const baseline = this.baselineFingerprints.get(system.systemId);
    let invalidationReport = undefined;
    if (baseline) {
      invalidationReport = QualificationChangeImpact.evaluateChangeImpact(
        baseline,
        system,
        systemEvidenceMap
      );
    }

    // 3. Process each requirement and evaluate against authoritative verification results
    const traceabilityRecords: RequirementTraceabilityRecord[] = [];
    const evidenceDigests: string[] = [];

    let verifiedCount = 0;
    let failedCount = 0;
    let blockedCount = 0;

    for (const req of system.qualificationRequirements) {
      let measuredValue: number | string | boolean = 'NOT_MEASURED';
      let solverUsed = req.authoritativeEngine;
      let notes = '';

      switch (req.requirementId) {
        case 'REQ-ECU-ELEC-001': {
          measuredValue = gateReport.domainResults.electrical.nodalResult.powerBalance.imbalanceWatts;
          solverUsed = 'NodalCircuitSolver.solveDetailed (MNA)';
          notes = `Imbalance: ${measuredValue} W, non-singular conductance matrix`;
          break;
        }
        case 'REQ-ECU-ELEC-002': {
          measuredValue = gateReport.domainResults.electrical.maxVoltageDropPercent;
          solverUsed = 'MultidomainPcbIntegrationEngine.verifyElectricalTraceDrop';
          notes = `Max copper trace drop: ${measuredValue}%`;
          break;
        }
        case 'REQ-ECU-HARN-001': {
          measuredValue = gateReport.domainResults.ecadHarness.ampacityViolations.length;
          solverUsed = 'MultidomainPcbIntegrationEngine.verifyEcadHarnessInterface';
          notes = `Ampacity violations count: ${measuredValue}`;
          break;
        }
        case 'REQ-ECU-HARN-002': {
          measuredValue = gateReport.domainResults.ecadHarness.mismatches.length;
          solverUsed = 'MultidomainPcbIntegrationEngine.verifyEcadHarnessInterface';
          notes = `Pin net parity mismatches count: ${measuredValue}`;
          break;
        }
        case 'REQ-ECU-THERM-001': {
          measuredValue = gateReport.domainResults.thermal.maxJunctionTempC;
          solverUsed = 'MultidomainPcbIntegrationEngine.verifyThermalDissipation (Theta-JA 0D/1D)';
          notes = `Max junction temp: ${measuredValue}°C on hottest IC (${gateReport.domainResults.thermal.hottestComponentRefDes})`;
          break;
        }
        case 'REQ-ECU-MECH-001': {
          measuredValue = gateReport.domainResults.mcad.enclosureClearancePassed;
          solverUsed = 'MultidomainPcbIntegrationEngine.verifyMcadMechanicalFit';
          notes = measuredValue ? 'Positive wall margin on all edges' : 'Board wall clearance breached';
          break;
        }
        case 'REQ-ECU-MECH-002': {
          measuredValue = gateReport.domainResults.mcad.standoffAlignmentPassed;
          solverUsed = 'MultidomainPcbIntegrationEngine.verifyMcadMechanicalFit';
          notes = measuredValue ? 'All chassis standoffs coaxially aligned' : 'Standoff alignment deviated';
          break;
        }
        case 'REQ-ECU-MECH-003': {
          measuredValue = gateReport.domainResults.mcad.lidClearancePassed;
          solverUsed = 'MultidomainPcbIntegrationEngine.verifyMcadMechanicalFit';
          notes = measuredValue ? 'All components clear enclosure ceiling' : 'Lid vertical keepout breached';
          break;
        }
        case 'REQ-ECU-BOM-001': {
          measuredValue = gateReport.domainResults.manufacturingBom.unassignedItems.length;
          solverUsed = 'MultidomainPcbIntegrationEngine.verifyManufacturingBom';
          notes = `Unassigned BOM items: ${measuredValue}`;
          break;
        }
        case 'REQ-ECU-EVID-001': {
          measuredValue = gateReport.cryptographicSignature;
          solverUsed = 'EngineeringTruthCertificateEngine';
          notes = `Deterministic signature: ${gateReport.cryptographicSignature.substring(0, 16)}...`;
          break;
        }
        case 'REQ-ECU-PCB-POUR-001': {
          const pourRes = PcbCopperPourEngine.generatePour({
            id: 'POUR_GND_REF',
            netName: 'GND',
            layer: 'BOTTOM_COPPER',
            outline: [{ x: 0, y: 0 }, { x: assembly.pcb.boardWidthMm, y: 0 }, { x: assembly.pcb.boardWidthMm, y: assembly.pcb.boardHeightMm }, { x: 0, y: assembly.pcb.boardHeightMm }],
            clearanceMm: 0.3,
            thermalReliefEnabled: true,
            spokeCount: 4,
            spokeWidthMm: 0.4,
            fillType: 'SOLID'
          }, assembly.pcb.boardWidthMm, assembly.pcb.boardHeightMm, []);
          measuredValue = pourRes.clearanceViolationsDetected;
          solverUsed = 'PcbCopperPourEngine.generatePour';
          notes = pourRes.notes;
          break;
        }
        case 'REQ-ECU-PCB-SI-001': {
          const siRes = PcbSignalIntegrityEngine.calculateMicrostrip({
            traceWidthMm: assembly.pcb.traces[0]?.widthMm || 0.35,
            traceThicknessUm: 35,
            dielectricHeightMm: 0.2,
            relativePermittivity: 4.3
          });
          measuredValue = siRes.isCompliant50Ohms;
          solverUsed = 'PcbSignalIntegrityEngine.calculateMicrostrip';
          notes = `Microstrip Z0 = ${siRes.impedanceOhms} Ω`;
          break;
        }
        case 'REQ-ECU-PCB-MECH-004': {
          const strucRes = PcbStructuralDeflectionEngine.evaluateStructuralIntegrity({
            lengthMm: assembly.pcb.boardWidthMm,
            widthMm: assembly.pcb.boardHeightMm,
            thicknessMm: assembly.pcb.thicknessMm,
            youngModulusGpa: 24.0,
            poissonRatio: 0.14,
            densityKgM3: 1850.0,
            totalMassKg: 0.045,
            mountingType: 'FOUR_CORNERS_SUPPORTED'
          }, 80.0);
          measuredValue = strucRes.isMechanicallyStable;
          solverUsed = 'PcbStructuralDeflectionEngine.evaluateStructuralIntegrity';
          notes = `Max deflection = ${strucRes.maxDeflectionMm} mm, Stress = ${strucRes.maxBendingStressMpa} MPa`;
          break;
        }
        default: {
          // Unknown or custom requirement
          notes = 'Custom requirement without direct gate binding';
          break;
        }
      }

      // Check if this requirement was invalidated by change impact
      const wasInvalidated = invalidationReport?.invalidatedEvidence.some(
        inv => inv.requirementId === req.requirementId
      );

      // Evaluate acceptance criteria
      const evaluation = evaluateAcceptanceCriteria(req.acceptanceCriteria, measuredValue);
      const isCompliant = evaluation.complies && !wasInvalidated;

      // Compute cryptographic evidence digest deterministically from design state & result
      const evidencePayload = {
        requirementId: req.requirementId,
        measuredValue,
        isCompliant,
        canonicalHash: canonicalSystemHash,
        revisionId: system.revisionId
      };
      const evidenceDigest = createHash('sha256')
        .update(JSON.stringify(evidencePayload))
        .digest('hex');

      evidenceDigests.push(evidenceDigest);

      const evidence: RequirementVerificationEvidence = {
        requirementId: req.requirementId,
        measuredValue,
        isCompliant,
        executionTimestamp: timestamp,
        evidenceDigest,
        solverUsed,
        solverLimitationsNoted: req.solverValidityLimits,
        notes: wasInvalidated
          ? `EVIDENCE_INVALIDATED: Subsystem modified without re-verification; ${evaluation.message}`
          : evaluation.message
      };

      systemEvidenceMap.set(req.requirementId, evidence);

      // Update requirement state
      if (wasInvalidated) {
        req.state = 'DECLARED';
        blockedCount++;
      } else if (isCompliant) {
        req.state = 'QUALIFICATION_ACCEPTED';
        verifiedCount++;
      } else {
        req.state = 'EXECUTED';
        failedCount++;
      }

      traceabilityRecords.push({
        requirement: { ...req },
        evidence,
        status: wasInvalidated
          ? 'INVALIDATED'
          : isCompliant
            ? 'SATISFIED'
            : 'BREACHED',
        gapAnalysisNotes: wasInvalidated
          ? 'Evidence invalidated due to subsequent design modification'
          : !isCompliant
            ? evaluation.message
            : undefined
      });
    }

    // 4. Compute Merkle tree root of evidence records
    const sortedDigests = [...evidenceDigests].sort();
    const evidenceMerkleRoot = createHash('sha256')
      .update(sortedDigests.join(':'))
      .digest('hex');

    // 5. Final Qualification Decision
    let qualificationStatus: SystemQualificationStatus = 'QUALIFIED_WITHIN_DECLARED_SCOPE';

    if (invalidationReport?.isQualificationBlocked || blockedCount > 0) {
      qualificationStatus = 'QUALIFICATION_BLOCKED';
    } else if (failedCount > 0) {
      qualificationStatus = 'VERIFICATION_FAILED';
    } else if (verifiedCount < system.qualificationRequirements.length) {
      qualificationStatus = 'PARTIALLY_ASSESSED';
    }

    // Save active fingerprint as the new baseline
    this.baselineFingerprints.set(
      system.systemId,
      QualificationChangeImpact.computeSystemFingerprint(system)
    );

    const qualificationSignature = createHash('sha256')
      .update(system.systemId + system.revisionId + qualificationStatus + evidenceMerkleRoot + timestamp)
      .digest('hex');

    const reportId = `SECP-P5-QUAL-${system.systemId}-${Date.now()}`;

    return {
      reportId,
      systemId: system.systemId,
      systemRevision: system.revisionId,
      timestamp,
      qualificationStatus,
      isFullyQualifiedWithinScope: qualificationStatus === 'QUALIFIED_WITHIN_DECLARED_SCOPE',
      targetDomain: system.targetDomain,
      targetStandard: system.targetStandard,
      totalRequirements: system.qualificationRequirements.length,
      verifiedRequirements: verifiedCount,
      failedRequirements: failedCount,
      blockedRequirements: blockedCount,
      unverifiedRequirements: system.qualificationRequirements.length - verifiedCount - failedCount - blockedCount,
      evidenceRecordsCount: traceabilityRecords.length,
      evidenceMerkleRoot,
      canonicalSystemHash,
      qualificationSignature,
      requirementsTraceability: traceabilityRecords,
      solverValidityLimits: [
        {
          domain: 'ELECTRICAL',
          engine: system.solverValidity.circuitSolver.engine,
          validityScope: system.solverValidity.circuitSolver.validityScope,
          unsupportedPhenomena: system.solverValidity.circuitSolver.unsupportedPhenomena
        },
        {
          domain: 'THERMAL',
          engine: system.solverValidity.thermalSolver.engine,
          validityScope: system.solverValidity.thermalSolver.validityScope,
          unsupportedPhenomena: system.solverValidity.thermalSolver.unsupportedPhenomena
        },
        {
          domain: 'MCAD',
          engine: system.solverValidity.mechanicalVerification.engine,
          validityScope: system.solverValidity.mechanicalVerification.validityScope,
          unsupportedPhenomena: system.solverValidity.mechanicalVerification.unsupportedPhenomena
        }
      ],
      declaredScopeAndLimitations: system.declaredScopeAndLimitations
    };
  }
}
